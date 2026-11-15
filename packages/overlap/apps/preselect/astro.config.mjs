// @ts-check
import { defineConfig } from 'astro/config'
import cloudflare from '@astrojs/cloudflare'
import node from '@astrojs/node'
import react from '@astrojs/react'
import tailwindcss from '@tailwindcss/vite'

// Server-rendered, unlike the static landing page: the API routes call Context.dev and LinkedIn
// with secret keys, so pages and endpoints run on a server. Two targets:
//
// - Node (the default; `astro dev`, `astro build`): a standalone Node server in dist/, at the root
//   of its origin, with its data in data/.
// - Cloudflare Workers (PRESELECT_TARGET=workers, set by the root `build:site` script, which also
//   sets PRESELECT_BASE): the server bundle and client files in dist/workers/, for the Worker of
//   the composed site (apps/landing/wrangler.jsonc), served below PRESELECT_BASE with its data in
//   D1. workers/wrangler.jsonc only tells that build what the Worker's runtime is.
const workers = process.env.PRESELECT_TARGET === 'workers'

export default defineConfig({
  output: 'server',
  ...(workers
    ? {
        base: process.env.PRESELECT_BASE || '/',
        outDir: './dist/workers',
        // No sessions and no image service, so the Worker needs no KV and no Images binding.
        session: false,
        adapter: cloudflare({ imageService: 'passthrough', configPath: './workers/wrangler.jsonc' }),
      }
    : { adapter: node({ mode: 'standalone' }) }),
  integrations: [react()],
  devToolbar: { enabled: false },
  // The landing page uses 4321.
  server: { port: 4322 },
  vite: {
    plugins: [tailwindcss()],
  },
})
