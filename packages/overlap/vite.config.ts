// Workspace-wide Vite+ settings: formatting (`vp fmt`), linting (`vp lint`) and `vp check`.
// Each app keeps its own build config (apps/app/vite.config.ts, apps/landing/astro.config.ts).
import { defineConfig } from 'vite-plus'

// Vendored third-party code, kept byte-identical to its source: the ReactDrops components (licence
// header included) and islandcn, the Dynamic Island engine and its call preset. Never format or
// lint-fix them; see README.md.
const vendored = [
  'apps/landing/src/components/chromatic-*',
  'apps/landing/src/components/depth-*',
  'apps/landing/src/components/liquid-glass-orb*',
  'apps/landing/src/components/soap-bubble/**',
  'apps/landing/src/lib/island/**',
  'apps/landing/src/components/islandcn/**',
]

// Generated or tool-owned files.
const generated = [
  '**/dist/**',
  '**/.astro/**',
  '**/.wrangler/**',
  'apps/landing/worker-configuration.d.ts',
  // Written by `build:site`: which backend the site's Worker bundles.
  'apps/landing/src/worker/backend.mjs',
]

export default defineConfig({
  // `vp test` at the root runs the tests of these packages, each with the `test` block of its own
  // vite.config.ts.
  test: {
    projects: ['apps/landing', 'apps/preselect', 'scripts'],
  },
  fmt: {
    // The style of the Figma Make template (apps/app/vite.config.ts).
    singleQuote: true,
    semi: false,
    printWidth: 120,
    // .figma/ is owned by Figma Make.
    // apps/*/public/ is copied to the build output byte for byte (a changed sw.js reinstalls the
    // service worker on every client).
    ignorePatterns: ['.figma/**', 'pnpm-lock.yaml', 'apps/*/public/**', ...generated, ...vendored],
  },
  lint: {
    jsPlugins: [{ name: 'vite-plus', specifier: 'vite-plus/oxlint-plugin' }],
    rules: { 'vite-plus/prefer-vite-plus-imports': 'error' },
    options: { typeAware: true, typeCheck: true },
    ignorePatterns: [...generated, ...vendored],
    overrides: [
      {
        // The Figma Make app (Vite + React SPA).
        files: ['apps/app/**'],
        plugins: ['react'],
        env: { browser: true },
      },
      {
        // The service worker runs in a worker scope, not a window.
        files: ['apps/app/public/sw.js'],
        env: { serviceworker: true },
      },
      {
        // The Astro landing page: React islands in src/components, Node at build time.
        files: ['apps/landing/**'],
        plugins: ['react'],
        env: { browser: true, node: true },
      },
    ],
  },
})
