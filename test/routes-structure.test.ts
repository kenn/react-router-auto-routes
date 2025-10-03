import {
  createRoutesFromFiles,
  expectFilesToMatchSnapshot,
  ExpectedRouteSnapshot,
  ExpectedValues,
  flattenRoutesById,
  generateFlexRoutesAndVerifyResultWithExpected,
} from './utils/route-test-helpers'

describe('route structures', () => {
  describe('complex scenarios', () => {
    const snapshotScenarios: Record<
      string,
      {
        routeList: string[]
        expectedRoutes: ExpectedRouteSnapshot
      }
    > = {
      'supports complex auth and app routes': {
        routeList: [
          '_auth.forgot-password.tsx',
          '_auth.login.tsx',
          '_auth.reset-password.tsx',
          '_auth.signup.tsx',
          '_auth.tsx',
          '_landing.about.tsx',
          '_landing.index.tsx',
          '_landing.tsx',
          'app.calendar.$day.tsx',
          'app.calendar.index.tsx',
          'app.calendar.tsx',
          'app.projects.$id.tsx',
          'app.projects.tsx',
          'app.tsx',
          'app_.projects.$id.roadmap.tsx',
          'app_.projects.$id.roadmap[.pdf].tsx',
        ],
        expectedRoutes: {
          _auth: {
            file: 'routes/_auth.tsx',
            parentId: 'root',
          },
          '_auth.forgot-password': {
            file: 'routes/_auth.forgot-password.tsx',
            parentId: 'routes/_auth',
            path: 'forgot-password',
          },
          '_auth.login': {
            file: 'routes/_auth.login.tsx',
            parentId: 'routes/_auth',
            path: 'login',
          },
          '_auth.reset-password': {
            file: 'routes/_auth.reset-password.tsx',
            parentId: 'routes/_auth',
            path: 'reset-password',
          },
          '_auth.signup': {
            file: 'routes/_auth.signup.tsx',
            parentId: 'routes/_auth',
            path: 'signup',
          },
          _landing: {
            file: 'routes/_landing.tsx',
            parentId: 'root',
          },
          '_landing.about': {
            file: 'routes/_landing.about.tsx',
            parentId: 'routes/_landing',
            path: 'about',
          },
          '_landing.index': {
            file: 'routes/_landing.index.tsx',
            index: true,
            parentId: 'routes/_landing',
          },
          app: {
            file: 'routes/app.tsx',
            parentId: 'root',
            path: 'app',
          },
          'app.calendar': {
            file: 'routes/app.calendar.tsx',
            parentId: 'routes/app',
            path: 'calendar',
          },
          'app.calendar.$day': {
            file: 'routes/app.calendar.$day.tsx',
            parentId: 'routes/app.calendar',
            path: ':day',
          },
          'app.calendar.index': {
            file: 'routes/app.calendar.index.tsx',
            index: true,
            parentId: 'routes/app.calendar',
          },
          'app.projects': {
            file: 'routes/app.projects.tsx',
            parentId: 'routes/app',
            path: 'projects',
          },
          'app.projects.$id': {
            file: 'routes/app.projects.$id.tsx',
            parentId: 'routes/app.projects',
            path: ':id',
          },
          'app_.projects.$id.roadmap': {
            file: 'routes/app_.projects.$id.roadmap.tsx',
            parentId: 'root',
            path: 'app/projects/:id/roadmap',
          },
          'app_.projects.$id.roadmap[.pdf]': {
            file: 'routes/app_.projects.$id.roadmap[.pdf].tsx',
            parentId: 'root',
            path: 'app/projects/:id/roadmap.pdf',
          },
        },
      },
      'handles nested organization routes': {
        routeList: [
          'app.$organizationSlug.tsx',
          'app.$organizationSlug.edit.tsx',
          'app.$organizationSlug.projects.tsx',
          'app.$organizationSlug.projects.$projectId.tsx',
          'app.$organizationSlug.projects.$projectId.edit.tsx',
          'app.$organizationSlug.projects.new.tsx',
        ],
        expectedRoutes: {
          'app.$organizationSlug': {
            file: 'routes/app.$organizationSlug.tsx',
            parentId: 'root',
            path: 'app/:organizationSlug',
          },
          'app.$organizationSlug.edit': {
            file: 'routes/app.$organizationSlug.edit.tsx',
            parentId: 'routes/app.$organizationSlug',
            path: 'edit',
          },
          'app.$organizationSlug.projects': {
            file: 'routes/app.$organizationSlug.projects.tsx',
            parentId: 'routes/app.$organizationSlug',
            path: 'projects',
          },
          'app.$organizationSlug.projects.$projectId': {
            file: 'routes/app.$organizationSlug.projects.$projectId.tsx',
            parentId: 'routes/app.$organizationSlug.projects',
            path: ':projectId',
          },
          'app.$organizationSlug.projects.$projectId.edit': {
            file: 'routes/app.$organizationSlug.projects.$projectId.edit.tsx',
            parentId: 'routes/app.$organizationSlug.projects.$projectId',
            path: 'edit',
          },
          'app.$organizationSlug.projects.new': {
            file: 'routes/app.$organizationSlug.projects.new.tsx',
            parentId: 'routes/app.$organizationSlug.projects',
            path: 'new',
          },
        },
      },
      'allows explicit parent overrides': {
        routeList: ['parent.tsx', 'parent.some.nested.tsx', 'parent.some_.nested.page.tsx'],
        expectedRoutes: {
          parent: {
            file: 'routes/parent.tsx',
            parentId: 'root',
            path: 'parent',
          },
          'parent.some.nested': {
            file: 'routes/parent.some.nested.tsx',
            parentId: 'routes/parent',
            path: 'some/nested',
          },
          'parent.some_.nested.page': {
            file: 'routes/parent.some_.nested.page.tsx',
            parentId: 'routes/parent',
            path: 'some/nested/page',
          },
        },
      },
      'supports params with trailing underscore': {
        routeList: [
          'app.$organizationSlug_._projects.tsx',
          'app.$organizationSlug_._projects.projects.new.tsx',
          'app.$organizationSlug_._projects.projects.$projectId.tsx',
          'app.$organizationSlug_._projects.projects.$projectId.edit.tsx',
        ],
        expectedRoutes: {
          'app.$organizationSlug_._projects': {
            file: 'routes/app.$organizationSlug_._projects.tsx',
            parentId: 'root',
            path: 'app/:organizationSlug',
          },
          'app.$organizationSlug_._projects.projects.$projectId': {
            file: 'routes/app.$organizationSlug_._projects.projects.$projectId.tsx',
            parentId: 'routes/app.$organizationSlug_._projects',
            path: 'projects/:projectId',
          },
          'app.$organizationSlug_._projects.projects.$projectId.edit': {
            file: 'routes/app.$organizationSlug_._projects.projects.$projectId.edit.tsx',
            parentId: 'routes/app.$organizationSlug_._projects.projects.$projectId',
            path: 'edit',
          },
          'app.$organizationSlug_._projects.projects.new': {
            file: 'routes/app.$organizationSlug_._projects.projects.new.tsx',
            parentId: 'routes/app.$organizationSlug_._projects',
            path: 'projects/new',
          },
        },
      },
      'nests index routes under layouts with shared segments': {
        routeList: ['home/_layout.tsx', 'home/index.tsx', 'home/profile/route.tsx'],
        expectedRoutes: {
          'home/_layout': {
            file: 'routes/home/_layout.tsx',
            parentId: 'root',
            path: 'home',
          },
          'home/index': {
            file: 'routes/home/index.tsx',
            index: true,
            parentId: 'routes/home/_layout',
          },
          'home/profile/route': {
            file: 'routes/home/profile/route.tsx',
            parentId: 'routes/home/_layout',
            path: 'profile',
          },
        },
      },
      'skips index routes when resolving parents': {
        routeList: [
          'home/_layout.tsx',
          'home/kickoffs/_layout.tsx',
          'home/kickoffs/$id/index.tsx',
          'home/kickoffs/$id/$key/details.route.tsx',
        ],
        expectedRoutes: {
          'home/_layout': {
            file: 'routes/home/_layout.tsx',
            parentId: 'root',
            path: 'home',
          },
          'home/kickoffs/_layout': {
            file: 'routes/home/kickoffs/_layout.tsx',
            parentId: 'routes/home/_layout',
            path: 'kickoffs',
          },
          'home/kickoffs/$id/index': {
            file: 'routes/home/kickoffs/$id/index.tsx',
            index: true,
            parentId: 'routes/home/kickoffs/_layout',
            path: ':id',
          },
          'home/kickoffs/$id/$key/details.route': {
            file: 'routes/home/kickoffs/$id/$key/details.route.tsx',
            parentId: 'routes/home/kickoffs/_layout',
            path: ':id/:key/details',
          },
        },
      },
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
      for (const [scenarioName, { routeList, expectedRoutes }] of Object.entries(
        snapshotScenarios,
      )) {
        try {
          expectFilesToMatchSnapshot(routeList, expectedRoutes)
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

  describe('hybrid route conventions', () => {
    it('handles hybrid flat and nested structures', () => {
      const files = [
        '_index/route.tsx',
        '_public/_layout.tsx',
        '_public/about/route.tsx',
        '_public/contact[.jpg]/route.tsx',
        'test.$/route.tsx',
        'users/_layout.tsx',
        'users/users.css',
        'users/route/route.tsx',
        'users/$userId/route.tsx',
        'users/$userId/avatar.png',
        'users/$userId_.edit/route.tsx',
      ]

      const expectedRoutes: ExpectedRouteSnapshot = {
        '_index/route': {
          file: 'routes/_index/route.tsx',
          index: true,
          parentId: 'root',
        },
        '_public/_layout': {
          file: 'routes/_public/_layout.tsx',
          parentId: 'root',
        },
        '_public/about/route': {
          file: 'routes/_public/about/route.tsx',
          parentId: 'routes/_public/_layout',
          path: 'about',
        },
        '_public/contact[.jpg]/route': {
          file: 'routes/_public/contact[.jpg]/route.tsx',
          parentId: 'routes/_public/_layout',
          path: 'contact.jpg',
        },
        'test.$/route': {
          file: 'routes/test.$/route.tsx',
          parentId: 'root',
          path: 'test/*',
        },
        'users/$userId/route': {
          file: 'routes/users/$userId/route.tsx',
          parentId: 'routes/users/route/route',
          path: ':userId',
        },
        'users/$userId_.edit/route': {
          file: 'routes/users/$userId_.edit/route.tsx',
          parentId: 'routes/users/route/route',
          path: ':userId/edit',
        },
        'users/_layout': {
          file: 'routes/users/_layout.tsx',
          parentId: 'root',
          path: 'users',
        },
        'users/route/route': {
          file: 'routes/users/route/route.tsx',
          parentId: 'root',
          path: 'users',
        },
      }

      expectFilesToMatchSnapshot(files, expectedRoutes)
    })
  })

  describe('index routes', () => {
    it('generates correct ids for flat files', () => {
      const files = ['$lang.$ref.tsx', '$lang.$ref._index.tsx', '$lang.$ref.$.tsx', '_index.tsx', 'index.tsx']
      const routes = createRoutesFromFiles(files)
      const manifest = flattenRoutesById(routes)

      expect(manifest['routes/_index']?.index).toBe(true)
      expect(manifest['routes/$lang.$ref._index']?.index).toBe(true)
      expect(manifest['routes/index']?.index).toBe(true)
      expect(manifest['routes/index']?.path).toBeUndefined()
    })

    it('generates correct ids for flat folders', () => {
      const files = [
        '$lang.$ref/route.tsx',
        '$lang.$ref._index/route.tsx',
        '$lang.$ref.$/route.tsx',
        '_index/route.tsx',
      ]
      const routes = createRoutesFromFiles(files)
      const manifest = flattenRoutesById(routes)

      expect(manifest['routes/_index/route']?.index).toBe(true)
      expect(manifest['routes/$lang.$ref._index/route']?.index).toBe(true)
    })
  })

  describe('layout nesting', () => {
    it('nests index routes under layouts', () => {
      const files = [
        'dashboard/_layout.tsx',
        'dashboard/index.tsx',
        'settings/_layout.tsx',
        'settings/index.tsx',
      ]

      const expectedRoutes: ExpectedRouteSnapshot = {
        'dashboard/_layout': {
          file: 'routes/dashboard/_layout.tsx',
          parentId: 'root',
          path: 'dashboard',
        },
        'dashboard/index': {
          file: 'routes/dashboard/index.tsx',
          index: true,
          parentId: 'routes/dashboard/_layout',
        },
        'settings/_layout': {
          file: 'routes/settings/_layout.tsx',
          parentId: 'root',
          path: 'settings',
        },
        'settings/index': {
          file: 'routes/settings/index.tsx',
          index: true,
          parentId: 'routes/settings/_layout',
        },
      }

      expectFilesToMatchSnapshot(files, expectedRoutes)
    })

    it('handles deeply nested layout hierarchies', () => {
      const files = [
        'dashboard/_layout.tsx',
        'dashboard/projects/_layout.tsx',
        'dashboard/projects/$id/index.tsx',
        'dashboard/projects/$id/$section/index.tsx',
      ]

      const expectedRoutes: ExpectedRouteSnapshot = {
        'dashboard/_layout': {
          file: 'routes/dashboard/_layout.tsx',
          parentId: 'root',
          path: 'dashboard',
        },
        'dashboard/projects/_layout': {
          file: 'routes/dashboard/projects/_layout.tsx',
          parentId: 'routes/dashboard/_layout',
          path: 'projects',
        },
        'dashboard/projects/$id/index': {
          file: 'routes/dashboard/projects/$id/index.tsx',
          index: true,
          parentId: 'routes/dashboard/projects/_layout',
          path: ':id',
        },
        'dashboard/projects/$id/$section/index': {
          file: 'routes/dashboard/projects/$id/$section/index.tsx',
          index: true,
          parentId: 'routes/dashboard/projects/_layout',
          path: ':id/:section',
        },
      }

      expectFilesToMatchSnapshot(files, expectedRoutes)
    })
  })
})
