import {
  createRoutesFromFiles,
  expectRouteFixturesToMatchSnapshot,
  ExpectedValues,
  fileOnly,
  flattenRoutesById,
  generateFlexRoutesAndVerifyResultWithExpected,
  route,
} from './utils/route-test-helpers'
import type { RouteFixture } from './utils/route-test-helpers'

describe('route structures', () => {
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
          parentId: 'routes/users/route/route',
          path: ':userId',
        }),
        fileOnly('users/$userId/avatar.png'),
        route('users/$userId_.edit/route.tsx', {
          id: 'users/$userId_.edit/route',
          parentId: 'routes/users/route/route',
          path: ':userId/edit',
        }),
      ])
    })
  })

  describe('complex scenarios', () => {
    const snapshotScenarios: Record<string, RouteFixture[]> = {
      'supports complex auth and app routes': [
        route('_auth.forgot-password.tsx', {
          id: '_auth.forgot-password',
          parentId: 'routes/_auth',
          path: 'forgot-password',
        }),
        route('_auth.login.tsx', {
          id: '_auth.login',
          parentId: 'routes/_auth',
          path: 'login',
        }),
        route('_auth.reset-password.tsx', {
          id: '_auth.reset-password',
          parentId: 'routes/_auth',
          path: 'reset-password',
        }),
        route('_auth.signup.tsx', {
          id: '_auth.signup',
          parentId: 'routes/_auth',
          path: 'signup',
        }),
        route('_auth.tsx', {
          id: '_auth',
          parentId: 'root',
        }),
        route('_landing.about.tsx', {
          id: '_landing.about',
          parentId: 'routes/_landing',
          path: 'about',
        }),
        route('_landing.index.tsx', {
          id: '_landing.index',
          parentId: 'routes/_landing',
          index: true,
        }),
        route('_landing.tsx', {
          id: '_landing',
          parentId: 'root',
        }),
        route('app.calendar.$day.tsx', {
          id: 'app.calendar.$day',
          parentId: 'routes/app.calendar',
          path: ':day',
        }),
        route('app.calendar.index.tsx', {
          id: 'app.calendar.index',
          parentId: 'routes/app.calendar',
          index: true,
        }),
        route('app.calendar.tsx', {
          id: 'app.calendar',
          parentId: 'routes/app',
          path: 'calendar',
        }),
        route('app.projects.$id.tsx', {
          id: 'app.projects.$id',
          parentId: 'routes/app.projects',
          path: ':id',
        }),
        route('app.projects.tsx', {
          id: 'app.projects',
          parentId: 'routes/app',
          path: 'projects',
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
          parentId: 'routes/app.$organizationSlug',
          path: 'edit',
        }),
        route('app.$organizationSlug.projects.tsx', {
          id: 'app.$organizationSlug.projects',
          parentId: 'routes/app.$organizationSlug',
          path: 'projects',
        }),
        route('app.$organizationSlug.projects.$projectId.tsx', {
          id: 'app.$organizationSlug.projects.$projectId',
          parentId: 'routes/app.$organizationSlug.projects',
          path: ':projectId',
        }),
        route('app.$organizationSlug.projects.$projectId.edit.tsx', {
          id: 'app.$organizationSlug.projects.$projectId.edit',
          parentId: 'routes/app.$organizationSlug.projects.$projectId',
          path: 'edit',
        }),
        route('app.$organizationSlug.projects.new.tsx', {
          id: 'app.$organizationSlug.projects.new',
          parentId: 'routes/app.$organizationSlug.projects',
          path: 'new',
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
          parentId: 'routes/parent',
          path: 'some/nested',
        }),
        route('parent.some_.nested.page.tsx', {
          id: 'parent.some_.nested.page',
          parentId: 'routes/parent',
          path: 'some/nested/page',
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
          parentId: 'routes/app.$organizationSlug_._projects',
          path: 'projects/new',
        }),
        route('app.$organizationSlug_._projects.projects.$projectId.tsx', {
          id: 'app.$organizationSlug_._projects.projects.$projectId',
          parentId: 'routes/app.$organizationSlug_._projects',
          path: 'projects/:projectId',
        }),
        route('app.$organizationSlug_._projects.projects.$projectId.edit.tsx', {
          id: 'app.$organizationSlug_._projects.projects.$projectId.edit',
          parentId:
            'routes/app.$organizationSlug_._projects.projects.$projectId',
          path: 'edit',
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
      for (const [scenarioName, fixtures] of Object.entries(snapshotScenarios)) {
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
