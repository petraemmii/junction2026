// Receives an application: whatever the applicant typed about where their work is, optionally
// the fields they apply for and a CV. Repairs the links, reads everything through Context.dev
// and stores the applicant for the organiser. The answer says which links were read and which
// were refused, not how the applicant scored: that is for the organiser. Takes JSON, also from
// the other origins in PRESELECT_ALLOWED_ORIGINS (the landing page), or form data with a CV file.
import type { APIRoute } from 'astro'
import { collectApplicant } from '../../lib/collect.ts'
import { cors } from '../../lib/cors.ts'
import { prepareCompanies } from '../../lib/companies.ts'
import { platformOf } from '../../lib/extract.ts'
import { parseLinks } from '../../lib/links.ts'
import { readApplicants, readCompanies, saveApplicant } from '../../lib/store.ts'
import { EVENT_NAME } from '../../lib/taxonomy.ts'
import { FIELD_IDS } from '../../lib/types.ts'
import type { Applicant, FieldId } from '../../lib/types.ts'
import { toView } from '../../lib/view.ts'

const CV_TYPES = ['pdf', 'docx', 'doc', 'txt', 'md', 'rtf']
const MAX_CV_BYTES = 10 * 1024 * 1024
const SOURCE_MAX_AGE_MS = 24 * 60 * 60 * 1000

// Every application spends Context.dev credits, so a runaway script cannot send more than this.
const MAX_PER_HOUR = 120
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
const answer = (applicant: Applicant) => ({
  id: applicant.id,
  event: EVENT_NAME,
  companies: toView(applicant, prepareCompanies(readCompanies())).companies.matches.map((match) => match.name),
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

  const input = await read(request)
  if (!input) return json({ error: 'Send the application as JSON or as form data.' }, 400)

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
  const known = cv ? undefined : readApplicants().find(same)
  const fresh =
    known?.sources.length &&
    known.sources.every((source) => {
      const age = Date.now() - Date.parse(source.fetchedAt)
      return source.status === 'ok' && !source.error && age >= 0 && age < SOURCE_MAX_AGE_MS
    })
  if (known && fresh && !input.refresh) {
    const updated = { ...known, declaredFields }
    saveApplicant(updated)
    return json({ ...answer(updated), links, rejected, repeated: true })
  }

  const hourAgo = Date.now() - 3_600_000
  while (recent.length && recent[0]! < hourAgo) recent.shift()
  if (recent.length >= MAX_PER_HOUR)
    return json({ error: 'Too many applications right now. Try again in a while.' }, 429)
  recent.push(Date.now())

  const applicant = await collectApplicant({
    links: urls,
    declaredFields,
    cv: cv ? { bytes: new Uint8Array(await cv.arrayBuffer()), extension } : undefined,
    alias: known?.alias ?? `Applicant ${String(readApplicants().length + 1).padStart(3, '0')}`,
  })
  for (const source of applicant.sources) {
    if (source.status !== 'ok') console.warn(`[apply] could not read ${source.url}:`, source.error)
  }
  const updated = known ? { ...applicant, id: known.id, alias: known.alias, createdAt: known.createdAt } : applicant
  saveApplicant(updated)
  return json({ ...answer(updated), links, rejected, repeated: !!known })
}
