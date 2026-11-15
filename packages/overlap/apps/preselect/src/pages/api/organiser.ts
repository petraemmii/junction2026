// The organiser's data for another front end (the Overlap app): every applicant as the organiser
// view sees them and the participating companies. The same as the organiser page (index.astro)
// hands to its own view; the scoring runs in the browser. Read through `storage` (#runtime): the
// JSON files on Node, D1 on Workers.
import { storage } from '#runtime'
import type { APIRoute } from 'astro'
import { cors } from '../../lib/cors.ts'
import { prepareCompanies } from '../../lib/companies.ts'
import { EVENT_NAME } from '../../lib/taxonomy.ts'
import { toView } from '../../lib/view.ts'

export const GET: APIRoute = async ({ request }) => {
  const companies = await storage.companies()
  const prepared = prepareCompanies(companies)
  const body = {
    event: EVENT_NAME,
    companies,
    applicants: (await storage.applicants()).map((applicant) => toView(applicant, prepared)),
  }
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...cors(request) },
  })
}
