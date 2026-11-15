// Storage on Cloudflare Workers: a D1 database (SQLite). One row per applicant, written with an
// upsert, so two applications at once cannot lose each other the way two writes of one JSON file
// could. The tables are created on the first request of each isolate; there is no migration step.
import type { Storage } from './storage.ts'
import type { Applicant, Company } from './types.ts'

/** The part of a D1 prepared statement this module uses. */
export interface D1Statement {
  bind(...values: unknown[]): D1Statement
  all<T>(): Promise<{ results: T[] }>
  run(): Promise<{ meta: { changes: number } }>
}

/** The part of the D1 binding this module uses (tests pass a fake backed by node:sqlite). */
export interface D1 {
  prepare(sql: string): D1Statement
  /** Runs the statements in order, in one transaction. */
  batch(statements: D1Statement[]): Promise<{ meta: { changes: number } }[]>
}

const SCHEMA = [
  // `data` is the applicant as JSON, `updated_at` the time of the last write in milliseconds.
  'CREATE TABLE IF NOT EXISTS applicants (id TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at INTEGER NOT NULL)',
  'CREATE TABLE IF NOT EXISTS documents (name TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at INTEGER NOT NULL)',
  // One row per read of an application that spends Context.dev credits: the hourly cap.
  'CREATE TABLE IF NOT EXISTS reads (at INTEGER NOT NULL)',
]

const HOUR_MS = 3_600_000

/**
 * `database` is called on every use, so a missing binding fails the request that needs it, with
 * its own message, rather than the whole Worker at start-up. `companies` is the committed
 * data/companies.json, bundled into the Worker.
 */
export function d1Storage(database: () => D1, companies: Company[]): Storage {
  let ready: Promise<unknown> | undefined
  /** The database, with its tables. A failed attempt is tried again on the next request. */
  async function open(): Promise<D1> {
    const db = database()
    ready ??= db.batch(SCHEMA.map((sql) => db.prepare(sql))).catch((error: unknown) => {
      ready = undefined
      throw error
    })
    await ready
    return db
  }

  return {
    async applicants() {
      const db = await open()
      // An upsert keeps the row's rowid, so this is the order the applicants first arrived in.
      const { results } = await db.prepare('SELECT data FROM applicants ORDER BY rowid').all<{ data: string }>()
      return results.map((row) => JSON.parse(row.data) as Applicant)
    },

    companies: async () => companies,

    async saveApplicant(applicant) {
      const db = await open()
      await db
        .prepare(
          'INSERT INTO applicants (id, data, updated_at) VALUES (?1, ?2, ?3) ' +
            'ON CONFLICT (id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at',
        )
        .bind(applicant.id, JSON.stringify(applicant), Date.now())
        .run()
    },

    async saveDocument(name, value) {
      const db = await open()
      await db
        .prepare(
          'INSERT INTO documents (name, data, updated_at) VALUES (?1, ?2, ?3) ' +
            'ON CONFLICT (name) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at',
        )
        .bind(name, JSON.stringify(value), Date.now())
        .run()
    },

    async reserveRead(max, now = Date.now()) {
      const db = await open()
      const hourAgo = now - HOUR_MS
      // Counted and taken in one statement, before the read starts: reads still under way and
      // repeated reads of one applicant count too, which a count of the applicants would miss.
      const [, taken] = await db.batch([
        db.prepare('DELETE FROM reads WHERE at <= ?1').bind(hourAgo),
        db
          .prepare('INSERT INTO reads (at) SELECT ?1 WHERE (SELECT COUNT(*) FROM reads WHERE at > ?2) < ?3')
          .bind(now, hourAgo, max),
      ])
      return taken?.meta.changes === 1
    },
  }
}
