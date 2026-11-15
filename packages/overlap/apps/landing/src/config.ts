// Site-wide settings for the landing page.
import { sitePath } from '@/lib/base'

/**
 * The app's path below the site's base: /app/ at the root, /submission/app/ on junction2026.com.
 * Also APP_PATH in scripts/site-target.mjs (which `build:site` builds the app for) and the /app/
 * rules of public/_headers; config.test.ts fails when they differ.
 */
export const APP_PATH = '/app/'

/**
 * The Overlap app. By default the app is served by the same Worker at APP_PATH below the site's
 * base (see the root `build:site` script); set PUBLIC_APP_URL at build time to point at another
 * deployment instead.
 */
export const APP_URL: string = import.meta.env.PUBLIC_APP_URL || sitePath(APP_PATH)

/**
 * The pre-selection backend (apps/preselect), which reads the profiles typed in the ask box. In
 * development it is http://localhost:4322, which `vp run dev:landing` starts as well. A build has
 * it when PUBLIC_PRESELECT_URL is set: the root `build:site` script sets it to the backend it
 * bundles into the site's Worker, a path on this origin (/submission/preselect). A plain
 * `astro build` has none, and the ask box then works without it.
 */
export const PRESELECT_URL: string = (
  import.meta.env.PUBLIC_PRESELECT_URL || (import.meta.env.DEV ? 'http://localhost:4322' : '')
).replace(/\/+$/, '')

/** Where every "Get started" goes: the login-style page in front of the platform (src/pages/get-started.astro). */
export const GET_STARTED_URL = sitePath('/get-started')

/**
 * The platform that "Log in" and "Sign up here" on /get-started open: the pre-selection app's
 * organiser view when that app runs, else the Overlap app.
 */
export const PLATFORM_URL: string = PRESELECT_URL ? `${PRESELECT_URL}/` : APP_URL

/**
 * The query /get-started adds when it opens the platform: ?from=get-started. The Overlap app reads
 * it and signs the visitor in to its demo instead of showing its own login
 * (apps/app/src/lib/handoff.ts, which has the same two constants; config.test.ts fails when they
 * differ). Change them together. The organiser view has no login and takes no notice of it.
 */
export const HANDOFF_PARAM = 'from'
export const HANDOFF_VALUE = 'get-started'

/** `url` split into the part before its query, its query and its hash. Works on relative URLs. */
function splitUrl(url: string) {
  const hashAt = url.indexOf('#')
  const hash = hashAt === -1 ? '' : url.slice(hashAt)
  const rest = hashAt === -1 ? url : url.slice(0, hashAt)
  const queryAt = rest.indexOf('?')
  const base = queryAt === -1 ? rest : rest.slice(0, queryAt)
  const params = new URLSearchParams(queryAt === -1 ? '' : rest.slice(queryAt + 1))
  return { base, params, hash }
}

/**
 * The query of the platform's entry URL as name-value pairs: `url`'s own query with the handoff
 * set. These are the fields of the GET form on /get-started (whose action is `url`): a GET form
 * replaces its action's query with its fields, so the URL's own query has to be among them.
 */
export function platformEntryFields(url: string): [name: string, value: string][] {
  const { params } = splitUrl(url)
  params.set(HANDOFF_PARAM, HANDOFF_VALUE)
  return [...params]
}

/**
 * The platform's entry URL from /get-started: `url` (relative or absolute) with the handoff added
 * to its query, its hash kept. The same URL the form on that page submits to.
 */
export function platformEntryUrl(url: string): string {
  const { base, hash } = splitUrl(url)
  return `${base}?${new URLSearchParams(platformEntryFields(url))}${hash}`
}

export const SITE = {
  name: 'Overlap',
  title: 'Overlap: events where you’ll fit in',
  description:
    'Overlap ranks career fairs, meetups, workshops and hackathons by how well you match the companies and people in the room. Answer a short questionnaire once and see your fit for every event.',
} as const
