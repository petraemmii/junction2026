# Overlap

pnpm workspace (pnpm 10.34.3, Node 22) on the Vite+ toolchain (`vp`). See README.md for commands.

## Layout

- `apps/app` (`@overlap/app`): the Figma Make app. React 19, Vite (via Vite+), Tailwind CSS v4.
  Entry `src/main.tsx` → `src/App.tsx`; global CSS and theme in `src/index.css`;
  `vite.config.ts` holds the Figma Make plugins and reads `.figma/make/site.json`. Its `base` is
  `FIGMA_PUBLIC_URL` (Figma Make), else `APP_BASE`, else `/`.
- `apps/landing` (`@overlap/landing`): the landing page. Astro 7 static output, React islands
  (`client:*`), Tailwind CSS v4 in `src/styles/global.css`, fonts via Astro's Fonts API in
  `astro.config.ts`, deployed as the static files of the site's Cloudflare Worker (`wrangler.jsonc`,
  `public/_headers`) on the route `junction2026.com/submission*`. Its `base` is `SITE_BASE` (default
  `/`); `sitePath` in `src/lib/base.ts` puts a root-relative URL below it. Layout
  `src/layouts/BaseLayout.astro`, pages in `src/pages/`. Demo events
  and their search in `src/data/events.ts`; card images rendered by `src/pages/events/[id].webp.ts`.
  `vite.config.ts` holds only the test settings (Astro does not read it). `src/pages/get-started.astro`
  (parts and CSS in `src/components/get-started/`, photo `src/assets/get-started-crowd.webp`): the
  login-style page every "Get started" goes to (`GET_STARTED_URL`); it opens the platform
  (`PLATFORM_URL`: the pre-selection app's organiser view when it runs, else the app) with the handoff
  query `?from=get-started`, which the app (`apps/app/src/lib/handoff.ts`) answers by skipping its login.
  `src/worker/` is the Worker's script (`main` in `wrangler.jsonc`): `handler.ts` hands the backend's
  paths to the backend's server and every other path that is not a file back to the static assets
  (the 404 page), and sets the backend's response headers; `backend.mjs` (written by `build:site`,
  not committed, typed by `backend.d.mts`) is the backend it bundles, or none.
- `apps/preselect` (`@overlap/preselect`): the pre-selection backend, Astro 7 server-rendered: the
  organiser view (`src/pages/index.astro`) and the API (`src/pages/api/`, `apply.ts` reads a profile
  through Context.dev). Two targets (`astro.config.mjs`): a Node server at the root of its origin
  with JSON files in `data/` (the default: `astro dev`, port 4322, `astro build`), and Cloudflare
  Workers below `PRESELECT_BASE` with a D1 database (`PRESELECT_TARGET=workers`, set by `build:site`;
  output in `dist/workers/`). What differs is in `#runtime` (`imports` in its `package.json`):
  `src/lib/runtime.node.ts`, or `runtime.workers.ts` under the `workerd` condition. Storage:
  `src/lib/storage.ts` (the interface), `storage-files.ts` (on `store.ts`, which the Node scripts in
  `scripts/` use directly), `storage-d1.ts`. See `apps/preselect/README.md`.
- `scripts/build-site.mjs` (`vp run build:site`): the deployed site in `apps/landing/dist`, built for
  `SITE_URL` and `SITE_BASE`, by default `https://junction2026.com` and `/submission/`
  (`scripts/site-target.mjs`, with the pure helpers it uses). Below a base: the landing page in
  `dist/submission/`, its home page as `dist/submission.html` (served at `/submission`), the app in
  `dist/submission/app/`, and `_headers` (rule paths prefixed), `.assetsignore` and a copy of
  `404.html` at the root of `dist/`. `SITE_BASE=/` builds for the root (`/`, `/app/`). Skips the app
  when `PUBLIC_APP_URL` is set. It also builds the backend for Workers, copies its client files to
  `dist/submission/preselect/` and writes `apps/landing/src/worker/backend.mjs`; the backend's
  server stays in `apps/preselect/dist/workers/server/`, outside `dist/`. `PUBLIC_PRESELECT_URL`
  (`preselectTarget` in `site-target.mjs`): unset bundles the backend at `<base>preselect`, a URL is
  a backend elsewhere, empty is no backend. The landing `preview` and `deploy` scripts run it first.
- `.figma/make/`: Figma Make scripts (install, dev, deploy, format). They run from the repo root
  with plain `pnpm` and target `apps/app`.
- Root `vite.config.ts`: workspace-wide `fmt` and `lint` settings (with per-app `overrides`) and
  `test.projects`. `pnpm-workspace.yaml`: packages, the Vite+ `vite` override and catalog,
  `minimumReleaseAge`.

## Rules

- In Figma Make, the app's dev server is already running on `$PORT` (default 8443) with hot reload.
- Run package scripts with `vp run <script>` (`vp run --filter <package> <script>` for one app).
  `vp dev` / `vp build` are Vite+ built-ins and do not run the Astro scripts.
