// Where the composed site is deployed, and the pure helpers `build-site.mjs` uses to build it for a
// sub-path. No side effects, so tests can import it (build-site.mjs runs the builds on import).

/**
 * The origin and path `build:site` builds for when SITE_URL and SITE_BASE are unset: the site is
 * served at https://junction2026.com/submission by the Worker route `junction2026.com/submission*`
 * in apps/landing/wrangler.jsonc. Change them together (apps/landing/src/config.test.ts checks).
 */
export const DEFAULT_SITE_URL = 'https://junction2026.com'
export const DEFAULT_SITE_BASE = '/submission/'

/**
 * The app's path below the site's base (/app/ at the root, /submission/app/ under /submission).
 * The same path is APP_PATH in apps/landing/src/config.ts and in the /app/ rules of
 * apps/landing/public/_headers; config.test.ts checks.
 */
export const APP_PATH = '/app/'

/**
 * The pre-selection backend's path below the site's base (/preselect/ at the root,
 * /submission/preselect/ under /submission): its organiser view, with its API below it. The same
 * path is in the /preselect/ rule of apps/landing/public/_headers; config.test.ts checks.
 */
export const PRESELECT_PATH = '/preselect/'

/**
 * What PUBLIC_PRESELECT_URL means to `build:site`, for a site below `base` (as normalizeBase
 * returns it):
 * - unset: the backend is built into the site's Worker and the landing page uses it at
 *   <base>preselect, on its own origin (`bundle`);
 * - a URL: a backend deployed elsewhere, which the landing page uses instead;
 * - empty: no backend, and the landing page reads no profiles.
 * `url` is the PUBLIC_PRESELECT_URL the landing page is built with, `path` where a bundled backend
 * is served: no trailing slash, as Astro's `base` of that build.
 *
 * @param {string | undefined} value
 * @param {string} base
 * @returns {{ bundle: boolean, url: string, path: string | null }}
 */
export function preselectTarget(value, base) {
  if (value !== undefined) return { bundle: false, url: value.trim(), path: null }
  const path = `${base}${PRESELECT_PATH.slice(1, -1)}`
  return { bundle: true, url: path, path }
}

/**
 * SITE_BASE as a path with a slash at both ends ("/submission/"), or "/" for the root of the origin.
 * "/submission", "/submission/" and "submission" are the same base; undefined, "" and "/" mean the
 * root. Throws on anything that is not a plain URL path.
 *
 * @param {string | undefined} value
 * @returns {string}
 */
export function normalizeBase(value) {
  const trimmed = (value ?? '').trim().replace(/^\/+|\/+$/g, '')
  if (!trimmed) return '/'
  const segments = trimmed.split('/')
  if (segments.some((segment) => !/^[\w.~-]+$/.test(segment) || segment === '.' || segment === '..')) {
    throw new Error(`SITE_BASE must be a URL path such as /submission, not ${JSON.stringify(value)}`)
  }
  return `/${trimmed}/`
}

/**
 * A `_headers` file written for a site at the root of its origin (apps/landing/public/_headers), with
 * its rule paths moved below `base` (as normalizeBase returns it). Rule paths are full request paths
 * on Cloudflare, so the site's rules must name the base. "/*" becomes "/submission*", which covers
 * the home page (/submission) as well as everything below it; "/" becomes "/submission"; any other
 * path "/x" becomes "/submission/x". Only rule lines change (they start with "/"): header lines
 * (indented), `! Name` lines, comments and blank lines are kept as they are.
 *
 * @param {string} headers
 * @param {string} base
 * @returns {string}
 */
export function prefixHeaderRules(headers, base) {
  const prefix = base.replace(/\/+$/, '')
  if (!prefix) return headers
  return headers.replace(/^\/\S*/gm, (rule) =>
    rule === '/' || rule.startsWith('/*') ? `${prefix}${rule.slice(1)}` : `${prefix}${rule}`,
  )
}
