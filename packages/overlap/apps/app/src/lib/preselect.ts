// The pre-selection backend (apps/preselect): the real applicants of the event and its companies,
// which the company side's shortlist scores in the browser with the backend's own scoring code.
import { useEffect, useState } from 'react'
import type { Company } from '../../../preselect/src/lib/types.ts'
import type { ApplicantView } from '../../../preselect/src/lib/view.ts'

/**
 * Where the backend runs: VITE_PRESELECT_URL at build time, else http://localhost:4322 in
 * development (`vp run dev:landing` starts it), else none.
 */
export const PRESELECT_URL: string = (
  import.meta.env.VITE_PRESELECT_URL || (import.meta.env.DEV ? 'http://localhost:4322' : '')
).replace(/\/+$/, '')

export type OrganiserData = { event: string; companies: Company[]; applicants: ApplicantView[] }

export type OrganiserState =
  | { status: 'loading' }
  | { status: 'ready'; data: OrganiserData }
  | { status: 'error'; reason: string }

const NO_BACKEND = 'This build has no VITE_PRESELECT_URL, so there is no pre-selection backend.'

/** Reads the organiser's data once per mount. A failure is logged to the console with its cause. */
export function useOrganiserData(): OrganiserState {
  const [state, setState] = useState<OrganiserState>(
    PRESELECT_URL ? { status: 'loading' } : { status: 'error', reason: NO_BACKEND },
  )
  useEffect(() => {
    if (!PRESELECT_URL) {
      console.error(`[preselect] ${NO_BACKEND}`)
      return
    }
    const url = `${PRESELECT_URL}/api/organiser`
    const request = new AbortController()
    fetch(url, { signal: request.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`${url} answered ${response.status}`)
        setState({ status: 'ready', data: (await response.json()) as OrganiserData })
      })
      .catch((error: unknown) => {
        if (request.signal.aborted) return
        console.error(
          `[preselect] ${url} could not be read: is the backend running, and is ${location.origin} in its PRESELECT_ALLOWED_ORIGINS?`,
          error,
        )
        setState({ status: 'error', reason: `The pre-selection backend at ${PRESELECT_URL} could not be reached.` })
      })
    return () => request.abort()
  }, [])
  return state
}
