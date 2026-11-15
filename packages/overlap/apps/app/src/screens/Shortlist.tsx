// The company side's shortlist for the real event: the pre-selection backend's applicants, scored in
// the browser with the backend's own code (apps/preselect/src/lib) as the sliders move. The same
// tool as the backend's organiser view, in this app's design.
import { useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { RotateCcw, Sparkles, Users } from 'lucide-react'
import { DEFAULT_SETTINGS, fieldShares, select } from '../../../preselect/src/lib/scoring.ts'
import { FIELDS, FIELD_BY_ID, TOOLS } from '../../../preselect/src/lib/taxonomy.ts'
import { traits } from '../../../preselect/src/lib/traits.ts'
import { SLIDER_IDS } from '../../../preselect/src/lib/types.ts'
import type { FieldId, Settings, SliderId } from '../../../preselect/src/lib/types.ts'
import { useOrganiserData, type OrganiserData } from '../lib/preselect'
import { Card, Chip, Ring, Tag, TopBar, cx } from '../ui'

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
const BASIS_DOT = { verified: 'bg-[#1f9d6b]', claimed: 'bg-coral' } as const

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto min-h-dvh max-w-6xl bg-paper px-4 pb-12">
      <TopBar title="Shortlist" back />
      {children}
    </div>
  )
}

function Slider(props: { id: SliderId; value: number; onChange: (value: number) => void; children?: ReactNode }) {
  const { label, hint } = SLIDERS[props.id]
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={`slider-${props.id}`} className="font-display font-bold">
          {label}
        </label>
        <span className="text-sm font-medium tabular-nums text-mute">
          {props.value === 0 ? 'ignored' : props.value}
        </span>
      </div>
      <input
        id={`slider-${props.id}`}
        type="range"
        min={0}
        max={100}
        step={5}
        value={props.value}
        onChange={(e) => props.onChange(Number(e.target.value))}
        style={{ '--p': `${props.value}%` } as CSSProperties}
      />
      <p className="text-xs text-mute">{hint}</p>
      {props.children}
    </div>
  )
}

function Bar({ value, tone = 'forest' }: { value: number; tone?: 'forest' | 'lime' }) {
  return (
    <span className={cx('block h-2 w-full overflow-hidden rounded-full', tone === 'lime' ? 'bg-white/15' : 'bg-line')}>
      <span
        className={cx('grow block h-full rounded-full', tone === 'lime' ? 'bg-lime' : 'bg-forest')}
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
        <p className="mt-10 text-center text-sm text-mute">Loading the applicants…</p>
      </Shell>
    )
  if (state.status === 'error')
    return (
      <Shell>
        <Card className="mt-6 text-center">
          <p className="font-display text-lg font-bold">The applicants could not be loaded</p>
          <p className="mt-1 text-sm text-mute">{state.reason}</p>
        </Card>
      </Shell>
    )
  return <Organiser data={state.data} />
}

