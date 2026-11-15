import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Answers, CompanyProfile, Role, TalentProfile } from './data'
import type { Ctx } from './fit'
import { CAME_FROM_GET_STARTED } from './handoff'

export type Route =
  | { name: 'login' }
  | { name: 'loading' }
  | { name: 'role' }
  | { name: 'home' }
  | { name: 'event'; id: string }
  | { name: 'quiz' }
  | { name: 'results' }
  | { name: 'settings' }
  | { name: 'overview' }
  | { name: 'shortlist' }

type State = {
  email: string
  role: Role | null
  talent: TalentProfile
  company: CompanyProfile
  answers: Record<Role, Answers>
  done: Record<Role, boolean>
  step: Record<Role, number>
  joined: Record<Role, string[]>
  filters: boolean
}
const initial: State = {
  email: '',
  role: null,
  talent: {
    name: '',
    field: '',
    languages: [],
    years: 0,
    availability: 'Within 1 month',
    permit: 'EU citizen',
    skills: [],
  },
  company: { name: '', field: '', languages: [], skills: [] },
  answers: { talent: {}, company: {} },
  done: { talent: false, company: false },
  step: { talent: 0, company: 0 },
  joined: { talent: [], company: [] },
  filters: true,
}
/** The account of "Try the demo", and of a visitor handed over by the landing page's /get-started. */
export const DEMO_EMAIL = 'demo@overlap.app'

const KEY = 'overlap-state-v1'
const stored = (): State => {
  try {
    return { ...initial, ...JSON.parse(localStorage.getItem(KEY) || '{}') }
  } catch {
    return initial
  }
}
// A visitor from /get-started without a stored email is signed in as the demo (handoff.ts), so
// Loading goes on to the role choice or home instead of the login.
const load = (): State => {
  const state = stored()
  return CAME_FROM_GET_STARTED && !state.email ? { ...state, email: DEMO_EMAIL } : state
}

type Store = State & {
  route: Route
  go: (r: Route, replace?: boolean) => void
  back: () => void
  signIn: (email: string) => void
  signOut: () => void
  setRole: (r: Role) => void
  patch: (p: Partial<State>) => void
  setTalent: (p: Partial<TalentProfile>) => void
  setCompany: (p: Partial<CompanyProfile>) => void
  setAnswer: (id: string, v: number | string[]) => void
  toggleJoin: (id: string) => void
  ctx: Ctx
  r: Role
  completed: boolean
}
const C = createContext<Store>(null as never)
export const useStore = () => useContext(C)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [s, setS] = useState<State>(load)
  const [stack, setStack] = useState<Route[]>([{ name: 'loading' }])
  useEffect(() => localStorage.setItem(KEY, JSON.stringify(s)), [s])
  const route = stack[stack.length - 1]
  const go = useCallback((r: Route, replace = false) => {
    window.scrollTo(0, 0)
    setStack((st) => (replace || ['home', 'results', 'settings', 'overview'].includes(r.name) ? [r] : [...st, r]))
  }, [])
  const back = useCallback(() => setStack((st) => (st.length > 1 ? st.slice(0, -1) : st)), [])
  const patch = (p: Partial<State>) => setS((x) => ({ ...x, ...p }))
  const r: Role = s.role ?? 'talent'
  const store: Store = {
    ...s,
    route,
    go,
    back,
    patch,
    r,
    signIn: (email) => patch({ email }),
    signOut: () => {
      setS({ ...initial })
      setStack([{ name: 'login' }])
    },
    setRole: (role) => patch({ role }),
    setTalent: (p) => setS((x) => ({ ...x, talent: { ...x.talent, ...p } })),
    setCompany: (p) => setS((x) => ({ ...x, company: { ...x.company, ...p } })),
    setAnswer: (id, v) => setS((x) => ({ ...x, answers: { ...x.answers, [r]: { ...x.answers[r], [id]: v } } })),
    toggleJoin: (id) =>
      setS((x) => {
        const j = x.joined[r]
        return { ...x, joined: { ...x.joined, [r]: j.includes(id) ? j.filter((i) => i !== id) : [...j, id] } }
      }),
    completed: s.done[r],
    ctx: useMemo(
      () => ({ role: r, talent: s.talent, company: s.company, answers: s.answers[r], filters: s.filters }),
      [r, s.talent, s.company, s.answers, s.filters],
    ),
  }
  return <C.Provider value={store}>{children}</C.Provider>
}
