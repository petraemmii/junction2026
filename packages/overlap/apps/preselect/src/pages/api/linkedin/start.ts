// Sends the applicant to LinkedIn to sign in and consent to sharing their data.
import type { APIRoute } from 'astro'
import { basePath } from '../../../lib/base.ts'
import { STATE_COOKIE, authorizationUrl } from '../../../lib/linkedin.ts'

export const GET: APIRoute = ({ url, cookies, redirect }) => {
  // The state comes back with the answer and proves it belongs to this browser.
  const state = crypto.randomUUID()
  cookies.set(STATE_COOKIE, state, { httpOnly: true, sameSite: 'lax', path: basePath('/api/linkedin'), maxAge: 600 })
  return redirect(authorizationUrl(state, `${url.origin}${basePath('/api/linkedin/callback')}`))
}
