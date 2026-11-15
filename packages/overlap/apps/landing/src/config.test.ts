import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vite-plus/test'

import {
  APP_PATH,
  DEFAULT_SITE_BASE,
  DEFAULT_SITE_URL,
  PRESELECT_PATH,
  normalizeBase,
} from '../../../scripts/site-target.mjs'
import {
  APP_DEV_URL,
  APP_PATH as LANDING_APP_PATH,
  HANDOFF_PARAM,
  HANDOFF_VALUE,
  PRESELECT_DEV_URL,
  platformEntryFields,
  platformEntryUrl,
} from './config'

describe('the platform entry URL from /get-started', () => {
  it('adds the handoff to a relative URL', () => {
    expect(platformEntryUrl('/app/')).toBe('/app/?from=get-started')
    expect(platformEntryUrl('app')).toBe('app?from=get-started')
    // The organiser view of the backend in the site's Worker (PUBLIC_PRESELECT_URL from `build:site`).
    expect(platformEntryUrl('/submission/preselect/')).toBe('/submission/preselect/?from=get-started')
  })

  it('adds the handoff to an absolute URL', () => {
    // The organiser view in development (PRESELECT_URL).
    expect(platformEntryUrl('http://localhost:4322/')).toBe('http://localhost:4322/?from=get-started')
    expect(platformEntryUrl('https://app.example.com')).toBe('https://app.example.com?from=get-started')
    expect(platformEntryUrl('https://app.example.com/overlap/')).toBe(
      'https://app.example.com/overlap/?from=get-started',
    )
  })

  it('keeps the URL’s own query and hash', () => {
    expect(platformEntryUrl('/app/?lang=fi')).toBe('/app/?lang=fi&from=get-started')
    expect(platformEntryUrl('/app/#events')).toBe('/app/?from=get-started#events')
    expect(platformEntryUrl('https://app.example.com/?a=1&b=2#top')).toBe(
      'https://app.example.com/?a=1&b=2&from=get-started#top',
    )
    // A "?" in the hash belongs to the hash.
    expect(platformEntryUrl('/app/#/x?y=1')).toBe('/app/?from=get-started#/x?y=1')
    expect(platformEntryUrl('/app/?')).toBe('/app/?from=get-started')
  })

  it('sets the handoff once, also where the URL already has the parameter', () => {
    expect(platformEntryUrl('/app/?from=elsewhere&lang=fi')).toBe('/app/?from=get-started&lang=fi')
  })

  it('is what the form on /get-started submits', () => {
    // A GET form replaces its action's query with its fields and keeps the action's hash.
    const submitted = (action: string) => {
      const hashAt = action.indexOf('#')
      const hash = hashAt === -1 ? '' : action.slice(hashAt)
      const path = action.replace(/[?#].*$/, '')
      return `${path}?${new URLSearchParams(platformEntryFields(action))}${hash}`
    }
    for (const url of ['/app/', '/app/?lang=fi#events', 'https://app.example.com/?a=1&b=2#top']) {
      expect(submitted(url), url).toBe(platformEntryUrl(url))
    }
    expect(platformEntryFields('/app/')).toEqual([['from', 'get-started']])
  })
})

describe('the handoff', () => {
  // The app reads the query in its own source; the two apps share no code. Keep them in step.
  const app = readFileSync(new URL('../../app/src/lib/handoff.ts', import.meta.url), 'utf8')
  const constant = (name: string) => new RegExp(`export const ${name} = '([^']*)'`).exec(app)?.[1]

  it('has the same query name and value in the app (apps/app/src/lib/handoff.ts)', () => {
    expect(constant('HANDOFF_PARAM')).toBe(HANDOFF_PARAM)
    expect(constant('HANDOFF_VALUE')).toBe(HANDOFF_VALUE)
  })
})

describe('the dev servers', () => {
  // The landing page, the app and the backend name each other's dev URLs in their own sources.
  const read = (file: string) => readFileSync(new URL(file, import.meta.url), 'utf8')
  const appClient = read('../../app/src/lib/preselect.ts')
  const appConfig = read('../../app/vite.config.ts')
  const preselectConfig = read('../../preselect/astro.config.mjs')
  const cors = read('../../preselect/src/lib/cors.ts')
  const allowed = /const DEFAULT_ORIGINS = '([^']*)'/.exec(cors)?.[1]?.split(',') ?? []

  it('has the backend at the same dev URL for the app’s shortlist (apps/app/src/lib/preselect.ts)', () => {
    expect(appClient).toContain(`import.meta.env.DEV ? '${PRESELECT_DEV_URL}' : ''`)
    expect(preselectConfig).toContain(`port: ${new URL(PRESELECT_DEV_URL).port}`)
  })

  it('has the app at its dev server’s port (apps/app/vite.config.ts)', () => {
    expect(appConfig).toContain(`process.env.PORT || '${new URL(APP_DEV_URL).port}'`)
  })

  it('lets the landing page and the app call the backend in development (apps/preselect/src/lib/cors.ts)', () => {
    expect(allowed).toEqual(expect.arrayContaining([new URL(APP_DEV_URL).origin, 'http://localhost:4321']))
  })
})

