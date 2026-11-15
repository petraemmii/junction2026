// Settings from where the server keeps them (`#runtime`): on Node the environment or a .env file
// in this app or the repo root, on Cloudflare Workers the Worker's secrets and variables. Read
// when asked for, never at build time. Server-side only.
import { ENV_SOURCES, envValue } from '#runtime'

export function setting(name: string, fallback?: string): string {
  const value = envValue(name) ?? fallback
  if (!value) throw new Error(`${name} is not set (${ENV_SOURCES})`)
  return value
}
