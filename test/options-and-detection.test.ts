import * as path from 'path'

import { getRouteRegex, isRouteModuleFile } from '../src/core/routing/files'

import {
  createRoutesFromFiles,
  ExpectedValues,
  flattenRoutesById,
  generateFlexRoutesAndVerifyResultWithExpected,
} from './utils/route-test-helpers'

describe('routing options', () => {
  describe('custom param prefix char', () => {
    it('should generate correct paths with custom param prefix', () => {
      const flatFiles = ['^userId.tsx', '^.tsx']
      const routes = createRoutesFromFiles(flatFiles, { paramChar: '^' })
      const manifest = flattenRoutesById(routes)
      expect(manifest['routes/^userId']!.path!).toBe(':userId')
      expect(manifest['routes/^']!.path!).toBe('*')
    })
  })

  describe('optional segments', () => {
    const optionalSegmentCases = [
      {
        name: 'should generate correct paths with optional syntax',
        files: ['parent.(child).tsx'],
        expectedId: 'routes/parent.(child)',
        expectedPath: 'parent/child?',
      },
      {
        name: 'should generate correct paths with folders',
        files: ['_folder.parent.(child)/index.tsx'],
        expectedId: 'routes/_folder.parent.(child)/index',
        expectedPath: 'parent/child?',
      },
      {
        name: 'should generate correct paths with nested folder routes',
        files: ['parent/(child)/route.tsx'],
        expectedId: 'routes/parent/(child)/route',
        expectedPath: 'parent/child?',
      },
      {
        name: 'should generate correct paths with optional syntax and dynamic param',
        files: ['parent.($child).tsx'],
        expectedId: 'routes/parent.($child)',
        expectedPath: 'parent/:child?',
      },
    ] as const

    optionalSegmentCases.forEach(
      ({ name, files, expectedId, expectedPath }) => {
        it(name, () => {
          const routes = createRoutesFromFiles([...files])
          const manifest = flattenRoutesById(routes)

          expect(manifest[expectedId]).toBeDefined()
          expect(manifest[expectedId]?.path).toBe(expectedPath)
        })
      },
    )
  })

  describe('routesDir normalization', () => {
    it('supports nested directory entries', () => {
      const routes = createRoutesFromFiles(['users.tsx'], {
        routesDir: 'routes/public',
      })
      const manifest = flattenRoutesById(routes)
      expect(manifest['routes/public/users']).toBeDefined()
    })

    it('nests routes under layouts when prefix folders are repeated', () => {
      const routes = createRoutesFromFiles(
        ['admin/_layout.tsx', 'admin/dashboard.tsx'],
        { routesDir: 'routes/admin' },
      )
      const manifest = flattenRoutesById(routes)

      expect(manifest['routes/admin/admin/_layout']?.path).toBe('admin')
      expect(manifest['routes/admin/admin/dashboard']?.parentId).toBe(
        'routes/admin/admin/_layout',
      )
      expect(manifest['routes/admin/admin/dashboard']?.path).toBe('dashboard')
    })

    it('rejects dot-prefixed relative paths', () => {
      expect(() => {
        createRoutesFromFiles(['index.tsx'], { routesDir: './routes' })
      }).toThrow(
        "routesDir entries cannot contain '.' segments. Got: './routes'",
      )
    })

    it('supports parent directory segments', () => {
      const routes = createRoutesFromFiles(['index.tsx'], {
        routesDir: '../pages',
      })
      const manifest = flattenRoutesById(routes)

      expect(manifest['../pages/index']?.file).toBe('pages/index.tsx')
      expect(manifest['../pages/index']?.path).toBeUndefined()
    })

    it('rejects absolute paths', () => {
      expect(() => {
        createRoutesFromFiles(['index.tsx'], { routesDir: '/routes' })
      }).toThrow(
        "routesDir entries must be relative paths, not absolute. Got: '/routes'",
      )
    })

    it('rejects empty entries', () => {
      expect(() => {
        createRoutesFromFiles(['index.tsx'], { routesDir: '' })
      }).toThrow("routesDir entries must be non-empty strings. Got: ''")
    })
  })

  describe('routesDir mappings', () => {
    it('supports object form with multiple mounts', () => {
      const routes = createRoutesFromFiles([], {
        routesDir: {
          '/': 'app/routes',
          '/api': 'api/routes',
          '/docs': 'packages/docs/routes',
        },
        visitFiles: (dir, visitor) => {
          const normalized = dir.replace(/\\/g, '/')

          if (normalized.endsWith('app/routes')) {
            visitor('dashboard.tsx')
            return
          }

          if (normalized.endsWith('packages/docs/routes')) {
            visitor('overview.tsx')
            return
          }

          if (normalized.endsWith('api/routes')) {
            visitor('index.tsx')
          }
        },
      })

      const manifest = flattenRoutesById(routes)
      expect(manifest['routes/dashboard']?.path).toBe('dashboard')
      expect(manifest['packages/docs/routes/overview']?.path).toBe(
        'docs/overview',
      )
      expect(manifest['api/routes/index']?.path).toBe('api')
      expect(manifest['api/routes/index']?.index).toBe(true)
    })

    it('nests discovered children under secondary mounts', () => {
      const routes = createRoutesFromFiles([], {
        routesDir: {
          '/': 'app/routes',
          '/api': 'api/routes',
          '/docs': 'packages/docs/routes',
        },
        visitFiles: (dir, visitor) => {
          const normalized = dir.replace(/\\/g, '/')

          if (normalized.endsWith('app/routes')) {
            visitor('_analytics.tsx')
            return
          }

          if (normalized.endsWith('packages/docs/routes')) {
            visitor('overview.tsx')
            return
          }

          if (normalized.endsWith('api/routes')) {
            visitor('index.tsx')
            visitor('users/_layout.tsx')
            visitor('users/settings.tsx')
          }
        },
      })

      const manifest = flattenRoutesById(routes)

      expect(manifest['routes/_analytics']?.parentId).toBe('root')
      expect(manifest['routes/_analytics']?.path).toBeUndefined()

      expect(manifest['api/routes/users/_layout']?.parentId).toBe('root')
      expect(manifest['api/routes/users/_layout']?.path).toBe('api/users')

      expect(manifest['api/routes/users/settings']?.parentId).toBe(
        'api/routes/users/_layout',
      )
      expect(manifest['api/routes/users/settings']?.path).toBe('settings')
    })

    it('keeps root app routes relative to the main app directory when using object mounts', () => {
      const routes = createRoutesFromFiles([], {
        routesDir: {
          '/': 'app/routes',
          '/shop': 'shop/routes',
        },
        visitFiles: (dir, visitor) => {
          const normalized = dir.replace(/\\/g, '/')

          if (normalized.endsWith('app/routes')) {
            visitor('_auth/_layout.tsx')
            visitor('_auth/login.tsx')
            return
          }

          if (normalized.endsWith('shop/routes')) {
            visitor('index.tsx')
          }
        },
      })

      const manifest = flattenRoutesById(routes)

      expect(manifest['routes/_auth/_layout']?.file).toBe(
        'routes/_auth/_layout.tsx',
      )
      expect(manifest['routes/_auth/login']?.file).toBe(
        'routes/_auth/login.tsx',
      )
      expect(manifest['shop/routes/index']?.file).toBe(
        '../shop/routes/index.tsx',
      )
    })

    it('validates mount path syntax', () => {
      expect(() => {
        createRoutesFromFiles(['index.tsx'], {
          routesDir: { tools: 'tools/routes' },
        })
      }).toThrow("routesDir mount paths must start with '/'. Got: 'tools'")

      expect(() => {
        createRoutesFromFiles(['index.tsx'], {
          routesDir: { '/tools/': 'tools/routes' },
        })
      }).toThrow("routesDir mount paths cannot end with '/'. Got: '/tools/'")
    })
  })

  describe('app directory resolution', () => {
    it('anchors import prefixes to the root mount directory when present', () => {
      const routes = createRoutesFromFiles(['index.tsx'], {
        routesDir: { '/': 'packages/web/routes' },
      })

      const manifest = flattenRoutesById(routes)
      expect(manifest['packages/web/routes/index']?.file).toBe(
        'routes/index.tsx',
      )
    })

    it('respects __reactRouterAppDirectory when computing import prefixes without a root mount', () => {
      const originalAppDir = (globalThis as any).__reactRouterAppDirectory
      ;(globalThis as any).__reactRouterAppDirectory = path.resolve(
        process.cwd(),
        'app/router',
      )

      try {
        const routes = createRoutesFromFiles(['index.tsx'], {
          routesDir: { '/shop': 'shop/routes' },
        })

        const manifest = flattenRoutesById(routes)
        expect(manifest['shop/routes/index']?.file).toBe(
          '../../shop/routes/index.tsx',
        )
      } finally {
        ;(globalThis as any).__reactRouterAppDirectory = originalAppDir
      }
    })
  })
})

