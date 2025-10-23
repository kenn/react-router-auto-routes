import { describe, expect, it } from 'vitest'

import { convertToRoute } from '../src/migration/migrate'
import { normalizeSnapshotRouteFilePath } from '../src/migration/normalizers'
import type { RouteManifest } from '../src/migration/route-definition'

describe('convertToRoute', () => {
  it('turns parent routes into layout files', () => {
    const routes: RouteManifest = {
      'app/routes/admin': {
        id: 'app/routes/admin',
        parentId: 'root',
        file: 'app/routes/admin.tsx',
        path: 'admin',
      },
      'app/routes/admin/dashboard': {
        id: 'app/routes/admin/dashboard',
        parentId: 'app/routes/admin',
        file: 'app/routes/admin/dashboard.tsx',
        path: 'admin/dashboard',
      },
    }

    expect(
      convertToRoute(routes, 'app/routes', 'app/routes/admin', 'root'),
    ).toBe('admin/_layout')
  })

  it('normalizes + suffix legacy folders', () => {
    const routes: RouteManifest = {
      'app/routes/app+/reports+/$id+': {
        id: 'app/routes/app+/reports+/$id+',
        parentId: 'root',
        file: 'app/routes/app+/reports+/$id+.tsx',
        path: 'app/reports/:id',
      },
    }

    expect(
      convertToRoute(
        routes,
        'app/routes',
        'app/routes/app+/reports+/$id+',
        'root',
      ),
    ).toBe('app/reports/$id+')
  })

  it('reduces double underscore prefixes to single underscores', () => {
    const routes: RouteManifest = {
      'app/routes/__auth': {
        id: 'app/routes/__auth',
        parentId: 'root',
        file: 'app/routes/__auth.tsx',
        path: undefined,
      },
    }

    expect(
      convertToRoute(routes, 'app/routes', 'app/routes/__auth', 'root'),
    ).toBe('_auth')
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

  it('merges pathless underscore segments', () => {
    expect(
      normalizeSnapshotRouteFilePath('routes/root_/__public.tsx'),
    ).toBe('routes/root_.public.tsx')
  })
})
