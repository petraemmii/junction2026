import { describe, expect, it } from 'vite-plus/test'

import { SKULL_ASK } from '@/data/events'
import { BEATS, cleanAsk, eventLines, idleLine, untilAnswer } from './use-ask-flow'

describe('idleLine', () => {
  it('counts the events in the field', () => {
    expect(idleLine(24)).toBe('24 events this season. Ask for what you want.')
    expect(idleLine(1)).toBe('1 event this season. Ask for what you want.')
  })
})

describe('eventLines', () => {
  const lines = eventLines({ name: 'Deep Tech Talent Forum', companies: 27 })

  it('speaks of the event and its companies while a profile is read', () => {
    expect(lines.checking).toBe('Checking your profile against 27 companies…')
    expect(lines.noMatch).toBe('No match with the 27 companies at Deep Tech Talent Forum.')
    expect(lines.notProfile).toBe('Give a public profile link to check your match with the 27 companies.')
  })

  it('says one company in the singular', () => {
    expect(eventLines({ name: 'Forum', companies: 1 }).checking).toBe('Checking your profile against 1 company…')
  })
})

describe('cleanAsk', () => {
  it('trims, keeps single spaces and cuts at 160 characters', () => {
    expect(cleanAsk('  design\n\tworkshops   in Munich ')).toBe('design workshops in Munich')
    expect(cleanAsk('a'.repeat(200))).toBe('a'.repeat(160))
    expect(cleanAsk(' \n ')).toBe('')
  })

  // Hero.tsx compares the cleaned ask with SKULL_ASK as is, so it must already be clean: then the
  // pill and the words typed with any spacing both bring the skulls.
  it('leaves the skull ask as it is', () => {
    expect(cleanAsk(SKULL_ASK)).toBe(SKULL_ASK)
    expect(cleanAsk('  He   is\n dead.  ')).toBe(SKULL_ASK)
  })
})

describe('untilAnswer', () => {
  const beats = BEATS.read + BEATS.check

  // A profile the backend has read before answers in a fraction of a second.
  it('holds an early answer back until the beats have ended', () => {
    expect(untilAnswer(250, beats)).toBe(2150)
    expect(untilAnswer(1300, beats)).toBe(1100)
  })

  it('does not hold back an answer that took longer than the beats', () => {
    expect(untilAnswer(beats, beats)).toBe(0)
    expect(untilAnswer(14_000, beats)).toBe(0)
  })
})
