// The company side's shortlist for the real event: the pre-selection backend's applicants, scored in
// the browser with the backend's own code (apps/preselect/src/lib) as the sliders move. The same
// tool as the backend's organiser view, in the landing page's tone: its Bubble UI glass controls
// (ReactDrops Soap Bubble, used from apps/landing as they are) with the hero's approved material.
//
// One set of controls serves both layouts (shortlist.css): from 1024 px a sticky rail beside the
// applicants, below that a bottom sheet opened from a button at the foot of the screen.
import { useDeferredValue, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { ArrowLeft, ChevronDown, RotateCcw, SlidersHorizontal, Sparkles, X } from 'lucide-react'
import { GLASS, PALETTE } from '../../../landing/src/components/landing/settings.ts'
import {
  SoapBubbleButton,
  SoapBubbleIconButton,
  SoapBubbleMaterial,
  SoapBubbleSlider,
} from '../../../landing/src/components/soap-bubble/index.ts'
import { DEFAULT_SETTINGS, fieldShares, select } from '../../../preselect/src/lib/scoring.ts'
import { FIELDS, FIELD_BY_ID, TOOLS } from '../../../preselect/src/lib/taxonomy.ts'
import { traits } from '../../../preselect/src/lib/traits.ts'
import { SLIDER_IDS } from '../../../preselect/src/lib/types.ts'
import type { FieldId, Settings, SliderId } from '../../../preselect/src/lib/types.ts'
import { useOrganiserData, type OrganiserData } from '../lib/preselect'
import { useStore } from '../lib/store'
import { Ring, Tag, cx } from '../ui'
import './shortlist.css'

const SLIDERS: Record<SliderId, { label: string; hint: string }> = {
  experience: { label: 'Work experience', hint: 'Years of work, or of public activity when no work history is given.' },
  portfolio: {
    label: 'Size of portfolio',
    hint: 'How much work in the field can be seen, and how active and recent it is.',
  },
  toolBreadth: { label: 'Range of skills', hint: "How many of the field's tools and methods the applicant uses." },
  toolDepth: { label: 'Depth in one skill', hint: 'How strong the evidence is for a single tool or method.' },
  education: { label: 'Education', hint: 'Level of the degree and whether it is in the field.' },
  companyFit: {
    label: 'Match with companies',
    hint: 'How well the fields and skills fit what the participating companies look for.',
  },
}

const COUNTS = [20, 500, 1000]

// Skills grouped under the first field they belong to, for the depth picker.
const SKILL_GROUPS = FIELDS.map((field) => ({
  field,
  skills: TOOLS.filter((t) => t.fields[0] === field.id)
    .map((t) => t.name)
    .sort((a, b) => a.localeCompare(b)),
}))

// Seen in a portfolio, or only stated by the applicant.
const BASIS_DOT = { verified: 'bg-good', claimed: 'bg-coral' } as const

// The rail and the sheet are one element; which one it is follows this media query (shortlist.css).
const DESKTOP = '(min-width: 1024px)'

function useMedia(query: string) {
  const [matches, setMatches] = useState(() => matchMedia(query).matches)
  useEffect(() => {
    const list = matchMedia(query)
    const read = () => setMatches(list.matches)
    read()
    list.addEventListener('change', read)
    return () => list.removeEventListener('change', read)
  }, [query])
  return matches
}

function Shell({
  children,
  context = 'Shortlist',
  status,
}: {
  children: ReactNode
  context?: string
  status?: ReactNode
}) {
  const store = useStore()
  return (
    // One material for every glass control on the screen. No `backdrop`: a captured backdrop is an
    // html-to-image rendering (data: and blob: images the app's CSP does not allow), and these
    // controls sit on the plain paper, where the live page showing through looks the same.
    <SoapBubbleMaterial {...GLASS}>
      <div className="sl">
        <header className="sl-header">
          <SoapBubbleIconButton aria-label="Back" onClick={store.back}>
            <ArrowLeft aria-hidden="true" />
          </SoapBubbleIconButton>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-mute">{context}</p>
            <h1 className="truncate font-display text-xl font-extrabold leading-tight lg:text-2xl">
              Pick who gets a place
            </h1>
          </div>
          {status}
        </header>
        {children}
      </div>
    </SoapBubbleMaterial>
  )
}

function Slider(props: { id: SliderId; value: number; onChange: (value: number) => void; children?: ReactNode }) {
  const { label, hint } = SLIDERS[props.id]
  const fraction = props.value / 100
  return (
    <div className="sl-slider-row">
      <div className="flex items-baseline justify-between gap-2" aria-hidden="true">
        <span className="font-display font-bold">{label}</span>
        <span className="text-sm font-medium tabular-nums text-mute">
          {props.value === 0 ? 'ignored' : props.value}
        </span>
      </div>
      <SoapBubbleSlider
        className="sl-slider"
        label={label}
        value={props.value}
        min={0}
        max={100}
        step={5}
        onValueChange={props.onChange}
        from={PALETTE.forest}
        to={PALETTE.lime}
        // Where the fill ends, for the track drawn without WebGL (shortlist.css): the thumb's centre.
        style={{ '--sl-fill': `calc(19px + ${fraction} * (100% - 38px))` } as CSSProperties}
      />
      <p className="text-xs text-mute">{hint}</p>
      {props.children}
    </div>
  )
}

function Bar({ value, tone = 'forest' }: { value: number; tone?: 'forest' | 'lime' }) {
  return (
    <span
      className={cx('block h-1.5 w-full overflow-hidden rounded-full', tone === 'lime' ? 'bg-white/20' : 'bg-line')}
    >
      <span
        className={cx('block h-full rounded-full', tone === 'lime' ? 'bg-lime' : 'bg-forest')}
        style={{ width: `${Math.round(value * 100)}%` }}
      />
    </span>
  )
}

export function Shortlist() {
  const state = useOrganiserData()
  if (state.status === 'loading')
    return (
      <Shell>
        <p role="status" className="mt-16 text-center text-sm text-mute">
          Loading the applicants…
        </p>
      </Shell>
    )
  if (state.status === 'error')
    return (
      <Shell>
        <div role="alert" className="sl-note">
          <p className="font-display text-lg font-bold">The applicants could not be loaded</p>
          <p className="mt-1 text-sm text-mute">{state.reason}</p>
        </div>
      </Shell>
    )
  return <Organiser data={state.data} />
}

function Organiser({ data }: { data: OrganiserData }) {
  const { applicants, companies, event } = data
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [shown, setShown] = useState<FieldId | 'all'>('all')
  const desktop = useMedia(DESKTOP)
  const [open, setOpen] = useState(false)
  const sheetOpen = open && !desktop

  // The controls answer at once; the list follows as soon as the browser has a moment, so a slider
  // stays smooth over 170 cards. The ranking is the same, only drawn a frame later.
  const scored = useDeferredValue(settings)
  const classified = useMemo(() => companies.filter((c) => c.status === 'ok'), [companies])
  const shares = useMemo(() => fieldShares(classified), [classified])
  const selection = useMemo(() => select(applicants, scored, shares), [applicants, scored, shares])
  const readable = applicants.filter((a) => a.sources.some((s) => s.ok)).length
  const maxShare = Math.max(...FIELDS.map((f) => shares[f.id]))

  const setWeight = (id: SliderId, value: number) =>
    setSettings((s) => ({ ...s, weights: { ...s.weights, [id]: value } }))
  const setCount = (count: number) =>
    setSettings((s) => ({ ...s, count: Math.max(1, Math.min(100_000, Math.round(count) || 1)) }))

  const perField = (field: FieldId) => selection.suggestions.filter((s) => s.field === field).length
  const visible = selection.suggestions.filter((s) => shown === 'all' || s.field === shown)
  const suggested = selection.suggestions.length

  // The sheet: Escape closes it, focus moves into it and back to the button that opened it.
  const opener = useRef<HTMLButtonElement>(null)
  const closer = useRef<HTMLButtonElement>(null)
  const wasOpen = useRef(false)
  useEffect(() => {
    if (sheetOpen) closer.current?.focus({ preventScroll: true })
    else if (wasOpen.current && !desktop) opener.current?.focus({ preventScroll: true })
    wasOpen.current = sheetOpen
    if (!sheetOpen) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [sheetOpen, desktop])

  const count = (
    <span className="tabular-nums">
      <strong className="font-display text-base">{suggested}</strong> suggested
    </span>
  )

  return (
    <Shell context={`${event} · ${classified.length} companies`} status={<p className="sl-status">{count}</p>}>
      <p className="sr-only" aria-live="polite">
        {suggested} suggested
      </p>
      <div className="sl-body">
        <aside
          id="sl-controls"
          className="sl-controls"
          data-open={sheetOpen || undefined}
          aria-labelledby="sl-controls-title"
          role={desktop ? undefined : 'dialog'}
          aria-modal={desktop ? undefined : true}
          inert={!desktop && !open}
        >
          <div className="sl-sheet-head">
            <span className="sl-grabber" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <h2 id="sl-controls-title" className="font-display text-lg font-bold">
                Tune the ranking
              </h2>
              <p className="text-sm text-mute">
                {count} of {readable}
              </p>
            </div>
            <SoapBubbleIconButton ref={closer} aria-label="Close the settings" onClick={() => setOpen(false)}>
              <X aria-hidden="true" />
            </SoapBubbleIconButton>
          </div>

          <section className="sl-panel" aria-labelledby="sl-count-title">
            <h2 id="sl-count-title" className="font-display text-lg font-bold">
              How many should we suggest?
            </h2>
            <div className="sl-counts">
              {COUNTS.map((n) => (
                <SoapBubbleButton
                  key={n}
                  className="sl-count"
                  aria-pressed={settings.count === n}
                  tint={settings.count === n ? PALETTE.limeRgb : undefined}
                  opacity={settings.count === n ? 0.92 : undefined}
                  onClick={() => setCount(n)}
                >
                  {n}
                </SoapBubbleButton>
              ))}
              <input
                type="number"
                min={1}
                inputMode="numeric"
                aria-label="Other number of applicants"
                value={settings.count}
                onChange={(e) => setCount(Number(e.target.value))}
                className="sl-number"
              />
            </div>
          </section>

          <section className="sl-panel" aria-labelledby="sl-weights-title">
            <div>
              <h2 id="sl-weights-title" className="font-display text-lg font-bold">
                What matters most?
              </h2>
              <p className="text-xs text-mute">
                Move a slider to the right to make it count more. The details behind each one are worked out for you.
              </p>
            </div>
            {SLIDER_IDS.map((id) => (
              <Slider key={id} id={id} value={settings.weights[id]} onChange={(value) => setWeight(id, value)}>
                {id === 'toolDepth' && (
                  // A native select: the skills come in groups by field, which the bubble menu (a flat
                  // list of actions) cannot hold, and phones show their own picker for it.
                  <div className="sl-select-wrap">
                    <select
                      aria-label="Skill to look at"
                      value={settings.focusTool ?? ''}
                      onChange={(e) => setSettings((s) => ({ ...s, focusTool: e.target.value || null }))}
                      className="sl-select"
                    >
                      <option value="">Each applicant's strongest skill</option>
                      {SKILL_GROUPS.map(({ field, skills }) => (
                        <optgroup key={field.id} label={field.short}>
                          {skills.map((skill) => (
                            <option key={skill} value={skill}>
                              {skill}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                    <ChevronDown className="sl-select-icon" aria-hidden="true" />
                  </div>
                )}
              </Slider>
            ))}
            <SoapBubbleButton
              className="sl-reset"
              onClick={() => setSettings((s) => ({ ...DEFAULT_SETTINGS, count: s.count }))}
            >
              <RotateCcw aria-hidden="true" />
              Reset sliders
            </SoapBubbleButton>
          </section>
        </aside>

        <div className="sl-scrim" hidden={!sheetOpen} onClick={() => setOpen(false)} aria-hidden="true" />

        <main className="sl-main">
          <div className="sl-intro">
            <div className="min-w-0">
              <p className="text-sm text-mute">
                {suggested} suggested of {readable} applicants with readable portfolios. This is a suggestion: you
                decide who gets a place.
              </p>
            </div>
            <div className="sl-legend">
              <span className="flex items-center gap-1.5">
                <span className={cx('size-2 rounded-full', BASIS_DOT.verified)} /> seen in a portfolio
              </span>
              <span className="flex items-center gap-1.5">
                <span className={cx('size-2 rounded-full', BASIS_DOT.claimed)} /> stated by the applicant
              </span>
            </div>
          </div>

          <section className="sl-places" aria-labelledby="sl-places-title">
            <h2 id="sl-places-title" className="font-display text-base font-bold">
              Places per field
            </h2>
            <div className="sl-fields" role="group" aria-label="Show the applicants of one field">
              <button type="button" className="sl-field" aria-pressed={shown === 'all'} onClick={() => setShown('all')}>
                <span className="sl-field-name">All fields</span>
                <span className="sl-field-meta">
                  {suggested} of {readable} readable
                </span>
              </button>
              {FIELDS.map((field) => (
                <button
                  key={field.id}
                  type="button"
                  className="sl-field"
                  aria-pressed={shown === field.id}
                  onClick={() => setShown(field.id)}
                >
                  <span className="sl-field-name">{field.short}</span>
                  <span className="sl-field-meta">
                    {perField(field.id)} of {selection.pool[field.id]} · {Math.round(shares[field.id] * 100)}%
                  </span>
                  <Bar value={shares[field.id] / maxShare} tone={shown === field.id ? 'lime' : 'forest'} />
                </button>
              ))}
            </div>
            <p className="mt-1 text-xs text-mute">
              {classified.length
                ? `Split by the fields of the ${classified.length} participating companies. A field with too few suitable applicants passes its places on.`
                : 'No company data yet: every field gets an equal share.'}
            </p>
          </section>

          {visible.length === 0 ? (
            <div className="sl-note">
              {shown !== 'all' && suggested > 0 ? (
                <>
                  <p className="font-display text-lg font-bold">No one suggested in {FIELD_BY_ID[shown].short}</p>
                  <p className="mt-1 text-sm text-mute">Its places went to other fields with these settings.</p>
                </>
              ) : (
                <>
                  <p className="font-display text-lg font-bold">
                    {applicants.length ? 'No applicant scores above zero' : 'No applicants yet'}
                  </p>
                  <p className="mt-1 text-sm text-mute">
                    {applicants.length
                      ? 'Move the sliders to see more.'
                      : 'Profiles sent from the landing page appear here.'}
                  </p>
                </>
              )}
            </div>
          ) : (
            <ul className="sl-cards">
              {visible.map((s, index) => (
                <li key={s.applicant.id} className="sl-card">
                  <div className="flex items-start gap-3">
                    <span className="w-7 shrink-0 pt-0.5 font-display text-lg font-bold tabular-nums text-mute">
                      <span className="sr-only">Rank </span>
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-display text-lg font-bold leading-tight">{s.applicant.alias}</h3>
                      <p className="mt-0.5 text-xs text-mute">
                        {FIELD_BY_ID[s.field].name}
                        {s.overflow && ' · place passed on from another field'}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-center">
                      <div className="sl-score" aria-label={`Fit ${Math.round(s.score)} of 100`}>
                        <Ring value={Math.round(s.score)} size={52} />
                      </div>
                      <span className="mt-0.5 text-[10px] text-mute" aria-hidden="true">
                        fit, 0 to 100
                      </span>
                    </div>
                  </div>
                  {s.applicant.priority && (
                    <div>
                      <Tag tone="lime">
                        <Sparkles size={12} />
                        Priority: {s.applicant.priority.reasons.join(' · ')}
                      </Tag>
                    </div>
                  )}

                  <ul className="flex flex-col gap-1.5 text-sm">
                    {traits(s.applicant.signals, s.field, scored, s.parts, s.applicant.companies).map((trait) => (
                      <li key={trait.text} className="flex gap-2">
                        <span className={cx('mt-1.5 size-2 shrink-0 rounded-full', BASIS_DOT[trait.basis])} />
                        <span>
                          <span className="sr-only">
                            {trait.basis === 'verified' ? 'Seen in a portfolio: ' : 'Stated by the applicant: '}
                          </span>
                          {trait.text}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <div className="sl-parts">
                    {SLIDER_IDS.map((id) => (
                      <div key={id} title={`${SLIDERS[id].label}: ${Math.round(s.parts[id] * 100)} of 100`}>
                        <Bar value={s.parts[id]} />
                        <p className="mt-1 text-[10px] leading-tight text-mute">
                          {SLIDERS[id].label}
                          <span className="sr-only">: {Math.round(s.parts[id] * 100)} of 100</span>
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-wrap gap-1.5 border-t border-line pt-3">
                    {s.applicant.sources.map((source) =>
                      source.ok ? (
                        <a
                          key={source.url ?? source.label}
                          href={source.url ?? undefined}
                          target="_blank"
                          rel="noreferrer"
                          className={cx(
                            'sl-source',
                            source.basis === 'verified' ? 'bg-good/12 text-[#14704c]' : 'bg-coral/15 text-[#b4391b]',
                          )}
                        >
                          {source.label}
                        </a>
                      ) : (
                        <span
                          key={source.url ?? source.label}
                          title={source.error}
                          className="sl-source bg-ink/6 text-mute line-through"
                        >
                          {source.label}
                        </span>
                      ),
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </main>
      </div>

      <div className="sl-tune">
        <SoapBubbleButton
          ref={opener}
          className="sl-tune-button"
          tint={PALETTE.limeRgb}
          opacity={0.92}
          aria-controls="sl-controls"
          aria-expanded={sheetOpen}
          onClick={() => setOpen(true)}
        >
          <SlidersHorizontal aria-hidden="true" />
          Tune the ranking
          <span className="sl-tune-count tabular-nums">{suggested}</span>
        </SoapBubbleButton>
      </div>
    </Shell>
  )
}
