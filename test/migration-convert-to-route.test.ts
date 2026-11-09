import { describe, expect, it } from 'vitest'
import {
  convertToRoute,
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
      'routes/root_.public.tsx',
    )
  })
})
