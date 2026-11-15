// What differs between the two servers this app runs on, for Cloudflare Workers (the `workerd`
// condition of `#runtime` in package.json): the composed site's Worker, apps/landing/wrangler.jsonc.
// Settings and secrets come from the Worker's environment when a request asks for them, never
// from the build; applicants live in the D1 database bound as DB.
//
// @ts-ignore: only the Workers build knows this module (the adapter's types are not always loaded).
import { env } from 'cloudflare:workers'
import companies from '../../data/companies.json'
import { d1Storage } from './storage-d1.ts'
import type { D1 } from './storage-d1.ts'
import type { Storage } from './storage.ts'
import type { Company } from './types.ts'

const bindings = env as Record<string, unknown>

/** The D1 database bound as DB; the companies are the committed data/companies.json. */
export const storage: Storage = d1Storage(
  () => {
    const db = bindings.DB as D1 | undefined
    if (!db) throw new Error('The Worker has no D1 binding named DB (d1_databases in apps/landing/wrangler.jsonc)')
    return db
  },
  companies as unknown as Company[],
)

/** Where `envValue` looks, for the message when a setting is missing. */
export const ENV_SOURCES = 'a secret or variable of the Worker: `wrangler secret put`, .dev.vars for `wrangler dev`'

/** A secret or variable of the Worker. */
export function envValue(name: string): string | undefined {
  const value = bindings[name]
  return typeof value === 'string' ? value : undefined
}
