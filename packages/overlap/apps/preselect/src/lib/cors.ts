// The other origins that may call this app's API from a browser: in development the landing
// page and the Overlap app. Server-side only.
import { setting } from './settings.ts'

const DEFAULT_ORIGINS = 'http://localhost:4321,http://127.0.0.1:4321,http://localhost:8443,http://127.0.0.1:8443'

/** The CORS headers for the request's origin when PRESELECT_ALLOWED_ORIGINS lists it, else none. */
export function cors(request: Request): Record<string, string> {
  const origin = request.headers.get('origin')
  const allowed = setting('PRESELECT_ALLOWED_ORIGINS', DEFAULT_ORIGINS).split(',')
  return origin && allowed.map((o) => o.trim()).includes(origin)
    ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' }
    : {}
}
