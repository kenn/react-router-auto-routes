import { getRouteRegex, isRouteModuleFile } from '../src/core/routing/files'

import {
  createRoutesFromFiles,
  ExpectedValues,
  flattenRoutesById,
  generateFlexRoutesAndVerifyResultWithExpected,
} from './utils/route-test-helpers'

describe('routing options', () => {
  describe('custom base path', () => {
    it('should generate correct routes with base path prefix', () => {
      const flatFiles = [
        '$lang.$ref.tsx',
        '$lang.$ref._index.tsx',
        '$lang.$ref.$.tsx',
        '_index.tsx',
      ]
      const routes = createRoutesFromFiles(flatFiles, { basePath: '/myapp' })
      const manifest = flattenRoutesById(routes)
      const rootChildren = Object.values(manifest).filter(
        (route) => route.parentId === 'root' && route.path,
      )
      expect(rootChildren.length).toBeGreaterThan(0)
      expect(rootChildren[0]!.path!.startsWith('myapp/')).toBe(true)
    })
  })

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

  describe('routeDir validation', () => {
    it('should reject routeDir with leading dot segments', () => {
      expect(() => {
        createRoutesFromFiles(['index.tsx'], { routeDir: './routes' })
      }).toThrow(
        "routeDir must be a single directory name without path separators. Got: './routes'",
      )
    })

    it('should reject routeDir with trailing separators', () => {
      expect(() => {
        createRoutesFromFiles(['index.tsx'], { routeDir: 'routes/' })
      }).toThrow(
        "routeDir must be a single directory name without path separators. Got: 'routes/'",
      )
    })

    it('should reject routeDir with nested paths', () => {
      expect(() => {
        createRoutesFromFiles(['index.tsx'], { routeDir: 'app/routes' })
      }).toThrow(
        "routeDir must be a single directory name without path separators. Got: 'app/routes'",
      )
    })
  })

  describe('multiple routeDir', () => {
    it('should merge routes from multiple directories with correct paths', () => {
      const visitFiles = (dir: string, visitor: (file: string) => void) => {
        if (dir.endsWith('routes')) {
          visitor('index.tsx')
          visitor('about.tsx')
        }

        if (dir.endsWith('admin')) {
          visitor('admin.dashboard.tsx')
          visitor('admin.settings.tsx')
        }

        if (dir.endsWith('api')) {
          visitor('api.users.tsx')
        }
      }

      const routes = createRoutesFromFiles([], {
        routeDir: ['routes', 'admin', 'api'],
        visitFiles,
      })
      const manifest = flattenRoutesById(routes)

      expect(manifest['routes/index']).toBeDefined()
      expect(manifest['routes/about']?.path).toBe('about')
      expect(manifest['admin/admin.dashboard']).toBeDefined()
      expect(manifest['admin/admin.settings']?.path).toBe('admin/settings')
      expect(manifest['api/api.users']).toBeDefined()
    })

    it('should handle nesting across multiple directories', () => {
      const routes = createRoutesFromFiles(
        [
          '_index.tsx',
          'admin._layout.tsx',
          'admin.dashboard.tsx',
          'api.users.tsx',
        ],
        {
          routeDir: ['routes', 'admin', 'api'],
          visitFiles: (dir, visitor) => {
            if (dir.includes('routes')) visitor('_index.tsx')
            if (dir.includes('admin')) {
              visitor('admin._layout.tsx')
              visitor('admin.dashboard.tsx')
            }
            if (dir.includes('api')) visitor('api.users.tsx')
          },
        },
      )
      const manifest = flattenRoutesById(routes)

      expect(manifest['routes/_index']?.index).toBe(true)
      expect(manifest['admin/admin._layout']?.path).toBe('admin')
      // Dashboard is not nested under layout when in different route directories
      expect(manifest['admin/admin.dashboard']?.path).toBe('admin/dashboard')
      expect(manifest['api/api.users']?.path).toBe('api/users')
    })

    it('should not overwrite routes with different directory prefixes', () => {
      const routes = createRoutesFromFiles(['shared.tsx'], {
        routeDir: ['routes', 'admin'],
        visitFiles: (dir, visitor) => {
          // Both directories have shared.tsx
          visitor('shared.tsx')
        },
      })
      const manifest = flattenRoutesById(routes)

      // Both should exist with different IDs
      const sharedRoutes = Object.keys(manifest).filter((id) =>
        id.includes('shared'),
      )
      expect(sharedRoutes).toContain('routes/shared')
      expect(sharedRoutes).toContain('admin/shared')
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
    const colocateChar = '+' as const
    const baseRegex = new RegExp(
      '((\\${colocateChar}[\\/\\\\][^\\/\\\\:?*]+)|[\\/\\\\]((index|route|layout|page)|(_[^\\/\\\\:?*]+)|([^\\/\\\\:?*]+\\.route)))\\.(TSX)$',
      'i',
    )

    const routeRegex = getRouteRegex(baseRegex, colocateChar)

    expect(routeRegex.flags).toContain('i')
    expect(routeRegex.test('admin/file.route.TSX')).toBe(true)
    expect(
      isRouteModuleFile('admin/file.route.TSX', colocateChar, routeRegex),
    ).toBe(true)
  })
})
