import { describe, expect, it, vi } from 'vite-plus/test'

import { createFetch, isBackendPath, withSecurityHeaders } from './handler'
import type { Backend } from './handler'

const PATH = '/submission/preselect'
const assets = () => ({ ASSETS: { fetch: vi.fn(async () => new Response('the 404 page', { status: 404 })) } })
const backend = (response: () => Response): Backend & { fetch: ReturnType<typeof vi.fn> } => ({
  fetch: vi.fn(async () => response()),
})
const get = (path: string, init?: RequestInit) => new Request(`https://junction2026.com${path}`, init)

describe('isBackendPath', () => {
  it('is the backend’s path and everything below it, nothing beside it', () => {
    for (const path of [PATH, `${PATH}/`, `${PATH}/api/apply`]) expect(isBackendPath(path, PATH), path).toBe(true)
    for (const path of ['/submission', '/submission/preselection', '/submission/app/', '/preselect/']) {
      expect(isBackendPath(path, PATH), path).toBe(false)
    }
  })
})

describe('the Worker’s fetch', () => {
  it('hands the backend’s paths to the backend, with the Worker’s bindings', async () => {
    const server = backend(() => Response.json({ ok: true }))
    const env = assets()
    const context = {}
    const request = get(`${PATH}/api/apply`, { method: 'POST' })
    const response = await createFetch(server, PATH)(request, env, context)
    expect(await response.json()).toEqual({ ok: true })
    expect(server.fetch).toHaveBeenCalledWith(request, env, context)
    expect(env.ASSETS.fetch).not.toHaveBeenCalled()
  })

  it('hands every other path back to the static assets', async () => {
    const server = backend(() => new Response('organiser'))
    const env = assets()
    for (const path of ['/submission/nope', '/submissions', '/submission/preselection']) {
      const response = await createFetch(server, PATH)(get(path), env, {})
      expect(response.status, path).toBe(404)
    }
    expect(server.fetch).not.toHaveBeenCalled()
  })

  it('serves a site without a backend from the static assets alone', async () => {
    const env = assets()
    const response = await createFetch(null, null)(get(`${PATH}/`), env, {})
    expect(await response.text()).toBe('the 404 page')
  })

  it('answers with the site’s 404 page where the backend has no page', async () => {
    const server = backend(
      () => new Response('<h1>404</h1>', { status: 404, headers: { 'Content-Type': 'text/html' } }),
    )
    const env = assets()
    const response = await createFetch(server, PATH)(get(`${PATH}/nope`), env, {})
    expect(await response.text()).toBe('the 404 page')
    // An API answer of 404 is the API's own.
    const api = backend(() => Response.json({ error: 'none' }, { status: 404 }))
    expect(await (await createFetch(api, PATH)(get(`${PATH}/api/x`), env, {})).json()).toEqual({ error: 'none' })
  })

  it('answers 500 when the backend throws', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const server: Backend = {
      fetch: () => {
        throw new Error('boom')
      },
    }
    const response = await createFetch(server, PATH)(get(`${PATH}/`), assets(), {})
    expect(response.status).toBe(500)
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff')
    expect(error).toHaveBeenCalled()
    error.mockRestore()
  })
})

describe('withSecurityHeaders', () => {
  it('gives a page the landing page’s kind of policy and an API answer a closed one', () => {
    const page = withSecurityHeaders(new Response('<p>', { headers: { 'Content-Type': 'text/html' } }))
    expect(page.headers.get('Content-Security-Policy')).toContain("script-src 'self' 'unsafe-inline'")
    expect(page.headers.get('X-Frame-Options')).toBe('DENY')
    expect(page.headers.get('Cache-Control')).toBe('no-store')
    const data = withSecurityHeaders(Response.json({}))
    expect(data.headers.get('Content-Security-Policy')).toBe("default-src 'none'; frame-ancestors 'none'")
    expect(data.headers.get('X-Content-Type-Options')).toBe('nosniff')
  })

  it('keeps the headers a response already has, and its status', () => {
    const response = withSecurityHeaders(
      new Response(null, {
        status: 302,
        headers: { Location: 'https://www.linkedin.com/', 'Cache-Control': 'private' },
      }),
    )
    expect(response.status).toBe(302)
    expect(response.headers.get('Location')).toBe('https://www.linkedin.com/')
    expect(response.headers.get('Cache-Control')).toBe('private')
  })
})
