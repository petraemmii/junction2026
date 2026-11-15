// Where the request handlers keep their data. Two implementations, chosen by the build target
// (the `#runtime` import in package.json): JSON files under data/ on Node (storage-files.ts) and
// a D1 database on Cloudflare Workers (storage-d1.ts). Server-side only.
import type { Applicant, Company } from './types.ts'

/**
 * Every read of an application spends Context.dev credits, and the endpoint is public: at most this
 * many reads may start within an hour (src/pages/api/apply.ts).
 */
export const MAX_READS_PER_HOUR = 120

export interface Storage {
  /** Every applicant, oldest first. */
  applicants(): Promise<Applicant[]>
  /** The event's participating companies. */
  companies(): Promise<Company[]>
  /** Insert a new applicant or replace the existing record when sources or choices are refreshed. */
  saveApplicant(applicant: Applicant): Promise<void>
  /** Keep one document by name, replacing the last one (the LinkedIn snapshot). */
  saveDocument(name: string, value: unknown): Promise<void>
  /**
   * Take one of the `max` reads that may start within an hour, counted across every instance of
   * the server. False when none is left. A store that only one process uses always says yes: the
   * count in that process (src/pages/api/apply.ts) is the whole count.
   */
  reserveRead(max: number, now?: number): Promise<boolean>
}
