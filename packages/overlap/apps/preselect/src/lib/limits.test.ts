import { describe, expect, it } from 'vite-plus/test'
import { MAX_FORM_BYTES, MAX_JSON_BYTES, withinLimits } from './limits.ts'

const post = (body: BodyInit, headers: Record<string, string>) =>
  new Request('https://example.com/api/apply', { method: 'POST', headers, body })

describe('withinLimits', () => {
  it('hands on an application of a possible size, body and headers intact', async () => {
    const request = await withinLimits(post('{"text":"github.com/a"}', { 'content-type': 'application/json' }))
    expect(request?.headers.get('content-type')).toBe('application/json')
    expect(await request?.json()).toEqual({ text: 'github.com/a' })

    const form = new FormData()
    form.set('text', 'github.com/a')
    form.set('cv', new File(['# CV'], 'cv.md'))
    const sent = await withinLimits(new Request('https://example.com/api/apply', { method: 'POST', body: form }))
    const read = await sent?.formData()
    expect(read?.get('text')).toBe('github.com/a')
    expect((read?.get('cv') as File).size).toBe(4)
  })

  it('refuses a body that declares more than an application can be, without reading it', async () => {
    // A body that never ends: reading it would never return.
    const request = new Request('https://example.com/api/apply', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'content-length': String(MAX_JSON_BYTES + 1) },
      body: new ReadableStream(),
      // @ts-expect-error Node needs this for a stream as a body; the DOM types do not know it.
      duplex: 'half',
    })
    expect(await withinLimits(request)).toBeNull()
  })

  it('stops reading a body that turns out larger than it declared', async () => {
    const json = post('x'.repeat(MAX_JSON_BYTES + 1), { 'content-type': 'application/json' })
    expect(await withinLimits(json)).toBeNull()
    const form = post(new Uint8Array(MAX_FORM_BYTES + 1), { 'content-type': 'multipart/form-data; boundary=x' })
    expect(await withinLimits(form)).toBeNull()
  })

  it('allows form data the size of the largest CV', async () => {
    const form = post(new Uint8Array(MAX_FORM_BYTES), { 'content-type': 'multipart/form-data; boundary=x' })
    expect(await withinLimits(form)).not.toBeNull()
  })
})
