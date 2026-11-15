// Thin client for the Context.dev API (https://docs.context.dev). Server-side only: the key
// must never reach the browser.
import { setting } from './settings.ts'

const BASE_URL = 'https://api.context.dev/v1'

let cachedKey: string | undefined

/**
 * The API key, from where the server keeps its settings: the environment or a .env file on Node,
 * a secret of the Worker on Cloudflare (settings.ts).
 */
export function apiKey(): string {
  cachedKey ??= setting('CONTEXT_DEV_API_KEY')
  return cachedKey
}

// At most this many requests in flight. A hackathon key allows 50; staying well below keeps
// a large collection run from starving the live form.
const MAX_CONCURRENT = 12
let active = 0
const waiting: (() => void)[] = []

async function slot<T>(run: () => Promise<T>): Promise<T> {
  if (active >= MAX_CONCURRENT) await new Promise<void>((free) => waiting.push(free))
  active++
  try {
    return await run()
  } finally {
    active--
    waiting.shift()?.()
  }
}

const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms))

// A 429 (all request slots in use) or a gateway error is retried this many times, waiting
// longer each time.
const RETRIES = 6

async function post(path: string, init: { body: BodyInit; contentType: string; timeoutMs: number }): Promise<any> {
  return slot(async () => {
    for (let attempt = 0; ; attempt++) {
      const response = await fetch(`${BASE_URL}${path}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey()}`, 'Content-Type': init.contentType },
        body: init.body,
        signal: AbortSignal.timeout(init.timeoutMs),
      })
      const text = await response.text()
      if ((response.status === 429 || response.status >= 502) && attempt < RETRIES) {
        const retryAfter = Number(response.headers.get('retry-after')) || 0
        // Jitter keeps parallel requests from retrying in step.
        await sleep(Math.max(retryAfter * 1000, 1000 * 1.6 ** attempt) + Math.random() * 1000)
        continue
      }
      let json: any
      try {
        json = JSON.parse(text)
      } catch {
        throw new Error(`Context.dev ${path}: HTTP ${response.status}, not JSON: ${text.slice(0, 200)}`)
      }
      if (!response.ok) {
        throw new Error(
          `Context.dev ${path}: HTTP ${response.status} ${
            [json?.error_code, typeof json?.message === 'string' ? json.message : JSON.stringify(json?.message)]
              .filter(Boolean)
              .join(': ') || text.slice(0, 200)
          }`,
        )
      }
      return json
    }
  })
}

export interface ScrapeResult {
  ok: boolean
  /** Error code such as WEBSITE_BLOCKED or REQUEST_TIMEOUT when the page could not be read. */
  error?: string
  markdown?: string
  json?: any
  title?: string
  credits: number
}

export interface ScrapeOptions {
  markdown?: boolean
  /** Extract an object in this JSON Schema from the page (5 credits instead of 1). */
  json?: { schema: object; instructions?: string }
}

/** Read one page as Markdown and/or as an object in the given schema. */
export async function scrape(url: string, options: ScrapeOptions): Promise<ScrapeResult> {
  const body: Record<string, unknown> = {
    url,
    formats: { ...(options.markdown ? { markdown: true } : {}), ...(options.json ? { json: true } : {}) },
  }
  if (options.json) body.jsonParams = options.json

  let json: any
  try {
    json = await post('/web/scrape', {
      body: JSON.stringify(body),
      contentType: 'application/json',
      timeoutMs: 150_000,
    })
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error), credits: 0 }
  }

  const credits = json?.key_metadata?.credits_consumed ?? 0
  const failed = [json?.markdown, json?.json].find((part) => part?.requested && !part.success)
  // A page that came back but is only a login wall or an empty shell is as useless as a
  // failed one; the callers check the content they need.
  return {
    ok: !failed,
    error: failed?.error_code,
    markdown: json?.markdown?.data ?? undefined,
    json: json?.json?.data ?? undefined,
    title: json?.metadata?.title ?? undefined,
    credits,
  }
}

/** Look a person up from a profile URL such as a LinkedIn link. Null when not found. */
export async function enrichPerson(profileUrl: string): Promise<{ person: any; credits: number } | null> {
  const json = await post('/people/enrich', {
    body: JSON.stringify({ social_urls: [profileUrl] }),
    contentType: 'application/json',
    timeoutMs: 60_000,
  })
  if (json?.match?.status !== 'candidate' || !json.match.person) return null
  return { person: json.match.person, credits: json?.key_metadata?.credits_consumed ?? 0 }
}

/** Convert an uploaded file (a CV as PDF or DOCX) into Markdown text. */
export async function parseFile(bytes: Uint8Array, extension: string): Promise<{ markdown: string; credits: number }> {
  const params = new URLSearchParams({ extension, includeImages: 'false', includeLinks: 'true' })
  // OCR is off by default. Enable it even for mixed PDFs whose first pages have a text layer.
  if (extension.toLowerCase() === 'pdf') params.set('ocr', 'true')
  const json = await post(`/parse?${params}`, {
    body: bytes as BodyInit,
    contentType: 'application/octet-stream',
    timeoutMs: 120_000,
  })
  if (json?.success === false || typeof json?.markdown !== 'string')
    throw new Error('Context.dev /parse: invalid or unsuccessful response')
  return { markdown: json.markdown, credits: json?.key_metadata?.credits_consumed ?? 0 }
}
