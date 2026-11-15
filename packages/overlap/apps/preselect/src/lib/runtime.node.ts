// What differs between the two servers this app runs on, for Node: `astro dev`, the Node build,
// the scripts and the tests. package.json maps `#runtime` to this file, except in the Cloudflare
// Workers build, which gets runtime.workers.ts.
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileStorage } from './storage-files.ts'
import type { Storage } from './storage.ts'

/** The JSON files under data/. */
export const storage: Storage = fileStorage()

/** Where `envValue` looks, for the message when a setting is missing. */
export const ENV_SOURCES = 'environment, .env here or in the repo root'

/** A setting from the environment, or from a .env file in this app or the repo root. */
export function envValue(name: string): string | undefined {
  let value = process.env[name]
  for (const file of ['.env', '../../.env']) {
    if (value) break
    const path = resolve(process.cwd(), file)
    if (!existsSync(path)) continue
    value = readFileSync(path, 'utf8').match(new RegExp(`^\\s*${name}\\s*=\\s*["']?([^"'\\s#]+)`, 'm'))?.[1]
  }
  return value
}
