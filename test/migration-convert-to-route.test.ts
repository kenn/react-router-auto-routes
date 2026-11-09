import { describe, expect, it } from 'vitest'
import {
  convertToRoute,
  escapeRouteSegment,
  normalizeSnapshotRouteFilePath,
} from '../src/migration/normalizers'

describe('convertToRoute', () => {
  it('turns parent routes into layout files', () => {
    expect(convertToRoute('app/routes', 'app/routes/admin', true)).toBe(
      'admin/_layout',
    )
    expect(
      convertToRoute('app/routes', 'app/routes/admin/dashboard', false),
    ).toBe('admin/dashboard')
  })

  it('normalizes + suffix legacy folders', () => {
    expect(
      convertToRoute('app/routes', 'app/routes/app+/reports+/$id+', false),
    ).toBe('app/reports/$id+')
  })

  it('reduces double underscore prefixes to single underscores', () => {
    expect(convertToRoute('app/routes', 'app/routes/__auth', false)).toBe(
      '_auth',
    )
  })
})

describe('normalizeSnapshotRouteFilePath', () => {
  it('collapses layout files to their parent route', () => {
    expect(
      normalizeSnapshotRouteFilePath('routes/settings/profile/_layout.tsx'),
    ).toBe('routes/settings/profile.tsx')
  })

  it('maps index files to dotted notation', () => {
    expect(
      normalizeSnapshotRouteFilePath('routes/settings/profile/index.tsx'),
    ).toBe('routes/settings/profile.index.tsx')
  })

  it('collapses folder route files (route.tsx) to their parent route', () => {
    expect(normalizeSnapshotRouteFilePath('routes/demo/about/route.tsx')).toBe(
      'routes/demo/about.tsx',
    )
    expect(normalizeSnapshotRouteFilePath('routes/demo/_index/route.tsx')).toBe(
      'routes/demo/_index.tsx',
    )
    expect(
      normalizeSnapshotRouteFilePath('routes/_public/($lang)._index/route.tsx'),
    ).toBe('routes/_public/($lang)._index.tsx')
  })

  it('merges pathless underscore segments', () => {
    expect(normalizeSnapshotRouteFilePath('routes/root_/__public.tsx')).toBe(
      'routes/root.public.tsx',
    )
  })
})

describe('escapeRouteSegment', () => {
  it('adds a trailing underscore to the requested segment', () => {
    expect(escapeRouteSegment('settings/profile.two-factor', 1)).toBe(
      'settings/profile_.two-factor',
    )
    expect(escapeRouteSegment('settings/profile.two-factor/_layout', 1)).toBe(
      'settings/profile_.two-factor/_layout',
    )
    expect(escapeRouteSegment('users/$id.edit', 1)).toBe('users/$id_.edit')
    expect(escapeRouteSegment('_auth.logout', 0)).toBe('_auth_.logout')
  })

  it('counts [escaped] dots as part of one segment', () => {
    expect(escapeRouteSegment('[sitemap.xml].extra', 0)).toBe(
      '[sitemap.xml]_.extra',
    )
  })

  it('counts (optional.dots) as part of one segment', () => {
    expect(escapeRouteSegment('(a.b.c).team.edit', 1)).toBe(
      '(a.b.c).team_.edit',
    )
    expect(escapeRouteSegment('(a.[b.c]).team.edit', 0)).toBe(
      '(a.[b.c])_.team.edit',
    )
  })

  it('refuses segments that are last, already escaped, or special', () => {
    expect(escapeRouteSegment('settings/profile', 1)).toBeUndefined()
    expect(escapeRouteSegment('users/$username_.edit', 1)).toBeUndefined()
    expect(escapeRouteSegment('files/$', 1)).toBeUndefined()
    expect(escapeRouteSegment('settings/profile.index', 2)).toBeUndefined()
  })
})
