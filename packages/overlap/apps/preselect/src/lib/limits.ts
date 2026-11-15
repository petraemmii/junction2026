// Limits on what the public apply endpoint accepts, enforced before any of it is parsed.
// Server-side only.

/** The largest CV that is read. */
export const MAX_CV_BYTES = 10 * 1024 * 1024
/** A JSON application is a few links and field names. */
export const MAX_JSON_BYTES = 64 * 1024
/** Form data is the same text and the CV, with room for the multipart framing. */
export const MAX_FORM_BYTES = MAX_CV_BYTES + 1024 * 1024
/**
 * The text an applicant types: links and a few words around them. Finding the links in it
 * (parseLinks) takes time that grows faster than its length, so a long text is refused, not read.
 */
export const MAX_TEXT_CHARS = 10_000

/**
 * The request with its body read into memory, or null when the body is larger than an application
 * can be. request.json() and request.formData() read a body whole whatever its size, so the body
 * is read here first, and no further than the limit: a declared size over it is refused unread,
 * and an undeclared or understated one is dropped as soon as it has passed the limit.
 */
export async function withinLimits(request: Request): Promise<Request | null> {
  const json = request.headers.get('content-type')?.includes('application/json') ?? false
  const limit = json ? MAX_JSON_BYTES : MAX_FORM_BYTES
  if (Number(request.headers.get('content-length')) > limit) return null

  const chunks: Uint8Array[] = []
  let size = 0
  if (request.body) {
    const reader = request.body.getReader()
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > limit) {
        await reader.cancel()
        return null
      }
      chunks.push(value)
    }
  }
  const body = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    body.set(chunk, offset)
    offset += chunk.byteLength
  }
  return new Request(request.url, { method: request.method, headers: request.headers, body })
}
