// The hourly cap on applications that spend Context.dev credits (src/pages/api/apply.ts).
import { beforeEach, expect, it, vi } from 'vite-plus/test'
import { collectApplicant } from './collect.ts'
import { computeSignals } from './signals.ts'
import { MAX_READS_PER_HOUR } from './storage.ts'
import type { Applicant } from './types.ts'

vi.mock('./collect.ts', () => ({ collectApplicant: vi.fn() }))
const storage = {
  applicants: vi.fn(async (): Promise<Applicant[]> => []),
  companies: vi.fn(async () => []),
  saveApplicant: vi.fn(async () => {}),
  saveDocument: vi.fn(async () => {}),
  reserveRead: vi.fn(async () => true),
}
vi.mock('#runtime', () => ({ storage, envValue: () => undefined, ENV_SOURCES: 'the test' }))

beforeEach(() => {
  vi.clearAllMocks()
  // A new module, so a new count for this process.
  vi.resetModules()
  storage.reserveRead.mockResolvedValue(true)
  vi.mocked(collectApplicant).mockImplementation(async (input) => ({
    id: 'new-id',
    alias: input.alias ?? 'Applicant 001',
    links: input.links,
    hasCv: false,
    declaredFields: input.declaredFields,
    sources: [],
    signals: computeSignals([]),
    createdAt: '2026-11-15T00:00:00Z',
  }))
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

async function apply(name: string) {
  const { POST } = await import('../pages/api/apply.ts')
  return POST({
    request: new Request('http://localhost/api/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: `https://github.com/${name}` }),
    }),
  } as Parameters<typeof POST>[0])
}

it('answers 429 without reading anything once the store has no read left this hour', async () => {
  storage.reserveRead.mockResolvedValue(false)
  const response = await apply('ada')
  expect(response.status).toBe(429)
  expect(await response.json()).toEqual({ error: 'Too many applications right now. Try again in a while.' })
  expect(storage.reserveRead).toHaveBeenCalledWith(MAX_READS_PER_HOUR)
  expect(collectApplicant).not.toHaveBeenCalled()
  expect(storage.saveApplicant).not.toHaveBeenCalled()
})

it('answers 429 once this process has read the cap in an hour, before asking the store', async () => {
  for (let i = 0; i < MAX_READS_PER_HOUR; i++)
    expect((await apply(`user${i}`)).status, `application ${i + 1}`).toBe(200)
  expect(storage.reserveRead).toHaveBeenCalledTimes(MAX_READS_PER_HOUR)
  const response = await apply('one-too-many')
  expect(response.status).toBe(429)
  expect(storage.reserveRead).toHaveBeenCalledTimes(MAX_READS_PER_HOUR)
  expect(collectApplicant).toHaveBeenCalledTimes(MAX_READS_PER_HOUR)
})
