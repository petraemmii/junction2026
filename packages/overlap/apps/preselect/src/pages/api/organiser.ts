// The organiser's data for another front end (the Overlap app): every applicant as the organiser
// view sees them and the participating companies. The same as the organiser page (index.astro)
// hands to its own view; the scoring runs in the browser.
import type { APIRoute } from 'astro'
import { cors } from '../../lib/cors.ts'
import { prepareCompanies } from '../../lib/companies.ts'
import { readApplicants, readCompanies } from '../../lib/store.ts'
import { EVENT_NAME } from '../../lib/taxonomy.ts'
import { toView } from '../../lib/view.ts'

export const GET: APIRoute = ({ request }) => {
  const companies = readCompanies()
  const prepared = prepareCompanies(companies)
  const body = {
    event: EVENT_NAME,
    companies,
    applicants: readApplicants().map((applicant) => toView(applicant, prepared)),
  }
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...cors(request) },
  })
}
