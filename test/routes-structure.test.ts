import type { RouteFixture } from './utils/route-test-helpers'
import {
  createRoutesFromFiles,
  ExpectedValues,
  expectRouteFixturesToMatchSnapshot,
  fileOnly,
  flatFileRouteFixtures,
  flatFolderRouteFixtures,
  flattenRoutesById,
  generateFlexRoutesAndVerifyResultWithExpected,
  route,
} from './utils/route-test-helpers'

describe('route structures', () => {
  describe('index routes', () => {
    it('generates correct ids for flat files', () => {
      const files = flatFileRouteFixtures().map(({ file }) => file)
      files.push('index.tsx')
      const routes = createRoutesFromFiles(files)
      const manifest = flattenRoutesById(routes)

      expect(manifest['routes/_index']?.index).toBe(true)
      expect(manifest['routes/$lang.$ref._index']?.index).toBe(true)
      expect(manifest['routes/index']?.index).toBe(true)
      expect(manifest['routes/index']?.path).toBeUndefined()
    })

    it('generates correct ids for flat folders', () => {
      const files = flatFolderRouteFixtures().map(({ file }) => file)
      const routes = createRoutesFromFiles(files)
      const manifest = flattenRoutesById(routes)

      expect(manifest['routes/_index/route']?.index).toBe(true)
      expect(manifest['routes/$lang.$ref._index/route']?.index).toBe(true)
    })
  })

  describe('layout nesting', () => {
    it('nests index routes under layouts', () => {
      expectRouteFixturesToMatchSnapshot([
        route('dashboard/_layout.tsx', {
          id: 'dashboard/_layout',
          parentId: 'root',
          path: 'dashboard',
        }),
        route('dashboard/index.tsx', {
          id: 'dashboard/index',
          parentId: 'routes/dashboard/_layout',
          index: true,
        }),
        route('settings/_layout.tsx', {
          id: 'settings/_layout',
          parentId: 'root',
          path: 'settings',
        }),
        route('settings/index.tsx', {
          id: 'settings/index',
          parentId: 'routes/settings/_layout',
          index: true,
        }),
      ])
    })

    it('handles deeply nested layout hierarchies', () => {
      expectRouteFixturesToMatchSnapshot([
        route('dashboard/_layout.tsx', {
          id: 'dashboard/_layout',
          parentId: 'root',
          path: 'dashboard',
        }),
        route('dashboard/projects/_layout.tsx', {
          id: 'dashboard/projects/_layout',
          parentId: 'routes/dashboard/_layout',
          path: 'projects',
        }),
        route('dashboard/projects/$id/index.tsx', {
          id: 'dashboard/projects/$id/index',
          parentId: 'routes/dashboard/projects/_layout',
          index: true,
          path: ':id',
        }),
        route('dashboard/projects/$id/$section/index.tsx', {
          id: 'dashboard/projects/$id/$section/index',
          parentId: 'routes/dashboard/projects/_layout',
          index: true,
          path: ':id/:section',
        }),
      ])
    })
  })

  describe('layout file semantics', () => {
    it('makes root _layout.tsx the parent of direct root siblings', () => {
      expectRouteFixturesToMatchSnapshot([
        route('_layout.tsx', {
          id: '_layout',
          parentId: 'root',
        }),
        route('index.tsx', {
          id: 'index',
          parentId: 'routes/_layout',
          index: true,
        }),
        route('about.tsx', {
          id: 'about',
          parentId: 'routes/_layout',
          path: 'about',
        }),
      ])
    })

    it('makes root _layout.tsx the parent of pathless-prefixed routes', () => {
      expectRouteFixturesToMatchSnapshot([
        route('_layout.tsx', {
          id: '_layout',
          parentId: 'root',
        }),
        route('_top/index.tsx', {
          id: '_top/index',
          parentId: 'routes/_layout',
          index: true,
        }),
      ])
    })

    it('keeps nested pathless layouts between root _layout and children', () => {
      expectRouteFixturesToMatchSnapshot([
        route('_layout.tsx', {
          id: '_layout',
          parentId: 'root',
        }),
        route('_top/_layout.tsx', {
          id: '_top/_layout',
          parentId: 'routes/_layout',
        }),
        route('_top/index.tsx', {
          id: '_top/index',
          parentId: 'routes/_top/_layout',
          index: true,
        }),
      ])
    })

    it('treats root layout.tsx as a normal route file', () => {
      expectRouteFixturesToMatchSnapshot([
        route('layout.tsx', {
          id: 'layout',
          parentId: 'root',
          path: 'layout',
        }),
        route('index.tsx', {
          id: 'index',
          parentId: 'root',
          index: true,
        }),
        route('about.tsx', {
          id: 'about',
          parentId: 'root',
          path: 'about',
        }),
      ])
    })

    it('treats dot-delimited *.layout.tsx as a normal route file', () => {
      expectRouteFixturesToMatchSnapshot([
        route('dashboard.layout.tsx', {
          id: 'dashboard.layout',
          parentId: 'root',
          path: 'dashboard/layout',
        }),
        route('dashboard.profile.tsx', {
          id: 'dashboard.profile',
          parentId: 'root',
          path: 'dashboard/profile',
        }),
      ])
    })

    it('treats users/layout.tsx as a normal nested route file', () => {
      expectRouteFixturesToMatchSnapshot([
        route('users/layout.tsx', {
          id: 'users/layout',
          parentId: 'root',
          path: 'users/layout',
        }),
        route('users/index.tsx', {
          id: 'users/index',
          parentId: 'root',
          index: true,
          path: 'users',
        }),
        route('users/edit.tsx', {
          id: 'users/edit',
          parentId: 'root',
          path: 'users/edit',
        }),
      ])
    })

    it('treats _layout.route.tsx as a normal route file', () => {
      expectRouteFixturesToMatchSnapshot([
        route('_layout.route.tsx', {
          id: '_layout.route',
          parentId: 'root',
          path: 'route',
        }),
        route('index.tsx', {
          id: 'index',
          parentId: 'root',
          index: true,
        }),
      ])
    })

    it('allows _layout.tsx and layout.tsx to coexist in the same folder', () => {
      expectRouteFixturesToMatchSnapshot([
        route('dashboard/_layout.tsx', {
          id: 'dashboard/_layout',
          parentId: 'root',
          path: 'dashboard',
        }),
        route('dashboard/layout.tsx', {
          id: 'dashboard/layout',
          parentId: 'routes/dashboard/_layout',
          path: 'layout',
        }),
        route('dashboard/index.tsx', {
          id: 'dashboard/index',
          parentId: 'routes/dashboard/_layout',
          index: true,
        }),
        route('dashboard/settings.tsx', {
          id: 'dashboard/settings',
          parentId: 'routes/dashboard/_layout',
          path: 'settings',
        }),
      ])
    })

    it('preserves non-root _layout nesting behavior', () => {
      expectRouteFixturesToMatchSnapshot([
        route('users/_layout.tsx', {
          id: 'users/_layout',
          parentId: 'root',
          path: 'users',
        }),
        route('users/index.tsx', {
          id: 'users/index',
          parentId: 'routes/users/_layout',
          index: true,
        }),
        route('users/edit.tsx', {
          id: 'users/edit',
          parentId: 'routes/users/_layout',
          path: 'edit',
        }),
      ])
    })

    it('makes root _layout.tsx the parent of nested folder routes', () => {
      expectRouteFixturesToMatchSnapshot([
        route('_layout.tsx', {
          id: '_layout',
          parentId: 'root',
        }),
        route('dashboard/index.tsx', {
          id: 'dashboard/index',
          parentId: 'routes/_layout',
          index: true,
          path: 'dashboard',
        }),
      ])
    })

    it('makes root _layout.tsx the parent of route.tsx without changing its path semantics', () => {
      expectRouteFixturesToMatchSnapshot([
        route('_layout.tsx', {
          id: '_layout',
          parentId: 'root',
        }),
        route('route.tsx', {
          id: 'route',
          parentId: 'routes/_layout',
          path: 'route',
        }),
        route('about.tsx', {
          id: 'about',
          parentId: 'routes/_layout',
          path: 'about',
        }),
      ])
    })

    it('keeps foo.tsx as a sibling of foo/_layout.tsx', () => {
      expectRouteFixturesToMatchSnapshot([
        route('foo/_layout.tsx', {
          id: 'foo/_layout',
          parentId: 'root',
          path: 'foo',
        }),
        route('foo.tsx', {
          id: 'foo',
          parentId: 'root',
          path: 'foo',
        }),
      ])
    })

    it('keeps root _layout.tsx isolated to its own mount', () => {
      const routes = createRoutesFromFiles([], {
        routesDir: {
          '/': 'routes',
          '/admin': 'admin/routes',
        },
        visitFiles: (dir, visitor) => {
          const normalized = dir.replace(/\\/g, '/')

          if (normalized.endsWith('admin/routes')) {
            visitor('index.tsx')
            return
          }

          if (normalized.endsWith('/routes')) {
            visitor('_layout.tsx')
            visitor('about.tsx')
          }
        },
      })

      const manifest = flattenRoutesById(routes)
      expect(manifest['routes/about']?.parentId).toBe('routes/_layout')
      expect(manifest['admin/routes/index']?.parentId).toBe('root')
    })

    it('applies mount-local root _layout.tsx for secondary mounts only', () => {
      const routes = createRoutesFromFiles([], {
        routesDir: {
          '/': 'routes',
          '/admin': 'admin/routes',
        },
        visitFiles: (dir, visitor) => {
          const normalized = dir.replace(/\\/g, '/')

          if (normalized.endsWith('admin/routes')) {
            visitor('_layout.tsx')
            visitor('users.tsx')
            return
          }

          if (normalized.endsWith('/routes')) {
            visitor('about.tsx')
          }
        },
      })

      const manifest = flattenRoutesById(routes)
      expect(manifest['routes/about']?.parentId).toBe('root')
      expect(manifest['admin/routes/users']?.parentId).toBe(
        'admin/routes/_layout',
      )
    })
  })

  describe('hybrid route conventions', () => {
    it('handles hybrid flat and nested structures', () => {
      expectRouteFixturesToMatchSnapshot([
        route('_index/route.tsx', {
          id: '_index/route',
          parentId: 'root',
          index: true,
        }),
        route('_public/_layout.tsx', {
          id: '_public/_layout',
          parentId: 'root',
        }),
        route('_public/about/route.tsx', {
          id: '_public/about/route',
          parentId: 'routes/_public/_layout',
          path: 'about',
        }),
        route('_public/contact[.jpg]/route.tsx', {
          id: '_public/contact[.jpg]/route',
          parentId: 'routes/_public/_layout',
          path: 'contact.jpg',
        }),
        route('test.$/route.tsx', {
          id: 'test.$/route',
          parentId: 'root',
          path: 'test/*',
        }),
        route('users/_layout.tsx', {
          id: 'users/_layout',
          parentId: 'root',
          path: 'users',
        }),
        fileOnly('users/users.css'),
        route('users/route/route.tsx', {
          id: 'users/route/route',
          parentId: 'root',
          path: 'users',
        }),
        route('users/$userId/route.tsx', {
          id: 'users/$userId/route',
          parentId: 'routes/users/_layout',
          path: ':userId',
        }),
        fileOnly('users/$userId/avatar.png'),
        route('users/$userId_.edit/route.tsx', {
          id: 'users/$userId_.edit/route',
          parentId: 'routes/users/_layout',
          path: ':userId/edit',
        }),
      ])
    })

    it('supports literal dot segments via escape syntax', () => {
      const routes = createRoutesFromFiles(['robots[.]txt.ts'])
      const manifest = flattenRoutesById(routes)

      expect(manifest['routes/robots[.]txt']?.path).toBe('robots.txt')
    })
  })

  describe('complex scenarios', () => {
    const snapshotScenarios: Record<string, RouteFixture[]> = {
      'supports complex auth and app routes': [
        route('_auth.forgot-password.tsx', {
          id: '_auth.forgot-password',
          parentId: 'root',
          path: 'forgot-password',
        }),
        route('_auth.login.tsx', {
          id: '_auth.login',
          parentId: 'root',
          path: 'login',
        }),
        route('_auth.reset-password.tsx', {
          id: '_auth.reset-password',
          parentId: 'root',
          path: 'reset-password',
        }),
        route('_auth.signup.tsx', {
          id: '_auth.signup',
          parentId: 'root',
          path: 'signup',
        }),
        route('_auth.tsx', {
          id: '_auth',
          parentId: 'root',
        }),
        route('_landing.about.tsx', {
          id: '_landing.about',
          parentId: 'root',
          path: 'about',
        }),
        route('_landing.index.tsx', {
          id: '_landing.index',
          parentId: 'root',
          index: true,
        }),
        route('_landing.tsx', {
          id: '_landing',
          parentId: 'root',
        }),
        route('app.calendar.$day.tsx', {
          id: 'app.calendar.$day',
          parentId: 'root',
          path: 'app/calendar/:day',
        }),
        route('app.calendar.index.tsx', {
          id: 'app.calendar.index',
          index: true,
          parentId: 'root',
          path: 'app/calendar',
        }),
        route('app.calendar.tsx', {
          id: 'app.calendar',
          parentId: 'root',
          path: 'app/calendar',
        }),
        route('app.projects.$id.tsx', {
          id: 'app.projects.$id',
          parentId: 'root',
          path: 'app/projects/:id',
        }),
        route('app.projects.tsx', {
          id: 'app.projects',
          parentId: 'root',
          path: 'app/projects',
        }),
        route('app.tsx', {
          id: 'app',
          parentId: 'root',
          path: 'app',
        }),
        route('app_.projects.$id.roadmap.tsx', {
          id: 'app_.projects.$id.roadmap',
          parentId: 'root',
          path: 'app/projects/:id/roadmap',
        }),
        route('app_.projects.$id.roadmap[.pdf].tsx', {
          id: 'app_.projects.$id.roadmap[.pdf]',
          parentId: 'root',
          path: 'app/projects/:id/roadmap.pdf',
        }),
      ],
      'handles nested organization routes': [
        route('app.$organizationSlug.tsx', {
          id: 'app.$organizationSlug',
          parentId: 'root',
          path: 'app/:organizationSlug',
        }),
        route('app.$organizationSlug.edit.tsx', {
          id: 'app.$organizationSlug.edit',
          parentId: 'root',
          path: 'app/:organizationSlug/edit',
        }),
        route('app.$organizationSlug.projects.tsx', {
          id: 'app.$organizationSlug.projects',
          parentId: 'root',
          path: 'app/:organizationSlug/projects',
        }),
        route('app.$organizationSlug.projects.$projectId.tsx', {
          id: 'app.$organizationSlug.projects.$projectId',
          parentId: 'root',
          path: 'app/:organizationSlug/projects/:projectId',
        }),
        route('app.$organizationSlug.projects.$projectId.edit.tsx', {
          id: 'app.$organizationSlug.projects.$projectId.edit',
          parentId: 'root',
          path: 'app/:organizationSlug/projects/:projectId/edit',
        }),
        route('app.$organizationSlug.projects.new.tsx', {
          id: 'app.$organizationSlug.projects.new',
          parentId: 'root',
          path: 'app/:organizationSlug/projects/new',
        }),
      ],
      'allows explicit parent overrides': [
        route('parent.tsx', {
          id: 'parent',
          parentId: 'root',
          path: 'parent',
        }),
        route('parent.some.nested.tsx', {
          id: 'parent.some.nested',
          parentId: 'root',
          path: 'parent/some/nested',
        }),
        route('parent.some_.nested.settings.tsx', {
          id: 'parent.some_.nested.settings',
          parentId: 'root',
          path: 'parent/some/nested/settings',
        }),
      ],
      'supports params with trailing underscore': [
        route('app.$organizationSlug_._projects.tsx', {
          id: 'app.$organizationSlug_._projects',
          parentId: 'root',
          path: 'app/:organizationSlug',
        }),
        route('app.$organizationSlug_._projects.projects.new.tsx', {
          id: 'app.$organizationSlug_._projects.projects.new',
          parentId: 'root',
          path: 'app/:organizationSlug/projects/new',
        }),
        route('app.$organizationSlug_._projects.projects.$projectId.tsx', {
          id: 'app.$organizationSlug_._projects.projects.$projectId',
          parentId: 'root',
          path: 'app/:organizationSlug/projects/:projectId',
        }),
        route('app.$organizationSlug_._projects.projects.$projectId.edit.tsx', {
          id: 'app.$organizationSlug_._projects.projects.$projectId.edit',
          parentId: 'root',
          path: 'app/:organizationSlug/projects/:projectId/edit',
        }),
      ],
      'treats shared prefixes as siblings without layouts': [
        route('users.$id.tsx', {
          id: 'users.$id',
          parentId: 'root',
          path: 'users/:id',
        }),
        route('users.$id.edit.tsx', {
          id: 'users.$id.edit',
          parentId: 'root',
          path: 'users/:id/edit',
        }),
      ],
      'nests index routes under layouts with shared segments': [
        route('home/_layout.tsx', {
          id: 'home/_layout',
          parentId: 'root',
          path: 'home',
        }),
        route('home/index.tsx', {
          id: 'home/index',
          parentId: 'routes/home/_layout',
          index: true,
        }),
        route('home/profile/route.tsx', {
          id: 'home/profile/route',
          parentId: 'routes/home/_layout',
          path: 'profile',
        }),
      ],
      'skips index routes when resolving parents': [
        route('home/_layout.tsx', {
          id: 'home/_layout',
          parentId: 'root',
          path: 'home',
        }),
        route('home/kickoffs/_layout.tsx', {
          id: 'home/kickoffs/_layout',
          parentId: 'routes/home/_layout',
          path: 'kickoffs',
        }),
        route('home/kickoffs/$id/index.tsx', {
          id: 'home/kickoffs/$id/index',
          parentId: 'routes/home/kickoffs/_layout',
          index: true,
          path: ':id',
        }),
        route('home/kickoffs/$id/$key/details.route.tsx', {
          id: 'home/kickoffs/$id/$key/details.route',
          parentId: 'routes/home/kickoffs/_layout',
          path: ':id/:key/details',
        }),
      ],
      'layout takes precedence over sibling route.tsx': [
        route('test-2/_layout.tsx', {
          id: 'test-2/_layout',
          parentId: 'root',
          path: 'test-2',
        }),
        route('test-2/about.tsx', {
          id: 'test-2/about',
          parentId: 'routes/test-2/_layout',
          path: 'about',
        }),
        route('test-2/index.tsx', {
          id: 'test-2/index',
          parentId: 'routes/test-2/_layout',
          index: true,
        }),
        route('test-2/route.tsx', {
          id: 'test-2/route',
          parentId: 'root',
          path: 'test-2',
        }),
      ],
      'supports dot-delimited layouts': [
        route('_auth._modal._layout.tsx', {
          id: '_auth._modal._layout',
          parentId: 'root',
        }),
        route('_auth._modal.login.tsx', {
          id: '_auth._modal.login',
          parentId: 'routes/_auth._modal._layout',
          path: 'login',
        }),
        route('_auth._modal.signup.tsx', {
          id: '_auth._modal.signup',
          parentId: 'routes/_auth._modal._layout',
          path: 'signup',
        }),
      ],
    }

    const trailingSlashScenario: Record<string, ExpectedValues> = {
      '_login/_layout.tsx': {
        id: 'routes/_login/_layout',
        path: undefined,
        parentId: 'root',
      },
      '_login.login/index.tsx': {
        id: 'routes/_login.login/index',
        path: 'login',
        parentId: 'routes/_login/_layout',
      },
      '_login.register/index.tsx': {
        id: 'routes/_login.register/index',
        path: 'register',
        parentId: 'routes/_login/_layout',
      },
    }

    it('covers complex routing scenarios with minimal cases', () => {
      for (const [scenarioName, fixtures] of Object.entries(
        snapshotScenarios,
      )) {
        try {
          expectRouteFixturesToMatchSnapshot(fixtures)
        } catch (error: unknown) {
          if (error instanceof Error) {
            error.message = `Scenario "${scenarioName}" failed: ${error.message}`
          }
          throw error
        }
      }

      generateFlexRoutesAndVerifyResultWithExpected(trailingSlashScenario)
    })
  })
})