- Before finishing: `vp run check`: `astro check` of the landing page (it also generates the
  `.astro/` types that `vp check` needs on a fresh clone), then `vp check` (format, lint, type
  check), then `vp test`.
- Tests: `*.test.ts` next to the module they test, importing from `vite-plus/test`; never under
  `apps/landing/src/pages/` (Astro routes every file there). A new package with tests goes into
  `test.projects` in the root `vite.config.ts` (`scripts/` is one; it has no Node types, so tests
  that read files live in `apps/landing`). D1 is tested on SQLite (`node:sqlite`) behind a small
  fake (`apps/preselect/src/lib/storage.test.ts`).
- Do not edit, format or lint-fix the ReactDrops files in `apps/landing/src/components`
  (`chromatic-*`, `depth-*`, `liquid-glass-orb*`, `soap-bubble/`); they are vendored verbatim.
- Likewise islandcn in `apps/landing/src/lib/island/` and `apps/landing/src/components/islandcn/`
  (upstream commit `0011a41`, MIT, `LICENSE` beside the engine): vendored verbatim, never edit,
  format or lint-fix them.
- The landing page is served below a base (`/submission`): every root-relative URL it emits or
  navigates to goes through `sitePath` (`apps/landing/src/lib/base.ts`), never a literal `"/..."`.
  Astro prefixes its own output (`_astro/`, fonts, images).
- The app's path `/app/` (below the base) appears in `scripts/site-target.mjs` (`APP_PATH`),
  `apps/landing/src/config.ts` (`APP_PATH`) and `apps/landing/public/_headers`; change them together
  (`apps/landing/src/config.test.ts` checks).
- The Worker route in `apps/landing/wrangler.jsonc` (`junction2026.com/submission*`) and
  `DEFAULT_SITE_URL` / `DEFAULT_SITE_BASE` in `scripts/site-target.mjs` describe the same place;
  change them together (`apps/landing/src/config.test.ts` checks).
- The backend's path `/preselect/` (below the base) is `PRESELECT_PATH` in `scripts/site-target.mjs`
  and the `/preselect/_astro/*` rule of `apps/landing/public/_headers`; change them together
  (`apps/landing/src/config.test.ts` checks). Under a base, nothing in the backend may point at the
  origin's root: use `basePath` (`apps/preselect/src/lib/base.ts`).
- `apps/landing/wrangler.jsonc` is the only deploy config. `apps/preselect/workers/wrangler.jsonc`
  only tells the backend's Workers build which runtime it builds for: keep `compatibility_date`
  and `compatibility_flags` the same in both (`apps/landing/src/config.test.ts` checks). Keep
  `assets_navigation_has_no_effect`: without it, browsers get the 404 page for the organiser view
  (page loads of paths that are not files would skip the Worker), while `curl` still gets the page.
- Secrets (`CONTEXT_DEV_API_KEY`, `LINKEDIN_*`) are never in a file that git tracks or in a build.
  The backend reads them through `setting` (`apps/preselect/src/lib/settings.ts`) when a request
  needs them: on Node from the environment or `apps/preselect/.env`, on Workers from the Worker's
  secrets (`wrangler secret put`; `apps/landing/.dev.vars` for `wrangler dev`). No `.env` or
  `.dev.vars` in `apps/preselect/workers/`: the Workers build copies one from there into its output
  (`build:site` fails if that happens).
- Backend code that runs on both servers uses no `node:` module and no `process.env`; what needs
  them goes behind `#runtime`. Request handlers use the async `storage` from `#runtime`, never
  `store.ts` directly. Do not export anything but handlers from a file in `src/pages/api/`.
- The deployed organiser view and apply endpoint are public (no login). Every read of an
  application spends Context.dev credits: keep the hourly cap (`MAX_READS_PER_HOUR`, counted in the
  process and, on Workers, in D1 by `reserveRead`).
- The handoff query (`HANDOFF_PARAM`, `HANDOFF_VALUE`) lives in both `apps/landing/src/config.ts` and
  `apps/app/src/lib/handoff.ts`; change them together (`apps/landing/src/config.test.ts` checks).
- `_headers`: a request gets the headers of every matching rule, in file order. To change a header
  for a sub-path, remove it with `! Name` in a later rule, then set it again. The app's page
  (`/app/`) has its own Content-Security-Policy; anything the app loads from another origin must be
  allowed there. Write rule paths for a site at the root: `build:site` prefixes them with the base
  in `dist/_headers` (`/*` becomes `/submission*`, `/app/` becomes `/submission/app/`).
- Packages that have a `vite` peer dependency also declare `"vite": "catalog:"` so the workspace
  keeps a single Vite instance.
- Tailwind CSS v4: no tailwind.config file. Use utility classes; put global element styles in
  `@layer base` so utilities can override them; theme tokens live in each app's CSS entry.
