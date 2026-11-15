import { describe, expect, it } from 'vite-plus/test'
import { computeSignals } from './signals.ts'
import { applicantRow } from './storage-d1.ts'
import type { Applicant, Source } from './types.ts'

const source = (extra: Partial<Source> = {}): Source => ({
  url: 'cv',
  platform: 'cv',
  basis: 'claimed',
  status: 'ok',
  pages: 1,
  credits: 1,
  fetchedAt: '2026-11-14T00:00:00Z',
  ...extra,
})

const applicant = (sources: Source[], extra: Partial<Applicant> = {}): Applicant => ({
  id: 'a1',
  alias: 'Applicant 001',
  declaredFields: [],
  links: [],
  hasCv: true,
  sources,
  signals: computeSignals([]),
  createdAt: '2026-11-14T00:00:00Z',
  ...extra,
})

describe('applicantRow', () => {
  it('is the applicant as JSON, CV text included, while it is small', () => {
    const small = applicant([source({ markdown: '# CV' })])
    expect(JSON.parse(applicantRow(small))).toEqual(small)
  })

  it('drops the converted CV text of a row that would be too large, and nothing else', () => {
    const large = applicant([source({ markdown: 'x'.repeat(300_000) }), source({ url: 'https://github.com/a' })])
    const stored = JSON.parse(applicantRow(large)) as Applicant
    expect(stored.sources.map((s) => s.markdown)).toEqual([undefined, undefined])
    expect(stored.sources.map((s) => s.url)).toEqual(['cv', 'https://github.com/a'])
    expect(stored.alias).toBe('Applicant 001')
  })

  it('refuses a row that is too large without it', () => {
    expect(() => applicantRow(applicant([], { links: ['x'.repeat(300_000)] }))).toThrow(/too large/)
  })
})
