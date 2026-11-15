// Types of ./backend.mjs, which the root `build:site` script writes (scripts/build-site.mjs) and
// git ignores: the pre-selection backend bundled into the site's Worker.
import type { Backend } from './handler'

/** The Workers build of apps/preselect (apps/preselect/dist/workers/server), or null without one. */
export const server: Backend | null
/** The path the backend is served below ("/submission/preselect"), or null without one. */
export const path: string | null
