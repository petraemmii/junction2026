// The path this server is served below: "" at the root of its origin (Node), "/submission/preselect"
// in the composed site's Worker (Astro's `base`, PRESELECT_BASE in astro.config.mjs).
const BASE = import.meta.env.BASE_URL.replace(/\/+$/, '')

/** `path`, written for a server at the root ("/api/linkedin/callback"), below the base. */
export const basePath = (path: string): string => `${BASE}${path}`
