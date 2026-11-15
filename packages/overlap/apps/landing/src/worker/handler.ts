// The request handler of the site's Worker (apps/landing/wrangler.jsonc). Static files are served
// before any Worker code runs; what reaches the Worker is every path that is not a file: the
// pre-selection backend's pages and API routes (apps/preselect, below `path`) and unknown paths.

/** The pre-selection backend's server: the Workers build of apps/preselect. */
export interface Backend {
  fetch(request: Request, env: never, context: never): Response | Promise<Response>
}

/** The Worker's bindings this handler uses. The backend reads its own (DB, the secrets). */
export interface AssetsEnv {
  ASSETS: { fetch(request: Request): Promise<Response> }
}

// `_headers` only applies to static files, so the backend's responses get theirs here: the same
// headers as the landing page's (public/_headers).
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'DENY',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()',
  // The organiser view lists people; the API answers are about one applicant.
  'X-Robots-Tag': 'noindex',
  'Cache-Control': 'no-store',
}

// The organiser view: Astro's inline hydration scripts and inline styles, React's style=""
// attributes; everything else from this origin only.
const PAGE_CSP =
  "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'"
// JSON and plain text load nothing.
const DATA_CSP = "default-src 'none'; frame-ancestors 'none'"

const isHtml = (response: Response): boolean => response.headers.get('Content-Type')?.includes('text/html') ?? false

/**
 * `response` with the security headers it does not already have. A response that is a static file
 * after all (the 404 page the backend falls back to for an unknown path) keeps those of `_headers`.
 */
export function withSecurityHeaders(response: Response): Response {
  // Headers of a fetched response are immutable.
  const secured = new Response(response.body, response)
  const headers = { ...SECURITY_HEADERS, 'Content-Security-Policy': isHtml(secured) ? PAGE_CSP : DATA_CSP }
  for (const [name, value] of Object.entries(headers)) {
    if (!secured.headers.has(name)) secured.headers.set(name, value)
  }
  return secured
}

/** Whether `pathname` is the backend's: `path` itself or anything below it. */
export const isBackendPath = (pathname: string, path: string): boolean =>
  pathname === path || pathname.startsWith(`${path}/`)

/**
 * The Worker's `fetch`. `server` and `path` are what `build:site` bundled (./backend.mjs): the
 * backend and the path it is served below ("/submission/preselect"), or null for a site without
 * one. Every other request goes back to the static assets, which answer with the nearest 404.html,
 * a 404 status and the `_headers` rules, as an assets-only Worker would.
 */
export function createFetch(server: Backend | null, path: string | null) {
  return async (request: Request, env: AssetsEnv, context: unknown): Promise<Response> => {
    if (!server || !path || !isBackendPath(new URL(request.url).pathname, path)) return env.ASSETS.fetch(request)
    try {
      const response = await server.fetch(request, env as never, context as never)
      // A page the backend does not have: the site's 404 page, as for every other unknown path.
      if (response.status === 404 && isHtml(response) && (request.method === 'GET' || request.method === 'HEAD')) {
        return env.ASSETS.fetch(request)
      }
      return withSecurityHeaders(response)
    } catch (error) {
      console.error(`[worker] ${request.method} ${request.url} failed:`, error)
      return withSecurityHeaders(new Response('Internal error', { status: 500 }))
    }
  }
}