function Organiser({ data }: { data: OrganiserData }) {
  const { applicants, companies, event } = data
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [shown, setShown] = useState<FieldId | 'all'>('all')

  const classified = useMemo(() => companies.filter((c) => c.status === 'ok'), [companies])
  const shares = useMemo(() => fieldShares(classified), [classified])
  const selection = useMemo(() => select(applicants, settings, shares), [applicants, settings, shares])
  const readable = applicants.filter((a) => a.sources.some((s) => s.ok)).length
  const maxShare = Math.max(...FIELDS.map((f) => shares[f.id]))

  const setWeight = (id: SliderId, value: number) =>
    setSettings((s) => ({ ...s, weights: { ...s.weights, [id]: value } }))
  const setCount = (count: number) =>
    setSettings((s) => ({ ...s, count: Math.max(1, Math.min(100_000, Math.round(count) || 1)) }))

  const perField = (field: FieldId) => selection.suggestions.filter((s) => s.field === field).length
  const visible = selection.suggestions.filter((s) => shown === 'all' || s.field === shown)

  return (
    <Shell>
      <div className="mb-5 mt-1">
        <Tag tone="lime">
          <Users size={12} />
          {event} · {classified.length} companies
        </Tag>
        <h1 className="mt-2 font-display text-3xl font-extrabold leading-tight">Pick who gets a place</h1>
        <p className="mt-1 text-sm text-mute">
          {selection.suggestions.length} suggested of {readable} applicants with readable portfolios. This is a
          suggestion: you decide who gets a place.
        </p>
      </div>

      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        <aside className="flex w-full shrink-0 flex-col gap-4 lg:sticky lg:top-16 lg:w-80">
          <Card className="rise">
            <h2 className="font-display text-lg font-bold">How many should we suggest?</h2>
            <div className="mt-3 flex gap-2">
              {COUNTS.map((count) => (
                <Chip key={count} small on={settings.count === count} onClick={() => setCount(count)}>
                  {count}
                </Chip>
              ))}
              <input
                type="number"
                min={1}
                aria-label="Other number of applicants"
                value={settings.count}
                onChange={(e) => setCount(Number(e.target.value))}
                className="w-20 rounded-full border border-line bg-card px-3 py-1 text-xs font-medium tabular-nums"
              />
            </div>
          </Card>

          <Card className="rise flex flex-col gap-4">
            <div>
              <h2 className="font-display text-lg font-bold">What matters most?</h2>
              <p className="text-xs text-mute">
                Move a slider to the right to make it count more. The details behind each one are worked out for you.
              </p>
            </div>
            {SLIDER_IDS.map((id) => (
              <Slider key={id} id={id} value={settings.weights[id]} onChange={(value) => setWeight(id, value)}>
                {id === 'toolDepth' && (
                  <select
                    aria-label="Skill to look at"
                    value={settings.focusTool ?? ''}
                    onChange={(e) => setSettings((s) => ({ ...s, focusTool: e.target.value || null }))}
                    className="mt-2 w-full rounded-2xl border border-line bg-card px-3 py-2 text-sm"
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
                )}
              </Slider>
            ))}
            <button
              type="button"
              onClick={() => setSettings((s) => ({ ...DEFAULT_SETTINGS, count: s.count }))}
              className="flex items-center gap-1.5 self-start text-sm font-medium text-forest underline"
            >
              <RotateCcw size={14} />
              Reset sliders
            </button>
          </Card>

          <Card className="rise !border-forest !bg-forest text-white">
            <h2 className="font-display text-lg font-bold">Places per field</h2>
            <p className="text-xs text-white/70">
              {classified.length
                ? `Split by the fields of the ${classified.length} participating companies. A field with too few suitable applicants passes its places on.`
                : 'No company data yet: every field gets an equal share.'}
            </p>
            <ul className="mt-3 flex flex-col gap-2.5">
              {FIELDS.map((field) => (
                <li key={field.id} className="text-xs">
                  <div className="mb-1 flex justify-between gap-2">
                    <span className="font-medium">{field.short}</span>
                    <span className="tabular-nums text-white/70">
                      {perField(field.id)} of {selection.pool[field.id]} · {Math.round(shares[field.id] * 100)}%
                    </span>
                  </div>
                  <Bar value={shares[field.id] / maxShare} tone="lime" />
                </li>
              ))}
            </ul>
          </Card>
        </aside>

        <main className="min-w-0 flex-1">
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] lg:mx-0 lg:flex-wrap lg:px-0">
            {(['all', ...FIELDS.map((f) => f.id)] as const).map((id) => (
              <Chip key={id} small on={shown === id} onClick={() => setShown(id)}>
                <span className="whitespace-nowrap">
                  {id === 'all' ? 'All fields' : FIELD_BY_ID[id].short} ·{' '}
                  {id === 'all' ? selection.suggestions.length : perField(id)}
                </span>
              </Chip>
            ))}
          </div>
          <div className="mt-3 flex gap-4 text-xs text-mute">
            <span className="flex items-center gap-1.5">
              <span className={cx('size-2 rounded-full', BASIS_DOT.verified)} /> seen in a portfolio
            </span>
            <span className="flex items-center gap-1.5">
              <span className={cx('size-2 rounded-full', BASIS_DOT.claimed)} /> stated by the applicant
            </span>
          </div>

          {visible.length === 0 ? (
            <Card className="mt-4 text-center">
              <p className="font-display text-lg font-bold">
                {applicants.length ? 'No applicant scores above zero' : 'No applicants yet'}
              </p>
              <p className="mt-1 text-sm text-mute">
                {applicants.length
                  ? 'Move the sliders to see more.'
                  : 'Profiles sent from the landing page appear here.'}
              </p>
            </Card>
          ) : (
            <ul className="mt-4 grid gap-3 xl:grid-cols-2">
              {visible.map((s, index) => (
                <li key={s.applicant.id}>
                  <Card className="flex h-full flex-col gap-3">
                    <div className="flex items-start gap-3">
                      <span className="w-6 pt-1 text-center font-display font-bold text-mute">{index + 1}</span>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-display text-lg font-bold leading-tight">{s.applicant.alias}</h3>
                        <p className="mt-0.5 text-xs text-mute">
                          {FIELD_BY_ID[s.field].name}
                          {s.overflow && ' · place passed on from another field'}
                        </p>
                        {s.applicant.priority && (
                          <div className="mt-1.5">
                            <Tag tone="lime">
                              <Sparkles size={12} />
                              Priority: {s.applicant.priority.reasons.join(' · ')}
                            </Tag>
                          </div>
                        )}
                      </div>
                      <Ring value={Math.round(s.score)} size={52} />
                    </div>

                    <ul className="flex flex-col gap-1.5 text-sm">
                      {traits(s.applicant.signals, s.field, settings, s.parts, s.applicant.companies).map((trait) => (
                        <li key={trait.text} className="flex gap-2">
                          <span className={cx('mt-1.5 size-2 shrink-0 rounded-full', BASIS_DOT[trait.basis])} />
                          <span>{trait.text}</span>
                        </li>
                      ))}
                    </ul>

                    <div className="mt-auto grid grid-cols-3 gap-x-3 gap-y-2 pt-1 sm:grid-cols-6">
                      {SLIDER_IDS.map((id) => (
                        <div key={id} title={`${SLIDERS[id].label}: ${Math.round(s.parts[id] * 100)} of 100`}>
                          <Bar value={s.parts[id]} />
                          <p className="mt-1 truncate text-[10px] text-mute">{SLIDERS[id].label}</p>
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
                              'rounded-full px-2.5 py-1 text-xs font-medium',
                              source.basis === 'verified'
                                ? 'bg-[#1f9d6b]/12 text-[#14704c]'
                                : 'bg-coral/15 text-[#b4391b]',
                            )}
                          >
                            {source.label}
                          </a>
                        ) : (
                          <span
                            key={source.url ?? source.label}
                            title={source.error}
                            className="rounded-full bg-ink/6 px-2.5 py-1 text-xs text-mute line-through"
                          >
                            {source.label}
                          </span>
                        ),
                      )}
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </main>
      </div>
    </Shell>
  )
}
