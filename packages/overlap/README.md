# Overlap

Overlap matches talent and companies to events by a fit rating. This repository is a pnpm
workspace on the [Vite+](https://viteplus.dev) toolchain (`vp`) with three apps:

| Path             | Package              | What                                                                                                                         |
| ---------------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `apps/app`       | `@overlap/app`       | The web app: React 19, Vite, Tailwind CSS v4. Built and hosted by Figma Make (`.figma/`).                                    |
| `apps/landing`   | `@overlap/landing`   | The landing page: Astro 7 (static), React islands, Tailwind CSS v4. Static files of the site's Cloudflare Worker.            |
| `apps/preselect` | `@overlap/preselect` | The pre-selection backend: Astro 7 (server-rendered). A Node server in development, part of the site's Worker when deployed. |

`scripts/build-site.mjs` combines the three into one deployable site, served by one Cloudflare
Worker at https://junction2026.com/submission: the landing page at `/submission`, the app at
`/submission/app/` and the pre-selection backend at `/submission/preselect/`.

## Commands

Node.js 22.23.4+ (Astro 7's minimum) and pnpm 10.34.3 (pinned in `.mise.toml` and
`packageManager`). With the
[global `vp` CLI](https://viteplus.dev/guide/global-cli):

```sh
vp install              # install the whole workspace
vp run dev              # app dev server, http://localhost:8443 ($PORT overrides)
vp run dev:landing      # landing, http://localhost:4321, and pre-selection, http://localhost:4322
vp run build            # build both apps on their own (vp run -r build)
vp run build:site       # build the composed site into apps/landing/dist (see below)
vp test                 # unit tests (Vitest)
vp check                # format check, lint and type check of the whole workspace
vp run check            # astro check of the landing page + vp check + vp test
vp fmt                  # format
vp run deploy:landing   # build the composed site and deploy it to junction2026.com/submission
```

Without the global CLI, use `pnpm install` and `pnpm run <script>` (`pnpm test` for the tests);
the scripts call the project-local `vp`. Per app: `vp run --filter @overlap/landing <script>`
(`dev`, `build`, `preview`, `deploy`, `check`) or `vp run --filter @overlap/app <script>` (`dev`,
`build`, `preview`). `vp dev` and `vp build` are Vite+ built-ins that ignore package scripts, so
the Astro app is always started through `vp run`. On a fresh clone, `vp check` reports type errors
in the landing page until an Astro command has generated `apps/landing/.astro/`; `vp run check`
runs `astro check` first for that reason.

## The pre-selection app

`apps/preselect` (`@overlap/preselect`) is applicant pre-selection for an event, on Astro 7: an
organiser view and the API that the landing page's ask box sends public profiles to. In
development it is a Node server of its own, with its data in JSON files:

```sh
pnpm install
cp apps/preselect/.env.example apps/preselect/.env   # then put the Context.dev API key in it
pnpm --filter @overlap/preselect run dev             # http://localhost:4322
```

The organiser view is empty at first: the collected applicant data is not in the repository.
See [apps/preselect/README.md](apps/preselect/README.md) for the scripts that collect it.

`pnpm run dev:landing` starts this app next to the landing page, and the landing page's ask box
passes a public profile on to it (`PRESELECT_URL` in `apps/landing/src/config.ts`,
http://localhost:4322 in development). The profile is read and scored for the organiser; the
visitor is told which companies at the event it matches.

In the composed site the same app runs in the site's Worker, below `/submission/preselect` on the
landing page's own origin, with its applicants in a D1 database and the Context.dev key as a
secret of the Worker (see [Deploying](#deploying)). `PUBLIC_PRESELECT_URL` decides, when
`build:site` runs:

- unset: the backend is built into the Worker, and the landing page uses it at
  `/submission/preselect` (a relative URL on its own origin, so no CORS and no CSP change);
- a URL: a backend deployed elsewhere, which is then not bundled. `build:site` adds its origin to
  `form-action`; the landing page's `connect-src` (`apps/landing/public/_headers`) and the
  backend's `PRESELECT_ALLOWED_ORIGINS` are not set up for it;
- empty (`PUBLIC_PRESELECT_URL=`): no backend. The ask box reads no profiles and "Log in" on
  `/get-started` opens the app.

## The composed site

`vp run build:site` (or `pnpm run build:site`) runs `scripts/build-site.mjs`. It builds for
`SITE_URL` (the origin, for canonical and Open Graph URLs) and `SITE_BASE` (the path the site is
served below). Unset, they are `https://junction2026.com` and `/submission/`
(`scripts/site-target.mjs`); `SITE_BASE` also takes `/submission` or `submission`, and `/` (or an
empty value) builds for the root of an origin. The script:

1. builds `apps/app` with `APP_BASE=/submission/app/`, so its URLs start with that;
2. builds `apps/preselect` for Cloudflare Workers (`PRESELECT_TARGET=workers`: the
   `@astrojs/cloudflare` adapter in place of the Node one) with
   `PRESELECT_BASE=/submission/preselect`, into `apps/preselect/dist/workers/`: `server/` (its
   code) and `client/` (its `_astro/` files);
3. builds `apps/landing` with `SITE_URL`, `SITE_BASE` and
   `PUBLIC_PRESELECT_URL=/submission/preselect` (`astro build` empties `apps/landing/dist` first).
   Astro's `base` prefixes its own output; every other root-relative URL of the landing page goes
   through `sitePath` (`src/lib/base.ts`);
4. moves the landing build below the base, because the Worker looks up a request's full path in
   `dist/`, and reads `_headers` and `.assetsignore` only at its root:

   ```text
   dist/
     _headers           rule paths prefixed: /* -> /submission*, /app/ -> /submission/app/, ...
     .assetsignore
     404.html           for paths the route matches outside the base (/submissions)
     submission.html    the home page, /submission (no trailing slash)
     submission/        get-started.html, 404.html, _astro/, events/, og.png, icons
       app/             the app (step 5), /submission/app/
       preselect/       the backend's client files (step 6), /submission/preselect/_astro/
   ```

   No `robots.txt`: it only counts at the root of an origin;

5. copies `apps/app/dist` to `apps/landing/dist/submission/app`;
6. copies the backend's client files to `apps/landing/dist/submission/preselect` and writes
   `apps/landing/src/worker/backend.mjs` (not committed), which points the Worker's entry at the
   backend's server build. The server stays outside `dist/`, so none of its code is ever served
   as a file; Wrangler bundles it into the Worker when it deploys or runs `wrangler dev`.

A root build (`SITE_BASE=/`) skips step 4: the landing page at `/` (`dist/index.html`), the app at
`/app/`, the backend at `/preselect/`, `_headers` and `robots.txt` as in `public/`. `astro dev`
and a plain `astro build` are at `/`. Paths of the landing page in the rest of this README are
written for a root build.

`APP_BASE` (default `/`) only applies when `FIGMA_PUBLIC_URL` is unset, so Figma Make builds of
the app are unchanged. The landing page's "Get started" buttons go to `/get-started`
(`GET_STARTED_URL`), a login-style page whose "Log in" opens the platform (`PLATFORM_URL`): the
pre-selection app's organiser view when it runs (`PRESELECT_URL`), else the app at `/app/`
(`APP_URL`). All four are in `apps/landing/src/config.ts`.

Set `PUBLIC_APP_URL` to open an app deployed elsewhere instead; `build:site` then skips the app.
When the platform is on another origin (`PUBLIC_PRESELECT_URL`, else `PUBLIC_APP_URL`),
`build:site` adds that origin to the landing page's `form-action` CSP directive in `dist/_headers`
(the "Log in" form on `/get-started` submits a GET form to it).

`apps/landing/wrangler.jsonc` defines the one Worker (`overlap-landing`) that serves the site. The
static files in `apps/landing/dist` are served first, without running any code. Every path that
is not a file reaches the Worker's script (`src/worker/index.ts`, its logic in
`src/worker/handler.ts`): `/submission/preselect` and everything below it goes to the backend's
server, any other path back to the static assets (the `ASSETS` binding) for the 404 page.

- `routes`: `junction2026.com/submission*` only. junction2026.com itself is another Worker (a
  custom domain, from another repository); a route runs in front of it, so this Worker gets
  `/submission` and everything below it and nothing else. `workers_dev` and `preview_urls` are off.
  The route and the defaults in `scripts/site-target.mjs` must agree (`src/config.test.ts` checks).
- `html_handling: "auto-trailing-slash"`: landing pages without a trailing slash
  (`/submission/get-started` from `submission/get-started.html`, the home page `/submission` from
  `submission.html`; `/submission/` redirects to `/submission`), folders with one.
  `/submission/app` redirects to `/submission/app/`, where the app's relative URLs
  (`manifest.webmanifest`, `icon.svg`) and its service worker scope resolve.
- `not_found_handling: "404-page"`: unknown paths, also under the app and the backend, get the
  nearest `404.html` (the landing page's) with a 404 status.
- `compatibility_flags`: `nodejs_compat` for Astro's server, and
  `assets_navigation_has_no_effect`. Without the second, a page load in a browser
  (`Sec-Fetch-Mode: navigate`) of a path that is not a file gets the 404 page without the Worker
  ever running, so the organiser view would be a 404 in a browser while `curl` gets it.
- `d1_databases`: the backend's applicants, in the D1 database `overlap-preselect`, bound as `DB`.
- `apps/landing/public/_headers`: security headers and caching, written for a root build. The
  landing page's Content-Security-Policy covers every path; `/app/` (the app's page) replaces it
  with the app's own policy, which allows Google Fonts (`fonts.googleapis.com`,
  `fonts.gstatic.com`). `/app/assets/*` is cached as immutable; `/app/` and `/app/sw.js` revalidate
  on every load. `build:site` prefixes the rule paths with the base in `dist/_headers`.
  `_headers` applies to files only. The backend's pages and API answers get their headers in
  `src/worker/handler.ts`: the same security headers, a policy like the landing page's for the
  organiser view, `default-src 'none'` for the API, and `Cache-Control: no-store`. Its
  fingerprinted files (`/preselect/_astro/*`) are files, cached as immutable.

## Deploying

```sh
pnpm --filter @overlap/landing exec wrangler login   # once; or set CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID
vp run deploy:landing                                # build:site && wrangler deploy
pnpm --filter @overlap/landing exec wrangler secret put CONTEXT_DEV_API_KEY   # once, after the first deploy
vp run --filter @overlap/landing preview             # local: build:site && wrangler dev
```

The deploy needs no extra environment: the site is built for https://junction2026.com/submission
and the Worker is attached to the route `junction2026.com/submission*` (the junction2026.com zone
must be on the same Cloudflare account). The home page is https://junction2026.com/submission. Locally,
`preview` serves it at http://localhost:8787/submission; other paths there get the 404 page.
`SITE_URL` sets Astro's `site`; set it to an empty value for pages without canonical or `og:url`
tags. Add `PUBLIC_APP_URL=https://app.example.com/` to deploy the landing page alone. To deploy
somewhere else, change the route in `wrangler.jsonc` and the defaults in `scripts/site-target.mjs`
together.

The backend's settings are secrets of the Worker, never part of a build: they are read when a
request needs them. `CONTEXT_DEV_API_KEY` is required; set it once with `wrangler secret put`
(it asks for the value and survives later deploys). Until it is set, an application is answered
as one whose links could not be read. Optional, set the same way: `LINKEDIN_CLIENT_ID` and
`LINKEDIN_CLIENT_SECRET` (the LinkedIn sign-in, whose redirect URL is then
`https://junction2026.com/submission/preselect/api/linkedin/callback`) and
`PRESELECT_ALLOWED_ORIGINS`. Locally, `preview` reads them from `apps/landing/.dev.vars`
(`CONTEXT_DEV_API_KEY=...`; git ignores the file) and keeps its database under
`apps/landing/.wrangler/`.

The applicants are rows of the D1 database `overlap-preselect` (`d1_databases` in
`wrangler.jsonc`). Its tables are created on the first request; there is no migration step.
`wrangler d1 execute overlap-preselect --remote --command "SELECT id, updated_at FROM applicants"`
shows them, with `--local` the ones of `preview`.

Once deployed, the organiser view (`/submission/preselect/`) and the apply endpoint
(`/submission/preselect/api/apply`) are public: there is no login. Anyone with the address sees
the applicants (an alias, the links they gave and what was read from them) and can send
applications, each of which spends Context.dev credits. At most 120 reads start per hour
(`MAX_READS_PER_HOUR`), counted in D1 across the Worker's instances.

## Tests

`vp test` runs the unit tests of the packages listed in `test.projects` of the root
`vite.config.ts` (`vp test watch` to watch). Each package keeps its test settings in its own
`vite.config.ts`. The landing page has one only for that (Astro does not read it); it resolves
the `@/` alias from `tsconfig.json`. Tests import from `vite-plus/test` and sit next to the module
they test as `*.test.ts`, never under `src/pages/` (Astro would route them). They are not
imported by any page, so they are not part of the build.

`apps/landing/src/data/events.test.ts` covers the search and the demo data of
`apps/landing/src/data/events.ts`. `scripts/` is a test project too: `scripts/site-target.test.ts`
covers the base and `_headers` helpers of the build script. `apps/landing/src/config.test.ts` also
checks that the Worker route, the default base, the app's and the backend's paths and the two
Wrangler configs agree across files; `apps/landing/src/worker/handler.test.ts` covers the Worker's
routing and headers. The tests of `apps/preselect` run with the rest; its storage is tested on
files and on D1 (`src/lib/storage.test.ts`, with SQLite standing in for D1).

## The landing page

`apps/landing/src/pages/index.astro` is one page: the hero, three static sections and the footer.

- `src/components/landing/` is the hero, the page's main React island (`client:load`).
  `Hero.tsx` lays it out: the event cards travel through the Depth Field in the background, the
  Liquid Glass Orb and the single prompt-kit ask box sit in the middle, and the Bubble UI glass
  controls (menu, pause, "Online only", "Minimum fit") filter what is in the field.
  `use-ask-flow.ts` is the small state machine behind it (ask -> thinking -> searching -> answer),
  `use-error-flash.ts` the red flash and slight zoom when an ask fits nothing (at most once a
  second), `SkullWall.tsx` the wall of 💀 in that red for one ask only, "He is dead." (the Steve
  Jobs example, `SKULL_ASK` in `src/data/events.ts`), put on the page only once that ask is made
  (devices without an emoji font then get the skull from a one-glyph Noto Color Emoji subset,
  `src/assets/fonts/`, wired in `astro.config.ts`),
  `settings.ts` holds the approved settings of each ReactDrops component (do not tidy those
  numbers), `GetStarted.tsx` is the Chromatic Button call to action, `hero.css` the layout.
- `src/components/sections/` holds the sections below the hero. They are static `.astro` files
  with no client JavaScript, except `FinalCta.tsx` (`client:visible`), whose glass button
  refracts the card collage behind it.
- Colours are the app's palette (`@theme` in `src/styles/global.css`). Corners use the
  `squircle-*` utilities defined there: a plain radius everywhere and, where the browser supports
  `corner-shape: squircle`, a larger radius drawn as a squircle.

`src/pages/get-started.astro` (`/get-started`) is where every "Get started" goes: a login page in
looks only, static and without client JavaScript (its parts and CSS are in
`src/components/get-started/`). Its photo, `src/assets/get-started-crowd.webp` (3:2, at least
1536 x 1024; made with an image model for this page, not a stock photo), is turned into AVIF and
WebP at build time; `--gs-photo-focus` in `get-started.css` is the point of the picture that stays
in view at every size (the person standing still) and `--gs-photo-clear` how much of its width is
free for the tagline to the left of them. Nothing typed into the page is sent: its fields have no
`name`. "Log in" (a GET form) and "Sign up here" open the platform (`PLATFORM_URL`) with
`?from=get-started`. The organiser view has no login and takes no notice of the query. The app
(`apps/app/src/lib/handoff.ts`) reads it once, removes it from the address and signs the visitor
in as the demo unless an email is stored, so they skip the app's own login. The query is defined in
both apps; `src/config.test.ts` fails when the two differ.

## Event data and card images

The landing page's demo events, their search (`queryTerms`, `matchEvents`) and the example profiles
(`ASK_SUGGESTIONS`) are in `apps/landing/src/data/events.ts`. Each event's card image is rendered
at build time by the static endpoint `apps/landing/src/pages/events/[id].webp.ts` and served as
`/events/<id>.webp` (cached for a day, see `_headers`). The card template and the pipeline
(satori -> resvg -> sharp) are in `apps/landing/src/cards/`; the files are `EVENT_IMAGE_DENSITY`
times the layout size in `EVENT_SHAPES`, because the depth field draws the nearest cards large.
`src/pages/og.png.ts` renders the social image the same way.

## Vite+ and Astro

`pnpm-workspace.yaml` overrides every `vite` dependency with `@voidzero-dev/vite-plus-core`
(managed by `vp migrate`), so the app, Astro and all Vite plugins share one Vite instance.
`astro dev` and `astro build` run on it unchanged. One addition was needed: `apps/landing`
declares `"vite": "catalog:"` itself. Without it, pnpm auto-installs upstream `vite` for the
`vite` peers of `@astrojs/react` and `@tailwindcss/vite` (overrides do not apply to auto-installed
peers), and those plugins would run on a second Vite copy next to Astro's.

## Third-party components

`apps/landing/src/components/{chromatic-*,depth-*,liquid-glass-orb*}` and
`apps/landing/src/components/soap-bubble/` are [ReactDrops](https://reactdrops.dev) components,
kept byte-identical to their registry source and excluded from `vp fmt` and `vp lint` (root
`vite.config.ts`). Do not edit them. Their licence (ReactDrops Component License 1.0, header of
each file) allows using them inside this end product, but not redistributing them as a component
kit. The shadcn CLI strips that header, so after `shadcn add` restore the files from the
registry JSON (`files[].content`).

`apps/landing/src/lib/island/` (the engine) and `apps/landing/src/components/islandcn/` (the
incoming call preset and the kit pieces it imports) are
[islandcn](https://github.com/opencoredev/islandcn), a Dynamic Island for React, copied verbatim
from commit `0011a41` and excluded from `vp fmt` and `vp lint` in the same way. Do not edit them.
It is MIT licensed; the notice is in `src/lib/island/LICENSE`. The page's incoming call
(`src/components/landing/IncomingCall.tsx`) is built on it.

`src/components/ui/` holds prompt-kit's Prompt Input and the shadcn/ui primitives it uses
(`components.json`); these are ordinary project code.
