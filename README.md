# Junction 2026

The website for Junction 2026 at [junction2026.com](https://junction2026.com): the home page
(hero plus a card for every challenge), all challenges (a listing plus one page per
challenge), event info, privacy and cookies, a 404 page and a generated `sitemap.xml`. For AI agents and crawlers,
every page also has a Markdown version, indexed by `llms.txt` (see
[Markdown for AI agents](#markdown-for-ai-agents)).

- Static [Astro](https://astro.build) site styled with Tailwind CSS v4.
- One small client-side script: the cookie notice and Google Tag Manager loader (about 2.1 KB
  minified, inlined into each page as a module script, so it never blocks rendering). No
  framework, no islands, no runtime dependencies. The other `<script>` tags are inert data
  blocks (speculation rules for prefetching, and JSON-LD on the home page). See
  [Analytics and the cookie notice](#analytics-and-the-cookie-notice).
- No third-party requests until a visitor accepts analytics cookies: fonts, images and partner
  logos are all self-hosted.
- Deployed as an assets-only Cloudflare Worker. There is no Worker script; Cloudflare serves
  the files in `dist/` directly (see `wrangler.jsonc`).

## Prerequisites

- Node.js 22.23.4 or newer (see `engines` in `package.json`) and npm.

## Commands

```sh
npm install      # install dependencies
npm run dev      # dev server with live reload at http://localhost:4321
npm run build    # build the static site into dist/
npm run preview  # build, then serve dist/ locally with wrangler as on Cloudflare
                 # (headers from public/_headers, the 404 page, URLs without trailing slash)
npm run check    # type-check the project
npm run deploy   # build, then deploy to Cloudflare
```

### Deploying

`npm run deploy` runs `wrangler deploy`. Wrangler needs `CLOUDFLARE_API_TOKEN` and
`CLOUDFLARE_ACCOUNT_ID` in the environment, or a session from `wrangler login`.
Never commit credentials to this repository.

A deploy uploads the contents of `dist/` as the static assets of the `junction2026` Worker
(only changed files are sent) and serves them on the `junction2026.com` custom domain set in
`wrangler.jsonc`. The new version is live as soon as the command finishes; rolling back means
redeploying an earlier commit or using Cloudflare's version history for the Worker.
`/submission` and everything below it are served by another Worker and are not part of this
deploy (see [Overlap, our hackathon submission](#overlap-our-hackathon-submission)).

## Overlap, our hackathon submission

`packages/overlap/` is Overlap, our Junction 2026 submission, copied from its own repository,
[petraemmii/aislop](https://github.com/petraemmii/aislop). It is a separate pnpm workspace on the
[Vite+](https://viteplus.dev) toolchain (`vp`), with its own lockfile, scripts and
[README](packages/overlap/README.md). It is not part of this project's install, build or check:
`tsconfig.json` excludes `packages/`, and the site's styles only scan `src/`.

Two Workers share the domain:

| Worker | Serves | Files |
| --- | --- | --- |
| `junction2026` (this site) | the custom domain `junction2026.com` | `dist/` |
| `overlap-landing` (Overlap) | the route `junction2026.com/submission*`, which runs in front of the custom domain for `/submission` and everything below it | `packages/overlap/apps/landing/dist/` |

The button in the home page's hero, "View our submission here", links to `/submission`.
`/winners` and `/live` are short addresses of it: permanent redirects (301) to `/submission`, in
`public/_redirects`.

To build, check and deploy Overlap (Node.js 22.23.4 or newer and pnpm 10.34.3; Wrangler needs
the same Cloudflare credentials as above):

```sh
cd packages/overlap
pnpm install             # its own dependencies, in packages/overlap/node_modules
pnpm run check           # astro check, format, lint, type check and tests
pnpm run build:site      # build the site for junction2026.com/submission into apps/landing/dist/
pnpm run deploy:landing  # build:site, then deploy the overlap-landing Worker
```

## Where things live

| What | Where |
| --- | --- |
| Tracks, challenges, tech challenges, partners, event timeline | `src/data/challenges.ts` |
| Full partner challenge wording, resources, judging and prizes | `src/data/challenge-text/*.json` |
| Challenge URL slugs (`/challenges/<slug>`) | `src/data/challenge-directory.ts` |
| Teams per challenge so far (the capsules on the cards and challenge pages) | `src/data/team-counts.ts` |
| Partner logos | `src/data/partner-logos.ts` and `src/assets/partner-logos/` |
| Pages | `src/pages/` (`index`, `challenges`, `challenges/[slug]`, `about`, `privacy`, `404`) |
| Tag Manager container ID, consent storage key, site operator shown on `/privacy` | `src/data/privacy.ts` |
| Cookie notice and Tag Manager loader | `src/components/CookieNotice.astro`, `src/scripts/consent.ts` |
| Sitemap (generated from the challenge data) | `src/pages/sitemap.xml.ts` |
| `llms.txt` (generated from the challenge data) | `src/pages/llms.txt.ts` |
| Markdown twins of the pages and `llms-full.txt` | `src/integrations/markdown-twins.ts` |
| Crawler rules and AI content signals | `public/robots.txt` |
| Shared components and layout | `src/components/`, `src/layouts/BaseLayout.astro` |
| Theme and styles | `src/styles/global.css` |
| Fonts and image encoder settings | `astro.config.mjs` |
| Site icons and the social preview image | `public/favicon.*`, `public/og-image.jpg` (see [Icons and the social preview image](#icons-and-the-social-preview-image)) |
| Cache and security headers | `public/_headers` |
| Redirects (`/winners` and `/live` to `/submission`) | `public/_redirects` |
| Cloudflare configuration | `wrangler.jsonc` |
| Overlap, our hackathon submission at `/submission` (a separate pnpm workspace) | `packages/overlap/` (see [Overlap, our hackathon submission](#overlap-our-hackathon-submission)) |

## Updating content

Edit the files above and run `npm run build` (or keep `npm run dev` running) to check the
result, then deploy. Full partner challenge wording lives in `src/data/challenge-text/*.json`;
`src/data/challenges.ts` supplies the remaining challenges and fallback summaries. The
home page cards, the `/challenges` listing, the detail pages and `sitemap.xml` are all built
from it, so a new challenge appears everywhere at once. Event info (schedule and FAQ) is in
`src/data/challenges.ts` (`timeline`) and `src/pages/about.astro`.

Each challenge gets its own page automatically. The slug is built from the organisation and
the title. Full partner sources retain the original slug even when their title changes.
The build fails if two challenges end up with the same slug.

To import the complete wording from a saved partner challenge page, run:

```sh
node scripts/import-challenge.mjs /path/to/saved-page.html existing-challenge-slug
```

The importer retains the complete challenge, insight, resources, company information,
judging criteria and prizes, including lists, code samples and links. It strips dashboard
navigation, account details, countdowns, scripts and source styling, and checks that no text
or links change during extraction. Review and commit each challenge separately. Cards and
`llms.txt` use the imported title, opening summary and prizes; detail pages and their generated
Markdown twins contain the full wording. Challenges without a supplied source keep their
existing content.

## Markdown for AI agents

Following [Cloudflare's docs site](https://developers.cloudflare.com/), the site offers a
plain Markdown version of its content for AI agents, all as static files:

| URL | What |
| --- | --- |
| `/index.md`, `/challenges.md`, `/about.md`, `/privacy.md`, `/challenges/<slug>.md` | Markdown twin of the page at the same URL without `.md` (the home page's is `/index.md`). The 404 page has none. |
| `/llms.txt` | Index of the site in the [llms.txt](https://llmstxt.org) format: key facts, then links to every twin, with the challenges grouped by track. |
| `/llms-full.txt` | All twins in one file, in `llms.txt` order. |

- **Twins are generated, never written by hand.** After `astro build`, the integration in
  `src/integrations/markdown-twins.ts` (`astro:build:done` hook) converts the `<main>` of
  every built HTML page to Markdown with unified (rehype-parse, rehype-remark,
  remark-stringify; dev dependencies only). It first reshapes the HTML so it reads well as
  Markdown: header, footer, navigation, images, icons and hidden elements are dropped;
  challenge cards become a heading with a link on the title followed by plain text;
  `<details>` sections are expanded; rows of links become lists; links become absolute URLs
  of the normal pages (`https://junction2026.com/...`, no `.md`). A new page therefore gets a
  twin automatically. Each twin starts with YAML front matter (`title` and `description` from
  the page's `<title>` and meta description, `url`), a one-line note pointing to `llms.txt`,
  and the page's `# H1`.
- **Each page announces its twin** with `<link rel="alternate" type="text/markdown">` in
  `src/layouts/BaseLayout.astro` (`markdown={false}` turns it off, as on the 404 page).
- **`llms.txt` is generated from the challenge data** (`src/pages/llms.txt.ts`), like the
  sitemap, so it cannot drift from the challenges. Its key facts and the four page
  descriptions are written in that file.
- **The build fails** if a page has no `<main>`, its `<link rel="alternate">` does not match its
  twin, a twin contains leftover HTML, an empty or a relative link, a twin is missing from
  `llms.txt`, or `llms.txt` links to a file that was not built. If you add a page, add it to the
  "Pages" list in `src/pages/llms.txt.ts` (and to `paths` in `src/pages/sitemap.xml.ts`).
- Twins exist only in `dist/` after `npm run build` (or `npm run preview`), not in `npm run dev`.
- `public/_headers` serves `.md` files as `text/markdown; charset=utf-8` and the llms files as
  `text/plain; charset=utf-8`, and sends `Vary: Accept` on everything except `/_astro/*`.
- `public/robots.txt` allows all crawlers and states Cloudflare's
  [content signals](https://contentsignals.org) `ai-train=yes, search=yes, ai-input=yes`, in a
  single `User-agent: *` group: a crawler reads only the most specific group that matches it,
  so adding a group for one bot would need the `Content-Signal` line repeated in it. The
  sitemap lists only the HTML pages.

### Content negotiation (Cloudflare zone rules)

On Cloudflare's docs, a request with `Accept: text/markdown` gets the Markdown version of the
page. This site has no Worker code, so two URL rewrite rules (Rules > Transform Rules > URL
Rewrite Rules) on the `junction2026.com` zone do the same by rewriting the path to the twin.
They are not part of this repository or of a deploy; to reproduce them, create:

| Rule | When incoming requests match (expression) | Rewrite path to (dynamic) |
| --- | --- | --- |
| Markdown for the home page | `(http.request.uri.path eq "/" and any(http.request.headers["accept"][*] contains "text/markdown"))` | `/index.md` (static) |
| Markdown for other pages | `(http.request.uri.path ne "/" and http.request.uri.path.extension eq "" and not ends_with(http.request.uri.path, "/") and any(http.request.headers["accept"][*] contains "text/markdown"))` | `concat(http.request.uri.path, ".md")` |

With the rules on, `curl -H "Accept: text/markdown" https://junction2026.com/about` returns
`/about.md`. A path without a twin (an unknown page) then gets the 404 page, as without the
header. `Vary: Accept` keeps browser and other caches from mixing up the two versions.

## Analytics and the cookie notice

The site counts visits with Google Analytics 4, run from the Google Tag Manager container
`GTM-P55PJ28X`, but only for visitors who accept analytics in the cookie notice. Visitors can
also allow advertising, which lets Google use that Analytics data for advertising (measuring
and personalising Google ads). The container ID is set in one place, `GTM_CONTAINER_ID` in
`src/data/privacy.ts`; the GA4 tag itself is configured in Tag Manager, not in this repository.

- **Two purposes, chosen separately.** The notice (`src/components/CookieNotice.astro`) is a
  bar fixed to the bottom of the viewport with "Accept all" and "Reject all" as two identical
  buttons, neither preselected, and a "Choose" disclosure (`<details>`) with two unticked
  checkboxes, "Analytics" and "Advertising", and "Save choice". Saving with nothing ticked is
  the same as "Reject all". The notice is in every page's HTML with `hidden`, first in `<body>`
  and outside `<main>`, so it never reaches the Markdown twins.
- **Before an answer** nothing is requested from Google, no cookie is set and nothing is
  stored.
- **What each answer does** (`src/scripts/consent.ts`): the answer is stored, then the Consent
  Mode v2 defaults are pushed (`ad_storage`, `ad_user_data`, `ad_personalization` and
  `analytics_storage` all denied), then one update with the answer: analytics sets
  `analytics_storage`, advertising sets the other three. Then the `gtm.start` / `gtm.js` event
  is pushed and `gtm.js` loads async.
- **Tag Manager loads only if analytics is granted.** With advertising alone nothing loads.
  Once the container is loaded, Google Analytics sends cookieless pings even with
  `analytics_storage` denied, and the rule here is that nothing goes to Google for a purpose
  the visitor has not accepted; not acting on a permission is always allowed. This is right
  while the container's only tag is Google Analytics. **If advertising tags that should run
  without analytics are ever added to the container, revisit this** (the `analytics && !loaded`
  condition in `src/scripts/consent.ts`), and the privacy page with it.
- **The answer** is kept in `localStorage` under `junction2026-consent` as
  `{"analytics":true|false,"advertising":true|false,"at":<ms>}` and asked again after 6
  months (`CONSENT_MONTHS`). Anything else, including the earlier single-purpose
  `{"choice":"granted"|"denied",...}`, counts as no answer, so everyone who answered the old
  question is asked again. Without storage there is no answer: the notice shows on every page
  and nothing loads.
- **"Cookie settings"** in the footer reopens the notice with the disclosure open and the
  checkboxes showing the answer in force, and moves focus to it. A new answer sends a consent
  update with all four signals on the current page. Withdrawing analytics deletes the `_ga`
  and `_ga_*` cookies, and withdrawing (or not granting) advertising deletes Google's
  first-party advertising cookies `_gcl_*` and `_gac_*`, each at every domain level; from the
  next page on the container only loads if analytics is still granted. (With the current
  container, observed in Chrome, "Accept all" sets only `_ga` and `_ga_<ID>` on this site; the
  `_gcl_*`/`_gac_*` deletion is a safeguard.) Cookies on Google's own domains cannot be deleted
  from this site; `/privacy` tells visitors how to control them.
- **Without JavaScript** the notice and the footer button stay hidden and nothing loads. There
  is no `<noscript>` Tag Manager iframe.
- **Prerendered pages** (speculation rules) wait for `prerenderingchange` before loading the
  container, so pages that are never shown are not counted.
- The notice and the loader talk only through the `junction2026:consent` window event
  (`detail`: `{analytics, advertising}` or `null` for no answer). The script also re-applies
  the stored answer when a page comes back from the back/forward cache and when it changes in
  another tab.

**Do not add other tags or providers** (Meta, LinkedIn and so on) or new kinds of cookies to
the container without extending the notice, the consent handling in
`src/scripts/consent.ts` and the privacy page first; Google advertising features based on the
Analytics data are covered by the advertising choice, subject to the loading rule above. The
same goes for new data: `/privacy` (`src/pages/privacy.astro`) lists exactly what is collected
and which Google hosts are contacted. Its "Who runs this site" paragraph appears once
`SITE_OPERATOR` in `src/data/privacy.ts` has a name.

## Icons and the social preview image

| File | What |
| --- | --- |
| `public/favicon.svg` | The site icon as vector shapes. Every page links it last, so browsers use it for the tab at any size. It is near-black, and switches to the site's light text colour when the browser is in dark mode, where a dark mark would disappear on the tab strip. |
| `public/favicon.png` | The same icon at 512 x 512 px, rendered from the SVG: for browsers that cannot draw SVG and for large slots such as shortcut tiles. |
| `public/favicon.ico` | The original icon, 16 to 256 px. No page links it; it is served for clients that ask for `/favicon.ico` without reading the page's icon links. |
| `public/og-image.jpg` | 1200 x 630 px screenshot of the top of the home page, shown when a link to any page is shared (`og:image` in `src/layouts/BaseLayout.astro`). |

The SVG was redrawn from the ICO's 256 px frame and renders the same picture in light mode.
The PNG and the ICO have one colour each and stay near-black. After editing the SVG, render
the PNG again (the command draws the light-mode colours):

```sh
rsvg-convert -w 512 -h 512 public/favicon.svg -o public/favicon.png
```

Retake the screenshot when the top of the home page changes: the built site in a
1280 x 672 px viewport (the same proportions as 1200 x 630, and large enough for the hero's day
calendar) at twice the pixel density, with the cookie notice answered, scaled down to
1200 x 630 px and saved as JPEG at quality 90 without chroma subsampling. Sites that show link
previews keep their own copy of the picture, so a new one appears there only after they fetch
the page again.

## Adding a partner logo

1. Put the file in `src/assets/partner-logos/`. Use an SVG if you have one. Run it through
   [SVGO](https://svgo.dev) first, keep its `viewBox`, and check that it contains no scripts,
   event handlers or external references. If the logo only exists as a bitmap, use a WebP or
   PNG with a transparent background, about 500 px wide at most. Logos are shown at up to
   162×56 px.
2. Import the file in `src/data/partner-logos.ts` and add an entry keyed by the challenge's
   exact `org` name. Set `dark: true` if the logo needs a dark surface, for example a white
   logo.
3. Run `npm run build`. The logo is copied to `/_astro/` with a content hash in its file
   name, so it can be cached forever. Logos are only ever shown with `<img>`.
