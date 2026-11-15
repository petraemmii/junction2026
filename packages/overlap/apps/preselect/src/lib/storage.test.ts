import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { computeSignals } from './signals.ts'
import { d1Storage } from './storage-d1.ts'
import type { D1, D1Statement } from './storage-d1.ts'
import type { Applicant, Company } from './types.ts'

const applicant = (id: string, extra: Partial<Applicant> = {}): Applicant => ({
  id,
  alias: `Applicant ${id}`,
  declaredFields: ['embedded'],
  links: [`https://github.com/${id}`],
  hasCv: false,
  sources: [],
  signals: computeSignals([]),
  createdAt: '2026-11-14T00:00:00Z',
  ...extra,
})

describe('storage in files (Node)', () => {
  let directory: string | undefined
  afterEach(() => {
    vi.restoreAllMocks()
    if (directory) rmSync(directory, { recursive: true, force: true })
  })

  /** The storage with data/ in a new temporary folder. */
  async function inFolder() {
    directory = mkdtempSync(join(tmpdir(), 'aislop-storage-test-'))
    vi.spyOn(process, 'cwd').mockReturnValue(directory)
    vi.resetModules()
    const { fileStorage } = await import('./storage-files.ts')
    return { storage: fileStorage(), data: join(directory, 'data') }
  }

  it('reads and writes the files the scripts do, byte for byte', async () => {
    const { storage, data } = await inFolder()
    expect(await storage.applicants()).toEqual([])
    expect(await storage.companies()).toEqual([])
    const first = applicant('first')
    const second = applicant('second')
    await storage.saveApplicant(first)
    await storage.saveApplicant(second)
    const updated = { ...first, declaredFields: ['ai'] as Applicant['declaredFields'] }
    await storage.saveApplicant(updated)
    expect(await storage.applicants()).toEqual([updated, second])
    expect(readFileSync(join(data, 'applicants.json'), 'utf8')).toBe(JSON.stringify([updated, second], null, 1))
  })

  it('keeps a document as data/<name>.json', async () => {
    const { storage, data } = await inFolder()
    await storage.saveDocument('linkedin-snapshot', { PROFILE: [{ name: 'Ada' }] })
    expect(readFileSync(join(data, 'linkedin-snapshot.json'), 'utf8')).toBe(
      JSON.stringify({ PROFILE: [{ name: 'Ada' }] }, null, 1),
    )
  })

  it('leaves the hourly cap to the process that serves every request', async () => {
    const { storage } = await inFolder()
    expect(await storage.reserveRead(0)).toBe(true)
  })
})

/** D1 as the storage uses it, on an in-memory SQLite database, so the real SQL runs. */
function fakeD1(): D1 & { sqlite: DatabaseSync; batches: number } {
  const sqlite = new DatabaseSync(':memory:')
  const statement = (sql: string, values: unknown[] = []): D1Statement => ({
    bind: (...next) => statement(sql, next),
    all: async <T>() => ({ results: sqlite.prepare(sql).all(...(values as never[])) as T[] }),
    run: async () => ({ meta: { changes: Number(sqlite.prepare(sql).run(...(values as never[])).changes) } }),
  })
  const db = {
    sqlite,
    batches: 0,
    prepare: (sql: string) => statement(sql),
    async batch(statements: D1Statement[]) {
      db.batches++
      const results = []
      for (const one of statements) results.push(await one.run())
      return results
    },
  }
  return db
}

describe('storage in D1 (Cloudflare Workers)', () => {
  const companies = [{ name: 'Example Oy' }] as unknown as Company[]

  it('creates its tables on the first use, once', async () => {
    const db = fakeD1()
    const storage = d1Storage(() => db, companies)
    expect(db.batches).toBe(0)
    expect(await storage.applicants()).toEqual([])
    expect(await storage.applicants()).toEqual([])
    expect(db.batches).toBe(1)
    const tables = db.sqlite.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all()
    expect(tables.map((table) => table.name)).toEqual(['applicants', 'documents', 'reads'])
  })

  it('replaces a refreshed applicant without duplicating it, losing others or changing the order', async () => {
    const db = fakeD1()
    const stored = d1Storage(() => db, companies)
    const first = applicant('first')
    const second = applicant('second')
    await stored.saveApplicant(first)
    await stored.saveApplicant(second)
    const updated = { ...first, declaredFields: ['ai'] as Applicant['declaredFields'] }
    await stored.saveApplicant(updated)
    expect(await stored.applicants()).toEqual([updated, second])
    const rows = db.sqlite.prepare('SELECT id, updated_at FROM applicants ORDER BY rowid').all()
    expect(rows.map((row) => row.id)).toEqual(['first', 'second'])
    expect(rows.every((row) => Number(row.updated_at) > 0)).toBe(true)
  })

  it('keeps both of two applications saved at once', async () => {
    const db = fakeD1()
    // Two isolates, each with its own storage object, on the one database.
    const [a, b] = [d1Storage(() => db, companies), d1Storage(() => db, companies)]
    await Promise.all([a.saveApplicant(applicant('one')), b.saveApplicant(applicant('two'))])
    expect((await a.applicants()).map((one) => one.id).sort()).toEqual(['one', 'two'])
  })

  it('has the bundled companies and keeps a document by name', async () => {
    const db = fakeD1()
    const storage = d1Storage(() => db, companies)
    expect(await storage.companies()).toBe(companies)
    await storage.saveDocument('linkedin-snapshot', { PROFILE: [] })
    await storage.saveDocument('linkedin-snapshot', { PROFILE: [{ name: 'Ada' }] })
    const rows = db.sqlite.prepare('SELECT name, data FROM documents').all()
    expect(rows).toEqual([expect.objectContaining({ name: 'linkedin-snapshot', data: '{"PROFILE":[{"name":"Ada"}]}' })])
  })

  it('allows as many reads in an hour as the cap, across isolates, and frees them an hour later', async () => {
    const db = fakeD1()
    const [a, b] = [d1Storage(() => db, companies), d1Storage(() => db, companies)]
    const start = Date.parse('2026-11-15T08:00:00Z')
    expect(await a.reserveRead(3, start)).toBe(true)
    expect(await b.reserveRead(3, start + 1000)).toBe(true)
    expect(await a.reserveRead(3, start + 2000)).toBe(true)
    expect(await b.reserveRead(3, start + 3000)).toBe(false)
    expect(await a.reserveRead(3, start + 3_599_000)).toBe(false)
    // The first read is an hour old: one place is free again, and its row is gone.
    expect(await b.reserveRead(3, start + 3_600_000)).toBe(true)
    expect(await a.reserveRead(3, start + 3_600_500)).toBe(false)
    expect(db.sqlite.prepare('SELECT COUNT(*) AS n FROM reads').get()?.n).toBe(3)
  })

  it('tries to create the tables again after a failure, and names a missing binding', async () => {
    const db = fakeD1()
    let fail = true
    const flaky: D1 = {
      prepare: (sql) => db.prepare(sql),
      batch: (statements) => (fail ? Promise.reject(new Error('D1 is away')) : db.batch(statements)),
    }
    const storage = d1Storage(() => flaky, companies)
    await expect(storage.applicants()).rejects.toThrow('D1 is away')
    fail = false
    expect(await storage.applicants()).toEqual([])
    const unbound = d1Storage(() => {
      throw new Error('no D1 binding named DB')
    }, companies)
    await expect(unbound.saveApplicant(applicant('x'))).rejects.toThrow('no D1 binding named DB')
  })
})
