import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { EventInfo } from '@/data/event'
import { EVENTS, SKULL_ASK, matchEvents, type LandingEvent } from '@/data/events'
import { looksLikeProfile, overlapLine, profilesEnabled, readProfile } from '@/lib/preselect'

/** What the assistant is doing; each phase maps onto one orb state. */
export type AskPhase = 'idle' | 'listening' | 'thinking' | 'searching' | 'speaking' | 'error'

export type AskFilters = { onlineOnly: boolean; minFit: number }

export type AskFlow = {
  phase: AskPhase
  /** One line for the live region under the ask box. */
  message: string
  /** The events currently in the field, best fit first. */
  shown: readonly LandingEvent[]
  filters: AskFilters
  /** The latest ask as the flow runs it (cleanAsk): the one in progress, else the last one run, also
      when it matched nothing ("" before the first). */
  asked: string
  busy: boolean
  ask: (text: string) => void
  setFilters: (next: Partial<AskFilters>) => void
  setListening: (listening: boolean) => void
  reset: () => void
}

export const DEFAULT_FILTERS: AskFilters = { onlineOnly: false, minFit: 40 }

/** An ask as the flow runs it: trimmed, with single spaces, at most 160 characters. */
export const cleanAsk = (text: string) => text.trim().replace(/\s+/g, ' ').slice(0, 160)

const plural = (count: number) => `${count} ${count === 1 ? 'event' : 'events'}`

/** What the ask box says while nothing is asked: how many events are in the field. */
export const idleLine = (events: number) => `${plural(events)} this season. Ask for what you want.`

/** What the ask box says about the event while a profile is read and after. */
export function eventLines(event: EventInfo) {
  const companies = `${event.companies} ${event.companies === 1 ? 'company' : 'companies'}`
  return {
    checking: `Checking your profile against ${companies}…`,
    noMatch: `No match with the ${companies} at ${event.name}.`,
    notProfile: `Give a public profile link to check your match with the ${companies}.`,
  }
}

function summary(shown: readonly LandingEvent[], filters: AskFilters): string {
  const filtered = filters.onlineOnly || filters.minFit !== DEFAULT_FILTERS.minFit
  const scope = `${filters.onlineOnly ? 'online ' : ''}events with a fit of ${filters.minFit} or more`
  if (!shown.length) {
    return `No ${scope}. ${filters.onlineOnly ? 'Lower the fit or turn off Online only.' : 'Lower the fit to see more.'}`
  }
  if (filtered) return `${shown.length} ${shown.length === 1 ? scope.replace('events', 'event') : scope}.`
  return idleLine(shown.length)
}

/**
 * The demo's small state machine. A profile runs think -> search -> speak (or error) and is
 * answered with the companies at the event it matches; any other ask is answered with a request
 * for a profile. The cards in the field stay as they are; only filter changes re-form them.
 */
