// Receives an application: whatever the applicant typed about where their work is, optionally
// the fields they apply for and a CV. Repairs the links, reads everything through Context.dev
// and stores the applicant for the organiser. The answer says which links were read and which
// were refused, not how the applicant scored: that is for the organiser. Takes JSON, also from
// the other origins in PRESELECT_ALLOWED_ORIGINS (the landing page), or form data with a CV file.
import { storage } from '#runtime'
import type { APIRoute } from 'astro'
import { collectApplicant } from '../../lib/collect.ts'
import { cors } from '../../lib/cors.ts'
import { prepareCompanies } from '../../lib/companies.ts'
import { platformOf } from '../../lib/extract.ts'
import { MAX_CV_BYTES, MAX_TEXT_CHARS, withinLimits } from '../../lib/limits.ts'
import { parseLinks } from '../../lib/links.ts'
import { MAX_READS_PER_HOUR } from '../../lib/storage.ts'
import { EVENT_NAME } from '../../lib/taxonomy.ts'
import { FIELD_IDS } from '../../lib/types.ts'
import type { Applicant, FieldId } from '../../lib/types.ts'
import { toView } from '../../lib/view.ts'

const CV_TYPES = ['pdf', 'docx', 'doc', 'txt', 'md', 'rtf']
const SOURCE_MAX_AGE_MS = 24 * 60 * 60 * 1000

// Every application spends Context.dev credits, so a runaway script cannot send more than
// MAX_READS_PER_HOUR. Counted here for this process and, where several instances serve the
// requests (Cloudflare Workers), also in the store, across all of them.
const recent: number[] = []

export const OPTIONS: APIRoute = ({ request }) =>
  new Response(null, {
    status: 204,
    headers: {
      ...cors(request),
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '600',
    },
  })

interface Input {
  text: string
  fields: unknown[]
  cv: File | null
  refresh: boolean
}

async function read(request: Request): Promise<Input | null> {
  try {
    if (request.headers.get('content-type')?.includes('application/json')) {
      const body = await request.json()
      const links = Array.isArray(body?.links) ? body.links.join('\n') : body?.links
      return {
        text: [body?.text, links].filter((part) => typeof part === 'string').join('\n'),
        fields: Array.isArray(body?.fields) ? body.fields : [],
        cv: null,
        refresh: body?.refresh === true,
      }
    }
    const form = await request.formData()
    const file = form.get('cv')
    return {
      text: [form.get('text'), form.get('links')].filter((part) => typeof part === 'string').join('\n'),
      fields: form.getAll('fields'),
      cv: file instanceof File && file.size > 0 ? file : null,
      refresh: form.get('refresh') === 'true',
    }
  } catch {
    return null
  }
}

/**
 * What the sender is told: which sources were read and which of the event's companies the
 * applicant overlaps with, best match first. Nothing about the score.
 */
const answer = async (applicant: Applicant) => ({
  id: applicant.id,
  event: EVENT_NAME,
  companies: toView(applicant, prepareCompanies(await storage.companies())).companies.matches.map(
    (match) => match.name,
  ),
  sources: applicant.sources.map((source) => ({
    label: source.platform === 'cv' ? 'CV' : platformOf(source.url).label,
    url: source.platform === 'cv' ? null : source.url,
    ok: source.status === 'ok',
    error: source.error,
  })),
})

export const POST: APIRoute = async ({ request }) => {
  const headers = { 'Content-Type': 'application/json', ...cors(request) }
  const json = (body: unknown, status = 200) => {
    if (status >= 400) console.warn(`[apply] ${status}:`, (body as { error?: unknown }).error)
    return new Response(JSON.stringify(body), { status, headers })
  }

  // The endpoint is public: a body larger than an application can be is not read to the end.
  const bounded = await withinLimits(request)
  if (!bounded) return json({ error: 'The application is too large. A CV can be up to 10 MB.' }, 413)

  const input = await read(bounded)
  if (!input) return json({ error: 'Send the application as JSON or as form data.' }, 400)
  if (input.text.length > MAX_TEXT_CHARS) {
    return json({ error: 'That is too much text. Send the links to your work.' }, 400)
  }

  const declaredFields = input.fields.filter((f): f is FieldId => FIELD_IDS.includes(f as FieldId))
  const { links, rejected } = parseLinks(input.text)
  const { cv } = input

  if (!links.length && !cv) {
    const error = rejected.length ? rejected[0]!.reason : 'Add at least one link to your work.'
    return json({ error, rejected }, 400)
  }
  const extension = cv?.name.split('.').pop()?.toLowerCase() ?? ''
  if (cv && !CV_TYPES.includes(extension)) return json({ error: `The CV must be one of: ${CV_TYPES.join(', ')}.` }, 400)
  if (cv && cv.size > MAX_CV_BYTES) return json({ error: 'The CV is larger than 10 MB.' }, 400)

  // Reuse recent, complete reads, but always save the applicant's latest field choices.
  const urls = links.map((link) => link.url)
  const same = (a: Applicant) =>
    !a.hasCv && a.links.length === urls.length && a.links.every((url) => urls.includes(url))
  const applicants = await storage.applicants()
  const known = cv ? undefined : applicants.find(same)
  const fresh =
    known?.sources.length &&
    known.sources.every((source) => {
      const age = Date.now() - Date.parse(source.fetchedAt)
      return source.status === 'ok' && !source.error && age >= 0 && age < SOURCE_MAX_AGE_MS
    })
  if (known && fresh && !input.refresh) {
    const updated = { ...known, declaredFields }
    await storage.saveApplicant(updated)
    return json({ ...(await answer(updated)), links, rejected, repeated: true })
  }

  const hourAgo = Date.now() - 3_600_000
  while (recent.length && recent[0]! < hourAgo) recent.shift()
  const tooMany = () => json({ error: 'Too many applications right now. Try again in a while.' }, 429)
  if (recent.length >= MAX_READS_PER_HOUR) return tooMany()
  recent.push(Date.now())
  if (!(await storage.reserveRead(MAX_READS_PER_HOUR))) return tooMany()

  const applicant = await collectApplicant({
    links: urls,
    declaredFields,
    cv: cv ? { bytes: new Uint8Array(await cv.arrayBuffer()), extension } : undefined,
    alias: known?.alias ?? `Applicant ${String(applicants.length + 1).padStart(3, '0')}`,
  })
  for (const source of applicant.sources) {
    if (source.status !== 'ok') console.warn(`[apply] could not read ${source.url}:`, source.error)
  }
  const updated = known ? { ...applicant, id: known.id, alias: known.alias, createdAt: known.createdAt } : applicant
  await storage.saveApplicant(updated)
  return json({ ...(await answer(updated)), links, rejected, repeated: !!known })
}
