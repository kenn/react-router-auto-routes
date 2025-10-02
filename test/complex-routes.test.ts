import {
  expectFilesToMatchSnapshot,
  ExpectedRouteSnapshot,
  ExpectedValues,
  generateFlexRoutesAndVerifyResultWithExpected,
} from './utils/route-test-helpers'

describe('complex route structures', () => {
  it('should define routes for complex structure', () => {
    const routeList = [
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
    ]
    const expectedRoutes: ExpectedRouteSnapshot = {
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
    }
    expectFilesToMatchSnapshot(routeList, expectedRoutes)
  })

  it('should correctly nest routes', () => {
    const routeList = [
      'app.$organizationSlug.tsx',
      'app.$organizationSlug.edit.tsx',
      'app.$organizationSlug.projects.tsx',
      'app.$organizationSlug.projects.$projectId.tsx',
      'app.$organizationSlug.projects.$projectId.edit.tsx',
      'app.$organizationSlug.projects.new.tsx',
    ]
    const expectedRoutes: ExpectedRouteSnapshot = {
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
    }
    expectFilesToMatchSnapshot(routeList, expectedRoutes)
  })

  it('should allow routes to specify different parent routes', () => {
    const routeList = [
      'parent.tsx',
      'parent.some.nested.tsx',
      'parent.some_.nested.page.tsx',
    ]
    const expectedRoutes: ExpectedRouteSnapshot = {
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
    }
    expectFilesToMatchSnapshot(routeList, expectedRoutes)
  })

  it('should handle params with trailing underscore', () => {
    const routeList = [
      'app.$organizationSlug_._projects.tsx',
      'app.$organizationSlug_._projects.projects.new.tsx',
      'app.$organizationSlug_._projects.projects.$projectId.tsx',
      'app.$organizationSlug_._projects.projects.$projectId.edit.tsx',
    ]
    const expectedRoutes: ExpectedRouteSnapshot = {
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
    }
    expectFilesToMatchSnapshot(routeList, expectedRoutes)
  })

  it('should not contain unnecessary trailing slash on path', () => {
    const routesWithExpectedValues: Record<string, ExpectedValues> = {
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

    generateFlexRoutesAndVerifyResultWithExpected(routesWithExpectedValues)
  })

  it('should attach children to layout when index shares segments', () => {
    const routeList = [
      'home/_layout.tsx',
      'home/index.tsx',
      'home/profile/route.tsx',
    ]
    const expectedRoutes: ExpectedRouteSnapshot = {
      'home/_layout': {
        file: 'routes/home/_layout.tsx',
        parentId: 'root',
        path: 'home',
      },
      'home/index': {
        file: 'routes/home/index.tsx',
        index: true,
        parentId: 'root',
        path: 'home',
      },
      'home/profile/route': {
        file: 'routes/home/profile/route.tsx',
        parentId: 'routes/home/_layout',
        path: 'profile',
      },
    }

    expectFilesToMatchSnapshot(routeList, expectedRoutes)
  })

  it('should skip index routes when finding parents', () => {
    const routeList = [
      'home/_layout.tsx',
      'home/kickoffs/_layout.tsx',
      'home/kickoffs/$id/index.tsx',
      'home/kickoffs/$id/$key/details.route.tsx',
    ]

    const expectedRoutes: ExpectedRouteSnapshot = {
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
    }

    expectFilesToMatchSnapshot(routeList, expectedRoutes)
  })
})
