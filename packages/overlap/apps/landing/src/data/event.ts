// The real event behind the ask box: the one apps/preselect reads applicants for. Imported only by
// the page at build time, so the companies themselves never reach the visitor's browser.
import companies from '../../../preselect/data/companies.json'
import { EVENT_NAME } from '../../../preselect/src/lib/taxonomy.ts'

export type EventInfo = {
  name: string
  /** How many companies a profile is matched against (apps/preselect counts the same ones). */
  companies: number
}

export const EVENT: EventInfo = {
  name: EVENT_NAME,
  companies: companies.filter((company) => company.status === 'ok').length,
}
