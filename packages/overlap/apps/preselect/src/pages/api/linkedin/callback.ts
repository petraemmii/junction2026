// LinkedIn sends the applicant back here after they consent. Reads their data once with a
// short-lived token, which is not stored.
import { storage } from '#runtime'
import type { APIRoute } from 'astro'
import { basePath } from '../../../lib/base.ts'
import { SNAPSHOT_DOMAINS, STATE_COOKIE, exchangeCode, fetchSnapshot } from '../../../lib/linkedin.ts'

const text = (body: string, status = 200) =>
  new Response(body, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })

export const GET: APIRoute = async ({ url, cookies }) => {
  const error = url.searchParams.get('error')
  if (error)
    return text(`LinkedIn did not grant access: ${error}\n${url.searchParams.get('error_description') ?? ''}`, 400)

  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  if (!code || !state || state !== cookies.get(STATE_COOKIE)?.value)
    return text(`This sign-in link is not valid any more. Start again from ${basePath('/api/linkedin/start')}.`, 400)
  cookies.delete(STATE_COOKIE, { path: basePath('/api/linkedin') })

  let token: string
  try {
    token = await exchangeCode(code, `${url.origin}${basePath('/api/linkedin/callback')}`)
  } catch (cause) {
    return text(cause instanceof Error ? cause.message : String(cause), 502)
  }

  const snapshot: Record<string, unknown> = {}
  const lines: string[] = []
  // A few domains at a time: LinkedIn does not publish its rate limits.
  const queue = [...SNAPSHOT_DOMAINS]
  const worker = async () => {
    for (let domain = queue.shift(); domain; domain = queue.shift()) {
      try {
        const rows = await fetchSnapshot(token, domain)
        snapshot[domain] = rows
        const fields = [...new Set(rows.flatMap((row) => Object.keys(row)))]
        lines.push(
          `${domain.padEnd(26)} ${String(rows.length).padStart(5)} rows${fields.length ? `: ${fields.join(', ')}` : ''}`,
        )
      } catch (cause) {
        lines.push(`${domain.padEnd(26)} FAILED ${cause instanceof Error ? cause.message : String(cause)}`)
      }
    }
  }
  await Promise.all(Array.from({ length: 4 }, worker))
  // data/linkedin-snapshot.json on Node, a row in D1 on Workers, where a row holds at most 2 MB: a
  // snapshot that cannot be kept is reported, since the data has been read either way.
  let kept = ''
  try {
    await storage.saveDocument('linkedin-snapshot', snapshot)
  } catch (cause) {
    console.warn('[linkedin] could not keep the snapshot:', cause)
    kept = `\nThe snapshot could not be kept: ${cause instanceof Error ? cause.message : String(cause)}\n`
  }
  return text(`Read from LinkedIn:\n\n${lines.sort().join('\n')}\n${kept}`)
}
