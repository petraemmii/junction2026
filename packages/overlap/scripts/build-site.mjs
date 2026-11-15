// Builds the site that apps/landing/wrangler.jsonc deploys: into apps/landing/dist the landing page,
// the app below it at app/ and the client files of the pre-selection backend at preselect/; beside
// it the backend's server, which Wrangler bundles into the Worker. Run it with `vp run build:site`
// or `pnpm run build:site`.
//
// The site is built for SITE_URL (its origin, for canonical and Open Graph URLs) and SITE_BASE (the
// path it is served below). Unset, they are https://junction2026.com and /submission/
// (scripts/site-target.mjs), where the Worker route in wrangler.jsonc serves it. `SITE_BASE=/`
// builds for the root of an origin: the landing page at /, the app at /app/.
//
//   1. apps/app        `build` script with APP_BASE=<base>app/ (skipped when PUBLIC_APP_URL is set)
//   2. apps/preselect  `build` script for Cloudflare Workers (PRESELECT_TARGET=workers) with
//                      PRESELECT_BASE=<base>preselect, into apps/preselect/dist/workers (skipped
//                      when PUBLIC_PRESELECT_URL is set)
//   3. apps/landing    `build` script with SITE_URL, SITE_BASE and PUBLIC_PRESELECT_URL (astro
//                      build, which empties apps/landing/dist first)
//   4. below a base: the landing build is moved into dist/<base>/, its home page to
//      dist/<base>.html, and `_headers` (rules prefixed with the base), `.assetsignore` and a copy
//      of 404.html to the root of dist/; robots.txt is dropped (it only counts at an origin's root)
//   5. apps/app/dist is copied to dist/<base>app/
//   6. the backend's client files (its _astro/) are copied to dist/<base>preselect/. Its server
//      stays where it was built, outside dist/, so none of it is ever served as a file;
//      apps/landing/src/worker/backend.mjs is written to point the Worker at it (or at nothing).
//
// With PUBLIC_APP_URL set, the landing page opens the app at that URL (APP_URL in
// apps/landing/src/config.ts), so the app is neither built nor bundled.
//
// PUBLIC_PRESELECT_URL (`preselectTarget` in site-target.mjs): unset, the backend is part of the
// Worker and the landing page uses it at <base>preselect, on its own origin; a URL is a backend
// deployed elsewhere; empty is a site without one, whose ask box reads no profiles.
//
// "Get started" goes to <base>get-started, on the landing page's own origin. The "Log in" form there
// submits a GET form to the platform (PLATFORM_URL in config.ts): the pre-selection backend's
// organiser view when there is a backend, else the app. When that is on another origin, the origin
// is added to `form-action` in dist/_headers.
import { spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  APP_PATH,
  DEFAULT_SITE_BASE,
  DEFAULT_SITE_URL,
  normalizeBase,
  prefixHeaderRules,
  preselectTarget,
} from './site-target.mjs'

const root = fileURLToPath(new URL('..', import.meta.url))
const appDist = path.join(root, 'apps/app/dist')
const landingDist = path.join(root, 'apps/landing/dist')
// The backend's Workers build (`outDir` in apps/preselect/astro.config.mjs): server/ and client/.
const preselectDist = path.join(root, 'apps/preselect/dist/workers')
const preselectServer = path.join(preselectDist, 'server/entry.mjs')
// What the Worker's entry (apps/landing/src/worker/index.ts) imports the backend from.
const backendModule = path.join(root, 'apps/landing/src/worker/backend.mjs')

// The project-local Vite+ CLI is a Node script: run it with this Node binary (no shell, so it
// behaves the same on every platform, under `vp run` and under plain `pnpm run`).
const require = createRequire(import.meta.url)
const vpManifest = require.resolve('vite-plus/package.json')
const vp = path.join(path.dirname(vpManifest), JSON.parse(readFileSync(vpManifest, 'utf8')).bin.vp)

/** Runs `vp <args>` from the repository root and exits if it fails. */
function runVp(args, env = process.env) {
  console.log(`\n$ vp ${args.join(' ')}`)
  const { status, error } = spawnSync(process.execPath, [vp, ...args], { cwd: root, env, stdio: 'inherit' })
  if (error) throw error
  if (status !== 0) process.exit(status ?? 1)
}

function fail(message) {
  console.error(`\nbuild:site: ${message}`)
  process.exit(1)
}

