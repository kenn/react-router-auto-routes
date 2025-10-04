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
    it('should generate correct paths with optional syntax', () => {
      const files = ['parent.(child).tsx']
      const routes = createRoutesFromFiles(files)
      const manifest = flattenRoutesById(routes)
      expect(manifest['routes/parent.(child)']!.path!).toBe('parent/child?')
    })

    it('should generate correct paths with folders', () => {
      const files = ['_folder.parent.(child)/index.tsx']
      const routes = createRoutesFromFiles(files)
      const manifest = flattenRoutesById(routes)
      expect(manifest['routes/_folder.parent.(child)/index']!.path!).toBe(
        'parent/child?',
      )
    })

    it('should generate correct paths with nested folder routes', () => {
      const files = ['parent/(child)/route.tsx']
      const routes = createRoutesFromFiles(files)
      const manifest = flattenRoutesById(routes)
      expect(manifest['routes/parent/(child)/route']!.path!).toBe(
        'parent/child?',
      )
    })

    it('should generate correct paths with optional syntax and dynamic param', () => {
      const files = ['parent.($child).tsx']
      const routes = createRoutesFromFiles(files)
      const manifest = flattenRoutesById(routes)
      expect(manifest['routes/parent.($child)']!.path!).toBe('parent/:child?')
    })
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
        "routesDir entries cannot contain '.' or '..' segments. Got: './routes'",
      )
    })

    it('rejects parent directory segments', () => {
      expect(() => {
        createRoutesFromFiles(['index.tsx'], { routesDir: '../routes' })
      }).toThrow(
        "routesDir entries cannot contain '.' or '..' segments. Got: '../routes'",
      )
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
          '/tools/keyword-analyzer': 'tools/keyword-analyzer/routes',
          '/tools/meta-preview': 'tools/meta-preview/routes',
        },
        baseDir: '.',
        visitFiles: (dir, visitor) => {
          const normalized = dir.replace(/\\/g, '/')

          if (normalized.endsWith('app/routes')) {
            visitor('dashboard.tsx')
            return
          }

          if (normalized.endsWith('tools/keyword-analyzer/routes')) {
            visitor('overview.tsx')
            return
          }

          if (normalized.endsWith('tools/meta-preview/routes')) {
            visitor('index.tsx')
          }
        },
      })

      const manifest = flattenRoutesById(routes)
      expect(manifest['app/routes/dashboard']?.path).toBe('dashboard')
      expect(manifest['tools/keyword-analyzer/routes/overview']?.path).toBe(
        'tools/keyword-analyzer/overview',
      )
      expect(manifest['tools/meta-preview/routes/index']?.path).toBe(
        'tools/meta-preview',
      )
      expect(manifest['tools/meta-preview/routes/index']?.index).toBe(true)
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

    it('throws on duplicate mount paths', () => {
      expect(() => {
        createRoutesFromFiles(['index.tsx'], {
          routesDir: ['routes', { '/': 'app/marketing' }],
        })
      }).toThrow("Duplicate routesDir mount path detected: '/'.")
    })

    it('supports mixed array and object usage', () => {
      const routes = createRoutesFromFiles([], {
        routesDir: ['app/routes', { '/tools': 'tools/routes' }],
        baseDir: '.',
        visitFiles: (dir, visitor) => {
          const normalized = dir.replace(/\\/g, '/')

          if (normalized.endsWith('app/routes')) {
            visitor('about.tsx')
            return
          }

          if (normalized.endsWith('tools/routes')) {
            visitor('settings.tsx')
          }
        },
      })

      const manifest = flattenRoutesById(routes)
      expect(manifest['app/routes/about']?.path).toBe('about')
      expect(manifest['tools/routes/settings']?.path).toBe('tools/settings')
      expect(manifest['tools/routes/settings']?.parentId).toBe('root')
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
