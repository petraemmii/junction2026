# Preselect

Applicant pre-selection for recruitment events (`@overlap/preselect`), built for the City of
Espoo challenge "Rethinking Recruitment" with the Deep Tech Talent Forum as the example event.
Astro 7 with a Node server, React islands and Tailwind CSS v4.

- **Applications** (`POST /api/apply`): takes whatever an applicant typed about where their work
  is (GitHub, LinkedIn, Google Scholar, a personal site, anything public), as JSON
  (`{ "text": "…" }`) or form data. The landing page's ask box passes profiles on to it. The
  links are repaired first: `linkedin.com/name` becomes `linkedin.com/in/name`, a GitHub
  repository becomes the account, tracking parameters go, and what cannot be read is refused
  with a reason (`src/lib/links.ts`). The answer lists what was read, never the score.
- **Collection**: [Context.dev](https://context.dev) reads every link. GitHub profiles are
  read page by page and parsed with plain rules; any other page goes through Context.dev's
  JSON extraction; a CV is converted to text; a LinkedIn profile link is looked up as a person,
  while a single LinkedIn post or article is read like any other page. A model on Context.dev's
  side also judges how much each piece of work is work in each of the event's eight fields;
  the words in the item decide only when there is no such judgement.
- **Scoring**: the collected work becomes signals (skills with their evidence, relevance per
  field, activity, research output, experience, education). Work visible in a portfolio
  counts far more than something only stated in a CV.
- **Organiser view** (`/`): six broad sliders and the number of applicants to suggest. The
  places are split between the fields by the participating companies' fields. Each suggested
  applicant is a card with the facts behind the score. The tool suggests; the organiser decides.
- **Organiser data** (`GET /api/organiser`): the same applicants and companies as JSON, for the
  Overlap app's company side (`apps/app`), which shows the same view in its own design.

## Setup

From the repo root:

```sh
pnpm install
cp apps/preselect/.env.example apps/preselect/.env   # then put the Context.dev API key in it
pnpm --filter @overlap/preselect run dev             # http://localhost:4322
```

`.env` is never committed. The LinkedIn values in it are only needed for the LinkedIn sign-in.
The test applicants come with the repository (`data/applicants.json`). Collect them again with the
scripts below, or send a profile from the landing page (`pnpm run dev:landing` starts both).

## Commands

From the repo root, after `pnpm install`:

```sh
pnpm --filter @overlap/preselect run dev      # dev server at http://localhost:4322
pnpm --filter @overlap/preselect run build    # build the Node server into dist/
pnpm --filter @overlap/preselect run check    # astro check
pnpm --filter @overlap/preselect exec vp test # unit tests for scoring, quotas and parsing
```

### Data

Everything collected lives in `data/`. Applicants are not committed: that is what was read from
real people's public pages. The event's companies (`data/companies.json`) are public information
and are committed, so everyone scores against the same 27. Run the scripts in this folder:

```sh
node scripts/companies.ts   # event page -> participating companies -> their fields (data/companies.json);
                            # run `vp fmt` on the file afterwards, it is committed
node scripts/discover.ts    # listing pages -> public portfolio links to test with (data/seeds.json)
node scripts/collect.ts     # every seed as an applicant (data/applicants.json); rerun to retry failures
node scripts/judge-fields.ts # add the model's field judgement to applicants collected before it existed
```

`data/applicants.json` is committed with the test applicants already read. Without it the
organiser view is empty until someone applies from the landing page.

### Test applicants

`data/seeds.json` is committed: 176 addresses of public portfolios (GitHub, Semantic Scholar,
Medium, Behance, Kaggle, Hackster, Hackaday, OSHWLab and Tiny Tapeout), each with the field it
was found under. They were picked from public listing pages by `scripts/discover.ts`; 16 of
them, marked `off`, are portfolios from outside deep tech and should end up with no score. The
file holds addresses only, nothing that was read from them.

They are read already: `data/applicants.json` is committed. To read them again on your own
machine, with a Context.dev key in `.env`:

```sh
node scripts/collect.ts
```

It reads every address the way an application would be read and saves the result to
`data/applicants.json`, adding to what is there. Expect a few minutes and roughly 800 to 1,000
credits. About 34 of the addresses are refused (mostly GitHub organisations, not people), and
the scores will not match another machine's exactly: the pages change, and the model's judgement
of the fields varies a little between reads. Running `scripts/discover.ts` again replaces the
list with a new pick; run `vp fmt` on the file before committing it.

## Where things live

| What                                                                      | Where                   |
| ------------------------------------------------------------------------- | ----------------------- |
| The eight fields, their skills (tools and subject areas) and keywords     | `src/lib/taxonomy.ts`   |
| Data model                                                                | `src/lib/types.ts`      |
| Repairing and checking the links an applicant types                       | `src/lib/links.ts`      |
| Context.dev client (scrape, JSON extraction, people lookup, file parsing) | `src/lib/contextdev.ts` |
| LinkedIn sign-in and data API client                                      | `src/lib/linkedin.ts`   |
| GitHub page parsers                                                       | `src/lib/github.ts`     |
| Extraction schema for every other page, platform list                     | `src/lib/extract.ts`    |
| CV text parser                                                            | `src/lib/cv.ts`         |
| Collecting one applicant from links and a CV                              | `src/lib/collect.ts`    |
| Signals: what the collected work says about a person                      | `src/lib/signals.ts`    |
| Scores per slider, quotas per field, the selection                        | `src/lib/scoring.ts`    |
| Match between an applicant and the participating companies                | `src/lib/companies.ts`  |
| The facts shown on a card                                                 | `src/lib/traits.ts`     |
| Pages and the application endpoint                                        | `src/pages/`            |
| Organiser view                                                            | `src/components/`       |

## Re-reading an application

Resubmitting the same links without a CV updates the existing applicant's field choices and
preserves their ID. Complete successful reads are reused for up to 24 hours. Older reads,
failed sources and partial GitHub reads are collected again. Send `refresh: true` in JSON
(or `refresh=true` in form data) to force a new read; it consumes normal Context.dev credits.

Explicit GitHub repository and file links retain the repository. Links for one account are
collected together, and every explicitly chosen repository is opened, including those absent
from the first repository-list page. Other repository details remain limited to the strongest
entries on that page. A failed read is reported and does not invent an unlisted work item.

## CV parsing

Uploaded PDFs are converted through Context.dev with OCR enabled, including mixed files with
both text and scanned pages. Hyperlinks are preserved; image references are not requested.
OCR can consume additional credits. The original Markdown is stored in the source's `markdown`
field for review or re-parsing and is not included in the organiser or application response.

The local parser recognises common English and Finnish section headings, year ranges and
numeric month/year, ISO year-month and English month-name ranges. Only an explicit ongoing
end date (such as `present` or `nykyhetki`) becomes ongoing work. Education and project dates
are kept out of employment history. Descriptions following a dated role contribute claimed
evidence, with the same CV weight as other stated work. Titles and project lists are not truncated.

This is still a rule-based parser: unusual layouts, other languages, charts and unlisted skills
may need manual review. Successful extraction means some structured data was found, not that
every fact in the CV was understood. An empty conversion reports `NO_TEXT_IN_FILE`; text with no
recognised education, experience, projects or skills reports `NO_CV_DATA`. Both retain any
returned Markdown. Run the preselect tests explicitly with the command above; the root test
configuration currently runs only the landing-page tests.

## How the score is built

Identifiable work is counted once across sources, using its URL (with tracking parameters
and fragments removed). A verified source at the work's own host takes precedence over a
copy on a portfolio page. Distinct URLs and items without URLs remain distinct; unlisted
totals cannot be deduplicated by identity. A model's field judgement takes precedence over
platform defaults, including when it says the work belongs to none of the event's fields.

Each of the six sliders has a part between 0 and 1 for an applicant in a field:

- **Work experience**: years of work history, or years of public activity (counted for less).
- **Size of portfolio**: verified work in the field, then activity in the last year, stars or
  citations, commit message quality and how recent the work is.
- **Range of skills**: how many of the field's skills have work behind them; a skill only
  stated counts a quarter.
- **Depth in one skill**: evidence for the chosen skill, or for the applicant's strongest one.
  A stated skill that the whole portfolio confirms counts in full; a stated skill with no
  work stays low.
- **Education**: level of the degree, halved when it is in another field.
- **Match with companies**: for each participating company, how much of the applicant's evidence
  lies in the company's fields, raised when the applicant has the skills the company's site asks
  for. The three best matches count, the best one most.

Work that can be seen counts in full. A role on a LinkedIn profile counts 0.6 of that and a
line in a CV 0.3: both are the person's own account, but a public profile is read by colleagues.

The score is the slider-weighted average of the parts, multiplied by how relevant the
applicant's evidence is to the field, on a scale from 0 to 100. Relevance is what keeps long
experience or a high degree in an unrelated area from scoring.

## Priority list

An applicant with a very large public reach is shown to the organiser first, whatever their
score. One of these is enough (`src/lib/priority.ts`):

| Where     | More than                                    |
| --------- | -------------------------------------------- |
| GitHub    | 5,000 stars on the person's own repositories |
| LinkedIn  | 10,000 followers                             |
| X         | 50,000 followers                             |
| Instagram | 50,000 followers                             |
| Facebook  | 30,000 followers                             |
| YouTube   | 70,000 subscribers                           |
| TikTok    | 100,000 followers                            |

They take a place among the suggested applicants, out of their field's quota while it has any
left, and their card says why. Whether they are invited is still the organiser's decision, and
the applicant is told nothing about it.

The star count covers the repositories that were read (the first page of the list, forks left
out). A follower count is read from the text of the profile page the applicant linked, one more
page read per link; a page that shows no count gives none. Context.dev can read a LinkedIn
profile page for some people only; a LinkedIn post the applicant linked states the count too.

## LinkedIn sign-in (not finished)

`/api/linkedin/start` sends the visitor to LinkedIn to consent, and `/api/linkedin/callback`
reads their data through LinkedIn's Member Data Portability API (members in the EEA only). It
has not been run against a real account yet, and what it reads is not part of an application or
the score: the callback only lists what came back and saves it to `data/linkedin-snapshot.json`.
The LinkedIn app needs `http://localhost:4322/api/linkedin/callback` as an authorized redirect URL.