// Unset means the deploy target; set (even to "" or "/") means exactly that.
const siteUrl = process.env.SITE_URL ?? DEFAULT_SITE_URL
let base = '/'
try {
  base = normalizeBase(process.env.SITE_BASE ?? DEFAULT_SITE_BASE)
} catch (error) {
  fail(error instanceof Error ? error.message : String(error))
}
// "/submission/" -> "submission" (the folder in dist/), "/" -> "".
const baseDir = base.slice(1, -1)
/** The app's URL path: /submission/app/, or /app/ at the root. */
const appBase = `${base}${APP_PATH.slice(1)}`
const target = path.join(landingDist, appBase)

const preselect = preselectTarget(process.env.PUBLIC_PRESELECT_URL, base)

console.log(
  `build:site: building for ${siteUrl || '(no SITE_URL)'}, base ${base}, app at ${appBase}, ` +
    (preselect.bundle ? `backend at ${preselect.path}/` : preselect.url ? `backend ${preselect.url}` : 'no backend'),
)

const externalApp = process.env.PUBLIC_APP_URL

if (externalApp) {
  console.log(`build:site: PUBLIC_APP_URL=${externalApp}, so the app is not built or bundled.`)
} else {
  // FIGMA_PUBLIC_URL takes precedence over APP_BASE in apps/app/vite.config.ts; drop it so a shell
  // that has it set (Figma Make) cannot build the app for the wrong path.
  const env = { ...process.env, APP_BASE: appBase }
  delete env.FIGMA_PUBLIC_URL
  runVp(['run', '--filter', '@overlap/app', 'build'], env)
  if (!existsSync(path.join(appDist, 'index.html'))) fail(`${appDist}/index.html is missing after the app build.`)
}

if (preselect.bundle) {
  const env = { ...process.env, PRESELECT_TARGET: 'workers', PRESELECT_BASE: preselect.path }
  runVp(['run', '--filter', '@overlap/preselect', 'build'], env)
  if (!existsSync(preselectServer)) fail(`${preselectServer} is missing after the backend build.`)
  // The Cloudflare Vite plugin also leaves a deploy redirect to its own output, which would make a
  // `wrangler deploy` run in apps/preselect deploy the backend as a Worker of its own. The site's
  // Worker (apps/landing/wrangler.jsonc) is the only one that is deployed.
  rmSync(path.join(root, 'apps/preselect/.wrangler/deploy'), { recursive: true, force: true })
  // The Cloudflare Vite plugin copies a .dev.vars or .env beside the build's Wrangler config
  // (apps/preselect/workers/) into the server build, for `astro preview`. Secrets do not belong in
  // a build: the Worker gets them from Cloudflare, `wrangler dev` from apps/landing/.dev.vars.
  const copiedSecrets = path.join(path.dirname(preselectServer), '.dev.vars')
  if (existsSync(copiedSecrets)) {
    rmSync(copiedSecrets)
    fail(
      'the backend build copied local secrets into apps/preselect/dist/workers/server/.dev.vars (removed). ' +
        'Take the .dev.vars or .env file out of apps/preselect/workers/ and build again.',
    )
  }
} else {
  console.log(
    preselect.url
      ? `build:site: PUBLIC_PRESELECT_URL=${preselect.url}, so the backend is not built or bundled.`
      : 'build:site: PUBLIC_PRESELECT_URL is empty, so the site has no backend.',
  )
}

runVp(['run', '--filter', '@overlap/landing', 'build'], {
  ...process.env,
  SITE_URL: siteUrl,
  SITE_BASE: base,
  PUBLIC_PRESELECT_URL: preselect.url,
})

