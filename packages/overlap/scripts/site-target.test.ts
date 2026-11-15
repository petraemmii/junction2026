import { describe, expect, it } from 'vite-plus/test'

import { DEFAULT_SITE_BASE, PRESELECT_PATH, normalizeBase, prefixHeaderRules, preselectTarget } from './site-target.mjs'

describe('normalizeBase', () => {
  it('takes the base with or without its slashes', () => {
    for (const value of ['/submission', '/submission/', 'submission', 'submission/', ' /submission// ']) {
      expect(normalizeBase(value), value).toBe('/submission/')
    }
    expect(normalizeBase('/a/b')).toBe('/a/b/')
  })

  it('reads unset, empty and "/" as the root', () => {
    for (const value of [undefined, '', '/', '//', ' ']) expect(normalizeBase(value), String(value)).toBe('/')
  })

  it('refuses anything but a plain path', () => {
    for (const value of ['https://junction2026.com/submission', '/a b', '/a/../b', '/./a', '/a?b', '/a#b', '/a//b']) {
      expect(() => normalizeBase(value), value).toThrow(/SITE_BASE/)
    }
  })

  it('accepts the default', () => {
    expect(normalizeBase(DEFAULT_SITE_BASE)).toBe(DEFAULT_SITE_BASE)
    expect(DEFAULT_SITE_BASE).not.toBe('/')
  })
})

describe('prefixHeaderRules', () => {
  const headers = [
    '# Every response: /* and /app/ in a comment stay as they are.',
    '/*',
    '  X-Content-Type-Options: nosniff',
    "  Content-Security-Policy: default-src 'self'; form-action 'self'",
    '',
    '/_astro/*',
    '  Cache-Control: public, max-age=31536000, immutable',
    '/app/',
    '  ! Content-Security-Policy',
    "  Content-Security-Policy: default-src 'self'",
    '/app/sw.js',
    '  Cache-Control: no-cache',
    '/',
    '  X-Home: yes',
    '',
  ].join('\n')

  it('moves every rule below the base and keeps the other lines', () => {
    expect(prefixHeaderRules(headers, '/submission/')).toBe(
      [
        '# Every response: /* and /app/ in a comment stay as they are.',
        '/submission*',
        '  X-Content-Type-Options: nosniff',
        "  Content-Security-Policy: default-src 'self'; form-action 'self'",
        '',
        '/submission/_astro/*',
        '  Cache-Control: public, max-age=31536000, immutable',
        '/submission/app/',
        '  ! Content-Security-Policy',
        "  Content-Security-Policy: default-src 'self'",
        '/submission/app/sw.js',
        '  Cache-Control: no-cache',
        '/submission',
        '  X-Home: yes',
        '',
      ].join('\n'),
    )
  })

  it('handles a deeper base, CRLF line ends and the root', () => {
    expect(prefixHeaderRules('/*\r\n  A: b\r\n/events/*\r\n', '/a/b/')).toBe('/a/b*\r\n  A: b\r\n/a/b/events/*\r\n')
    expect(prefixHeaderRules(headers, '/')).toBe(headers)
  })
})

describe('preselectTarget', () => {
  it('bundles the backend below the base when PUBLIC_PRESELECT_URL is unset', () => {
    expect(preselectTarget(undefined, '/submission/')).toEqual({
      bundle: true,
      url: '/submission/preselect',
      path: '/submission/preselect',
    })
    expect(preselectTarget(undefined, '/')).toEqual({ bundle: true, url: '/preselect', path: '/preselect' })
    expect(PRESELECT_PATH).toBe('/preselect/')
  })

  it('uses a backend deployed elsewhere when it is a URL', () => {
    expect(preselectTarget('https://preselect.example.com', '/submission/')).toEqual({
      bundle: false,
      url: 'https://preselect.example.com',
      path: null,
    })
  })

  it('builds a site without a backend when it is empty', () => {
    for (const value of ['', ' ']) {
      expect(preselectTarget(value, '/submission/'), JSON.stringify(value)).toEqual({
        bundle: false,
        url: '',
        path: null,
      })
    }
  })
})
