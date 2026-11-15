// The site's Worker (`main` in wrangler.jsonc). Wrangler bundles this file, and with it the
// pre-selection backend's server that ./backend.mjs points at, when it deploys or runs `wrangler dev`.
import { path, server } from './backend.mjs'
import { createFetch } from './handler'

export default { fetch: createFetch(server, path) }