if (baseDir) {
  // The Worker's asset server looks a request's full path up in dist/, so the site's files have to
  // sit below dist/<base>/. Astro writes them to the root of dist/ (its `base` only changes URLs).
  const entries = readdirSync(landingDist)
  const top = baseDir.split('/')[0]
  if (entries.includes(top) || entries.includes(`${top}.html`)) {
    fail(`the landing build already has a page at /${top}; it would collide with the base ${base}.`)
  }
  const siteDir = path.join(landingDist, baseDir)
  mkdirSync(siteDir, { recursive: true })
  for (const entry of entries) renameSync(path.join(landingDist, entry), path.join(siteDir, entry))

  // The asset server reads `_headers` and `.assetsignore` only at the root of dist/, and a rule's
  // path is the full request path.
  const headers = readFileSync(path.join(siteDir, '_headers'), 'utf8')
  writeFileSync(path.join(landingDist, '_headers'), prefixHeaderRules(headers, base))
  rmSync(path.join(siteDir, '_headers'))
  renameSync(path.join(siteDir, '.assetsignore'), path.join(landingDist, '.assetsignore'))
  // A robots.txt below the root of an origin means nothing to crawlers.
  rmSync(path.join(siteDir, 'robots.txt'), { force: true })
  // The home page at /submission, without a trailing slash like every other landing page:
  // `html_handling: "auto-trailing-slash"` serves submission.html there, beside the submission/
  // folder, and redirects /submission/ to it.
  renameSync(path.join(siteDir, 'index.html'), `${siteDir}.html`)
  // The 404 page also at the root of dist/: paths the Worker route matches that are not below the
  // base (/submissions) get it too. Below the base, the nearer dist/<base>/404.html answers.
  cpSync(path.join(siteDir, '404.html'), path.join(landingDist, '404.html'))
  console.log(`\nbuild:site: moved the landing build to apps/landing/dist/${baseDir}/ (home page ${baseDir}.html)`)
}

// The landing page's CSP has `form-action 'self'`, which blocks the "Log in" form of /get-started
// when the platform it opens is on another origin. Allow exactly that origin (a relative URL is
// same-origin already, as the bundled backend is). The platform, as in config.ts: the pre-selection
// backend, else the app.
const platform = preselect.url || externalApp
const origin = platform && URL.canParse(platform) ? new URL(platform).origin : null
if (origin && origin !== 'null') {
  const file = path.join(landingDist, '_headers')
  const headers = readFileSync(file, 'utf8')
  const updated = headers.replaceAll("form-action 'self'", `form-action 'self' ${origin}`)
  if (updated === headers) fail(`no "form-action 'self'" in ${file} to add ${origin} to.`)
  writeFileSync(file, updated)
  console.log(`\nbuild:site: added ${origin} to form-action in apps/landing/dist/_headers`)
}

if (!externalApp) {
  // A landing page at the same path (src/pages/app.astro or src/pages/app/) would collide with the app.
  if (existsSync(target) || existsSync(`${target.replace(/[\\/]+$/, '')}.html`)) {
    fail(`the landing build already has a page at ${appBase}; it would collide with the app.`)
  }
  cpSync(appDist, target, { recursive: true })
  console.log(`\nbuild:site: copied apps/app/dist to apps/landing/dist${appBase}`)
}

if (preselect.bundle) {
  // The adapter writes the client files below the backend's base, as their URLs are.
  const client = path.join(preselectDist, 'client', preselect.path)
  const backendTarget = path.join(landingDist, preselect.path)
  if (!existsSync(client)) fail(`${client} is missing after the backend build.`)
  // A landing page at the same path (src/pages/preselect.astro or src/pages/preselect/) would
  // collide with the backend.
  if (existsSync(backendTarget) || existsSync(`${backendTarget}.html`)) {
    fail(`the landing build already has a page at ${preselect.path}; it would collide with the backend.`)
  }
  cpSync(client, backendTarget, { recursive: true })
  console.log(`\nbuild:site: copied the backend's client files to apps/landing/dist${preselect.path}/`)
}

// The module the Worker's entry imports the backend from. Wrangler bundles the Worker when it
// deploys (or runs `wrangler dev`), following this import to the server build, which stays outside
// dist/. Without a backend the Worker only hands requests back to the static assets.
const serverImport = path.relative(path.dirname(backendModule), preselectServer).split(path.sep).join('/')
writeFileSync(
  backendModule,
  [
    "// Written by scripts/build-site.mjs (`vp run build:site`); not committed. What the site's Worker",
    '// (./index.ts) serves below `path`: the Workers build of apps/preselect, or nothing.',
    ...(preselect.bundle
      ? [`export { default as server } from '${serverImport}'`, '', `export const path = '${preselect.path}'`]
      : ['export const server = null', '', 'export const path = null']),
    '',
  ].join('\n'),
)
console.log(
  `\nbuild:site: wrote apps/landing/src/worker/backend.mjs (${preselect.bundle ? `the backend at ${preselect.path}/` : 'no backend'})`,
)