export function useAskFlow(event: EventInfo): AskFlow {
  const lines = useMemo(() => eventLines(event), [event])
  const [phase, setPhase] = useState<AskPhase>('idle')
  const [asked, setAsked] = useState('')
  const [filters, setFilterState] = useState<AskFilters>(DEFAULT_FILTERS)
  const [shown, setShown] = useState<readonly LandingEvent[]>(() =>
    matchEvents(EVENTS, { query: '', ...DEFAULT_FILTERS }),
  )
  const [message, setMessage] = useState(() => summary(shown, DEFAULT_FILTERS))

  const timers = useRef<number[]>([])
  // What the timers read when they fire: the filters as of the last render.
  const latest = useRef({ filters })
  useEffect(() => {
    latest.current = { filters }
  }, [filters])

  // The profile being read by the pre-selection backend, if any.
  const reading = useRef<AbortController | null>(null)

  const clear = useCallback(() => {
    for (const id of timers.current) window.clearTimeout(id)
    timers.current = []
    reading.current?.abort()
    reading.current = null
  }, [])
  useEffect(() => clear, [clear])

  const later = useCallback((ms: number, run: () => void) => {
    timers.current.push(window.setTimeout(run, ms))
  }, [])

  /** Shorter beats when the visitor asked for less motion. */
  const pace = useCallback(
    (ms: number) => (window.matchMedia('(prefers-reduced-motion: reduce)').matches ? Math.min(ms, 250) : ms),
    [],
  )

  const settle = useCallback(
    (nextFilters: AskFilters) => {
      const answers = matchEvents(EVENTS, { query: '', ...nextFilters })
      setShown(answers)
      setMessage(summary(answers, nextFilters))
      if (!answers.length) {
        setPhase('idle')
        return
      }
      setPhase('speaking')
      later(pace(1100), () => setPhase('idle'))
    },
    [later, pace],
  )

  /** End an ask with its line; "error" is the red flash of no match. */
  const answer = useCallback(
    (line: string, kind: 'speaking' | 'error') => {
      clear()
      setMessage(line)
      setPhase(kind)
      later(pace(kind === 'error' ? 2200 : 2400), () => setPhase('idle'))
    },
    [clear, later, pace],
  )

  const ask = useCallback(
    (text: string) => {
      const next = cleanAsk(text)
      clear()
      setAsked(next)
      if (!next) {
        settle(latest.current.filters)
        return
      }
      setPhase('thinking')
      setMessage('Reading your ask…')
      const searching = () => {
        setPhase('searching')
        setMessage(lines.checking)
      }
      if (looksLikeProfile(next)) {
        // Whatever goes wrong with the backend, the visitor sees an ordinary no match; the cause
        // is in the console.
        if (!profilesEnabled) {
          console.error('[preselect] no backend: this build has no PUBLIC_PRESELECT_URL, so the profile is not read.')
          later(pace(900), () => {
            searching()
            later(pace(1500), () => answer(lines.noMatch, 'error'))
          })
          return
        }
        // Reading a public profile takes real time, so the answer waits for the backend.
        const request = new AbortController()
        reading.current = request
        later(pace(900), searching)
        void readProfile(next, request.signal).then((companies) => {
          if (request.signal.aborted) return
          if (companies === null) answer(lines.noMatch, 'error')
          else answer(overlapLine(event.name, companies) ?? lines.noMatch, companies.length ? 'speaking' : 'error')
        })
        return
      }
      // The Steve Jobs pill: searched, and matches nothing, so the red is full of skulls.
      if (next === SKULL_ASK) {
        later(pace(900), () => {
          searching()
          later(pace(1500), () => answer(lines.noMatch, 'error'))
        })
        return
      }
      later(pace(900), () => answer(lines.notProfile, 'speaking'))
    },
    [answer, clear, later, pace, settle, lines, event.name],
  )

  const setFilters = useCallback(
    (next: Partial<AskFilters>) => {
      const merged = { ...latest.current.filters, ...next }
      if (merged.onlineOnly === latest.current.filters.onlineOnly && merged.minFit === latest.current.filters.minFit)
        return
      latest.current = { filters: merged }
      setFilterState(merged)
      clear()
      setPhase('searching')
      setMessage('Re-checking the overlap…')
      later(pace(650), () => settle(merged))
    },
    [clear, later, pace, settle],
  )

  const setListening = useCallback((listening: boolean) => {
    setPhase((current) => {
      if (listening) return current === 'idle' ? 'listening' : current
      return current === 'listening' ? 'idle' : current
    })
  }, [])

  const reset = useCallback(() => {
    clear()
    latest.current = { filters: DEFAULT_FILTERS }
    setAsked('')
    setFilterState(DEFAULT_FILTERS)
    settle(DEFAULT_FILTERS)
  }, [clear, settle])

  return {
    phase,
    message,
    shown,
    filters,
    asked,
    busy: phase === 'thinking' || phase === 'searching',
    ask,
    setFilters,
    setListening,
    reset,
  }
}
