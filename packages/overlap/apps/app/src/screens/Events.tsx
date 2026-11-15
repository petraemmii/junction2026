import { useState } from 'react'
import {
  Calendar,
  Check,
  ChevronRight,
  Clock,
  Lock,
  MapPin,
  SlidersHorizontal,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react'
import { COMPANIES, EVENTS, TALENTS, questionnaire } from '../lib/data'
import { eventFit, eventVisible, fitLabel, passCompany, passTalent, rankCompanies, rankTalents } from '../lib/fit'
import { EVENT_NAME } from '../../../preselect/src/lib/taxonomy.ts'
import { useStore } from '../lib/store'
import { Avatar, Btn, Card, Chip, DimBars, Page, Ring, Tag, TopBar, cx, hueOf } from '../ui'

export function QuizCta() {
  const s = useStore()
  const steps = questionnaire(s.r).length
  const started = s.step[s.r] > 0
  const perks =
    s.r === 'talent'
      ? [
          'Join any event with one tap',
          'Reveal your fit rating for every event & company',
          'Get discovered by teams that match you',
        ]
      : [
          'Join events and reveal candidate fit ratings',
          'Get a ranked shortlist of best candidates',
          'Appear to talents with a matching profile',
        ]
  return (
    <div className="rise relative overflow-hidden rounded-[28px] bg-forest p-5 text-white">
      <div className="absolute -right-8 -top-8 size-32 rounded-full bg-lime/20" />
      <div className="flex items-center gap-2">
        <Tag tone="lime">
          <Zap size={12} />
          {s.r === 'talent' ? '3 min' : '5 min'} / {steps} steps
        </Tag>
      </div>
      <h2 className="mt-3 font-display text-2xl font-extrabold leading-tight">
        {s.r === 'talent' ? 'Unlock your fit ratings' : 'Tell us who you hire'}
      </h2>
      <ul className="mt-3 space-y-1.5 text-sm text-white/80">
        {perks.map((p) => (
          <li key={p} className="flex gap-2">
            <Check size={16} className="mt-0.5 shrink-0 text-lime" />
            {p}
          </li>
        ))}
      </ul>
      <div className="mt-4">
        <Btn variant="lime" onClick={() => s.go({ name: 'quiz' })}>
          {started ? 'Continue questionnaire' : 'Start questionnaire'}
        </Btn>
      </div>
    </div>
  )
}

/** The company side's way into the shortlist of the real event (Shortlist.tsx). */
export function ShortlistCta() {
  const s = useStore()
  return (
    <button
      type="button"
      onClick={() => s.go({ name: 'shortlist' })}
      className="rise relative block w-full overflow-hidden rounded-[28px] bg-lime p-5 text-left text-forest transition active:scale-[.985]"
    >
      <div className="absolute -right-6 -top-6 size-28 rounded-full bg-coral" />
      <span className="relative inline-flex rounded-full bg-forest px-2.5 py-1 text-xs font-medium text-lime">
        {EVENT_NAME}
      </span>
      <h2 className="mt-3 font-display text-2xl font-extrabold leading-tight">Pick who gets a place</h2>
      <p className="mt-1 max-w-[16rem] text-sm text-forest/80">
        The event's real applicants, ranked as you move the sliders.
      </p>
      <span className="mt-3 flex items-center gap-1 font-display font-bold">
        Open the shortlist
        <ChevronRight size={18} />
      </span>
    </button>
  )
}

export function Home() {
  const s = useStore()
  const [cat, setCat] = useState('All')
  const cats = ['All', ...Array.from(new Set(EVENTS.map((e) => e.category)))]
  const events = EVENTS.filter((e) => (cat === 'All' || e.category === cat) && eventVisible(s.ctx, e))
  const name = (s.r === 'talent' ? s.talent.name : s.company.name).split(' ')[0]
  return (
    <Page>
      <TopBar
        title={name ? `Hi, ${name}` : 'Upcoming events'}
        right={
          <button
            onClick={() => s.go({ name: 'settings' })}
            aria-label="Filters"
            className="relative grid size-10 place-items-center rounded-full bg-card border border-line"
          >
            <SlidersHorizontal size={18} />
            {s.filters && <span className="absolute right-1 top-1 size-2 rounded-full bg-coral" />}
          </button>
        }
      />
      <h1 className="mb-4 mt-1 font-display text-3xl font-extrabold leading-tight">
        {s.r === 'talent' ? 'Events where you’ll fit in' : 'Events with your people'}
      </h1>
      {s.r === 'company' && (
        <div className="mb-4">
          <ShortlistCta />
        </div>
      )}
      {!s.completed && (
        <div className="mb-5">
          <QuizCta />
        </div>
      )}
      <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        {cats.map((c) => (
          <Chip key={c} on={cat === c} onClick={() => setCat(c)}>
            {c}
          </Chip>
        ))}
      </div>
      <div className="space-y-3">
        {events.map((e, i) => {
          const f = eventFit(s.ctx, e)
          const joined = s.joined[s.r].includes(e.id)
          return (
            <Card key={e.id} onClick={() => s.go({ name: 'event', id: e.id })} className="rise">
              <div style={{ animationDelay: `${i * 50}ms` }}>
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap gap-1.5">
                      <Tag>{e.category}</Tag>
                      {joined && (
                        <Tag tone="lime">
                          <Check size={12} />
                          Joined
                        </Tag>
                      )}
                    </div>
                    <h3 className="mt-2 font-display text-xl font-bold leading-tight">{e.title}</h3>
                    <p className="mt-1 text-sm text-mute">
                      {e.date} · {e.location}
                    </p>
                  </div>
                  <Ring value={f.score} size={60} locked={!s.completed} />
                </div>
                {s.completed ? (
                  <div className="mt-3 flex gap-2 text-xs">
                    <span className="flex items-center gap-1 rounded-full bg-[#1f9d6b]/12 px-2.5 py-1 font-medium text-[#14704c]">
                      <TrendingUp size={12} />
                      {f.strongest.dim}
                    </span>
                    <span className="flex items-center gap-1 rounded-full bg-coral/15 px-2.5 py-1 font-medium text-[#b4391b]">
                      <TrendingDown size={12} />
                      {f.gap.dim}
                    </span>
                  </div>
                ) : (
                  <p className="mt-3 flex items-center gap-1.5 text-xs text-mute">
                    <Lock size={12} />
                    Complete the questionnaire to see your fit
                  </p>
                )}
              </div>
            </Card>
          )
        })}
        {!events.length && (
          <Card className="text-center">
            <p className="font-display text-lg font-bold">No events match your filters</p>
            <p className="mt-1 text-sm text-mute">Loosen them in your profile to see more.</p>
            <div className="mt-3">
              <Btn variant="ghost" onClick={() => s.go({ name: 'settings' })}>
                Edit filters
              </Btn>
            </div>
          </Card>
        )}
      </div>
    </Page>
  )
}

export function EventDetail({ id }: { id: string }) {
  const s = useStore()
  const e = EVENTS.find((x) => x.id === id)!
  const f = eventFit(s.ctx, e)
  const joined = s.joined[s.r].includes(e.id)
  const locked = !s.completed
  const companies = e.companyIds.map((cid) => COMPANIES.find((c) => c.id === cid)!)
  const ranked = rankCompanies({ ...s.ctx, filters: false }).filter((r) => e.companyIds.includes(r.c.id))
  const cands = rankTalents(
    { ...s.ctx, filters: false },
    TALENTS.filter((t) => e.talentIds.includes(t.id)),
  )
  return (
    <Page nav={false} className="pb-32">
      <TopBar back />
      <div className="rise overflow-hidden rounded-[28px] bg-forest p-5 text-white">
        <Tag tone="lime">{e.category}</Tag>
        <h1 className="mt-3 font-display text-3xl font-extrabold leading-tight">{e.title}</h1>
        <div className="mt-3 space-y-1.5 text-sm text-white/75">
          <div className="flex items-center gap-2">
            <Calendar size={15} />
            {e.date}
          </div>
          <div className="flex items-center gap-2">
            <Clock size={15} />
            {e.time}
          </div>
          <div className="flex items-center gap-2">
            <MapPin size={15} />
            {e.location}
          </div>
          <div className="flex items-center gap-2">
            <Users size={15} />
            {e.going} going
          </div>
        </div>
        <p className="mt-4 text-sm text-white/85">{e.blurb}</p>
      </div>

      <section className="mt-5">
        <Card>
          <div className="flex items-center gap-4">
            <Ring value={f.score} size={72} locked={locked} />
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-mute">Your fit rating</div>
              <div className="font-display text-2xl font-extrabold">{locked ? 'Locked' : fitLabel(f.score)}</div>
            </div>
          </div>
          {locked ? (
            <div className="mt-4 rounded-2xl bg-lime/40 p-4">
              <div className="flex gap-2 font-display font-bold text-forest">
                <Sparkles size={18} />
                See your strongest overlap & biggest gap
              </div>
              <p className="mt-1 text-sm text-forest/80">
                A short questionnaire reveals exactly where you align with this event.
              </p>
              <div className="mt-3">
                <Btn onClick={() => s.go({ name: 'quiz' })}>Fill in questionnaire</Btn>
              </div>
            </div>
          ) : (
            <>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-[#1f9d6b]/12 p-3">
                  <div className="flex items-center gap-1 text-xs font-medium text-[#14704c]">
                    <TrendingUp size={14} />
                    Strongest overlap
                  </div>
                  <div className="mt-1 font-display text-lg font-bold">{f.strongest.dim}</div>
                  <div className="text-sm text-mute">{f.strongest.value}% match</div>
                </div>
                <div className="rounded-2xl bg-coral/15 p-3">
                  <div className="flex items-center gap-1 text-xs font-medium text-[#b4391b]">
                    <TrendingDown size={14} />
                    Biggest gap
                  </div>
                  <div className="mt-1 font-display text-lg font-bold">{f.gap.dim}</div>
                  <div className="text-sm text-mute">{f.gap.value}% match</div>
                </div>
              </div>
              <div className="mt-5">
                <DimBars dims={f.dims} />
              </div>
            </>
          )}
        </Card>
      </section>

      {s.r === 'talent' ? (
        <section className="mt-6">
          <h2 className="mb-3 font-display text-xl font-bold">Companies joining ({companies.length})</h2>
          <div className="space-y-2">
            {ranked.map(({ c, fit }) => (
              <Card key={c.id} className={cx('flex items-center gap-3', !passCompany(s.ctx, c) && 'opacity-55')}>
                <Avatar name={c.name} hue={c.hue} square />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-display font-bold">{c.name}</div>
                  <div className="truncate text-xs text-mute">
                    {c.field} · {c.city}
                    {!passCompany(s.ctx, c) && ' · outside your filters'}
                  </div>
                </div>
                <Ring value={fit.score} size={46} locked={locked} />
              </Card>
            ))}
          </div>
        </section>
      ) : (
        <>
          <section className="mt-6">
            <h2 className="mb-3 font-display text-xl font-bold">Best-fitting candidates</h2>
            <div className="space-y-2">
              {cands.map(({ t, fit }) => (
                <Card key={t.id} className={cx('flex items-center gap-3', !passTalent(s.ctx, t) && 'opacity-55')}>
                  <Avatar name={t.name} hue={hueOf(t.name)} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-display font-bold">
                      {locked ? t.name.split(' ')[0] + ' ' + t.name.split(' ')[1][0] + '.' : t.name}
                    </div>
                    <div className="truncate text-xs text-mute">
                      {t.headline} · {t.years} yrs{!passTalent(s.ctx, t) && ' · outside your filters'}
                    </div>
                  </div>
                  <Ring value={fit.score} size={46} locked={locked} />
                </Card>
              ))}
            </div>
          </section>
          <section className="mt-6">
            <h2 className="mb-3 font-display text-xl font-bold">Companies joining</h2>
            <div className="flex flex-wrap gap-2">
              {companies.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center gap-2 rounded-full border border-line bg-card py-1 pl-1 pr-3 text-sm font-medium"
                >
                  <Avatar name={c.name} hue={c.hue} size={28} />
                  {c.name}
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      <div className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-md bg-gradient-to-t from-paper via-paper to-transparent px-4 pb-[max(env(safe-area-inset-bottom),16px)] pt-6">
        {locked ? (
          <Btn onClick={() => s.go({ name: 'quiz' })}>
            <Lock size={18} />
            Complete questionnaire to join
          </Btn>
        ) : joined ? (
          <Btn variant="ghost" onClick={() => s.toggleJoin(e.id)}>
            <Check size={18} />
            You’re going. Tap to leave
          </Btn>
        ) : (
          <Btn variant="lime" onClick={() => s.toggleJoin(e.id)}>
            Join event
            <ChevronRight size={18} />
          </Btn>
        )}
      </div>
    </Page>
  )
}