describe('special character escaping', () => {
  it('should escape underscore', () => {
    const routesWithExpectedValues: Record<string, ExpectedValues> = {
      '[__].tsx': {
        id: 'routes/[__]',
        path: '__',
        parentId: 'root',
      },
      '[_].tsx': {
        id: 'routes/[_]',
        path: '_',
        parentId: 'root',
      },
      '_layout.[___]/index.tsx': {
        id: 'routes/_layout.[___]/index',
        path: '___',
        parentId: 'root',
      },
      '_layout.parent.[__]/index.tsx': {
        id: 'routes/_layout.parent.[__]/index',
        path: 'parent/__',
        parentId: 'root',
      },
    }

    generateFlexRoutesAndVerifyResultWithExpected(routesWithExpectedValues)
  })
})

describe('route detection helpers', () => {
  it('preserves custom regex flags when substituting the colocation placeholder', () => {
    const colocationChar = '+' as const
    const baseRegex = new RegExp(
      '((\\${colocationChar}[\\/\\\\][^\\/\\\\:?*]+)|[\\/\\\\]((index|route|layout)|(_[^\\/\\\\:?*]+)|([^\\/\\\\:?*]+\\.route)))\\.(TSX)$',
      'i',
    )

    const routeRegex = getRouteRegex(baseRegex, colocationChar)

    expect(routeRegex.flags).toContain('i')
    expect(routeRegex.test('admin/file.route.TSX')).toBe(true)
    expect(
      isRouteModuleFile('admin/file.route.TSX', colocationChar, routeRegex),
    ).toBe(true)
  })
})