describe('the deploy target', () => {
  // The Worker route, the base `build:site` builds for and the app's path are written in several
  // files that share no code. Keep them in step.
  const read = (file: string) => readFileSync(new URL(file, import.meta.url), 'utf8')
  const wrangler = read('../wrangler.jsonc')
  const routes = [...wrangler.matchAll(/"pattern":\s*"([^"]*)",\s*"zone_name":\s*"([^"]*)"/g)]

  it('has one Worker route, for the default origin and base (scripts/site-target.mjs)', () => {
    const site = new URL(DEFAULT_SITE_URL)
    expect(site.pathname, 'DEFAULT_SITE_URL is an origin').toBe('/')
    expect(routes.map(([, pattern, zone]) => [pattern, zone])).toEqual([
      [`${site.host}${normalizeBase(DEFAULT_SITE_BASE).slice(0, -1)}*`, site.host],
    ])
  })

  it('has the same app path in the build script, config.ts and public/_headers', () => {
    expect(LANDING_APP_PATH).toBe(APP_PATH)
    const rules = read('../public/_headers')
      .split(/\r?\n/)
      .filter((line) => line.startsWith('/'))
    expect(rules).toEqual(expect.arrayContaining([APP_PATH, `${APP_PATH}sw.js`, `${APP_PATH}assets/*`]))
  })

  it('has the backend’s path in the build script and public/_headers, beside the app’s', () => {
    expect(PRESELECT_PATH).toMatch(/^\/[\w-]+\/$/)
    expect(PRESELECT_PATH).not.toBe(APP_PATH)
    const rules = read('../public/_headers')
      .split(/\r?\n/)
      .filter((line) => line.startsWith('/'))
    expect(rules).toContain(`${PRESELECT_PATH}_astro/*`)
  })
})

describe('the Worker', () => {
  // The Worker's config (wrangler.jsonc) and the files it names share no code with them. The
  // backend is built for Workers with its own config (apps/preselect/workers/wrangler.jsonc), which
  // must describe the same runtime.
  const read = (file: string) => readFileSync(new URL(file, import.meta.url), 'utf8')
  /** A JSONC file as an object: whole-line comments and trailing commas removed. */
  const jsonc = (file: string) =>
    JSON.parse(
      read(file)
        .replace(/^\s*\/\/.*$/gm, '')
        .replace(/,(\s*[}\]])/g, '$1'),
    )
  const worker = jsonc('../wrangler.jsonc')
  const backendBuild = jsonc('../../preselect/workers/wrangler.jsonc')

  it('runs the entry in src/worker, with the static assets bound for the 404 page', () => {
    expect(worker.main).toBe('./src/worker/index.ts')
    expect(() => read(`../${worker.main}`)).not.toThrow()
    expect(worker.assets).toMatchObject({
      directory: './dist',
      binding: 'ASSETS',
      not_found_handling: '404-page',
      html_handling: 'auto-trailing-slash',
    })
    // Static files are served without running the Worker.
    expect(worker.assets.run_worker_first).toBeUndefined()
    expect(worker.workers_dev).toBe(false)
    expect(worker.preview_urls).toBe(false)
  })

  it('binds the backend’s D1 database as DB, the name its storage asks for', () => {
    expect(worker.d1_databases).toEqual([
      { binding: 'DB', database_name: 'overlap-preselect', database_id: expect.stringMatching(/^[\da-f-]{36}$/) },
    ])
    expect(read('../../preselect/src/lib/runtime.workers.ts')).toContain('bindings.DB')
  })

  it('has the runtime the backend is built for (apps/preselect/workers/wrangler.jsonc)', () => {
    expect(worker.compatibility_flags).toContain('nodejs_compat')
    expect(backendBuild.compatibility_date).toBe(worker.compatibility_date)
    expect(backendBuild.compatibility_flags).toEqual(worker.compatibility_flags)
    // The backend's own config is for its build only: it names no route and no data.
    expect(backendBuild.name).not.toBe(worker.name)
    expect(backendBuild.routes).toBeUndefined()
    expect(backendBuild.d1_databases).toBeUndefined()
  })

  it('keeps secrets out of the config and out of git', () => {
    expect(worker.vars).toBeUndefined()
    for (const file of ['../.gitignore', '../../preselect/.gitignore'])
      expect(read(file), file).toMatch(/^\.dev\.vars\*$/m)
  })
})
