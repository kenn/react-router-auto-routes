import {
  createRoutesFromFiles,
  expectRoutes,
  filesByRoutesDir,
  flattenRoutesById,
} from './utils/route-test-helpers'

/** Routes for a two-mount setup: `/` → `routes`, `/admin` → `admin/routes`. */
function mountedRoutes(files: { root: string[]; admin: string[] }) {
  const routes = createRoutesFromFiles([], {
    routesDir: { '/': 'routes', '/admin': 'admin/routes' },
    visitFiles: filesByRoutesDir({
      '/routes': files.root,
      'admin/routes': files.admin,
    }),
  })
  return flattenRoutesById(routes)
}

describe('route ordering', () => {
  it('prefers static-leading paths over dynamic-leading paths at the same depth', () => {
    const routes = createRoutesFromFiles(['$id/root.tsx', 'root/$id.tsx'])

    expect(routes.map((route) => route.id)).toEqual([
      'routes/root/$id',
      'routes/$id/root',
    ])
  })
})

describe('layout nesting', () => {
  it('nests index and folder routes under layouts with shared segments', () => {
    expectRoutes([
      ['home/_layout.tsx', 'root', 'home'],
      ['home/index.tsx', 'home/_layout', undefined, 'index'],
      ['home/profile/route.tsx', 'home/_layout', 'profile'],
      ['settings/_layout.tsx', 'root', 'settings'],
      ['settings/index.tsx', 'settings/_layout', undefined, 'index'],
    ])
  })

  it('handles deeply nested layout hierarchies', () => {
    expectRoutes([
      ['dashboard/_layout.tsx', 'root', 'dashboard'],
      ['dashboard/projects/_layout.tsx', 'dashboard/_layout', 'projects'],
      [
        'dashboard/projects/$id/index.tsx',
        'dashboard/projects/_layout',
        ':id',
        'index',
      ],
      [
        'dashboard/projects/$id/$section/index.tsx',
        'dashboard/projects/_layout',
        ':id/:section',
        'index',
      ],
    ])
  })

  it('skips index routes when resolving parents', () => {
    expectRoutes([
      ['home/_layout.tsx', 'root', 'home'],
      ['home/kickoffs/_layout.tsx', 'home/_layout', 'kickoffs'],
      ['home/kickoffs/$id/index.tsx', 'home/kickoffs/_layout', ':id', 'index'],
      [
        'home/kickoffs/$id/$key/details.route.tsx',
        'home/kickoffs/_layout',
        ':id/:key/details',
      ],
    ])
  })
})

describe('layout file semantics', () => {
  it('makes root _layout.tsx the parent of direct root siblings', () => {
    expectRoutes([
      ['_layout.tsx', 'root'],
      ['index.tsx', '_layout', undefined, 'index'],
      ['about.tsx', '_layout', 'about'],
      ['route.tsx', '_layout', 'route'],
      ['dashboard/index.tsx', '_layout', 'dashboard', 'index'],
    ])
  })

  it('makes root _layout.tsx the parent of pathless-prefixed routes', () => {
    expectRoutes([
      ['_layout.tsx', 'root'],
      ['_top/index.tsx', '_layout', undefined, 'index'],
    ])
  })

  it('keeps nested pathless layouts between root _layout and children', () => {
    expectRoutes([
      ['_layout.tsx', 'root'],
      ['_top/_layout.tsx', '_layout'],
      ['_top/index.tsx', '_top/_layout', undefined, 'index'],
    ])
  })

  it('treats layout.tsx without the underscore as a normal route file', () => {
    expectRoutes([
      ['layout.tsx', 'root', 'layout'],
      ['index.tsx', 'root', undefined, 'index'],
      ['dashboard.layout.tsx', 'root', 'dashboard/layout'],
      ['dashboard.profile.tsx', 'root', 'dashboard/profile'],
      ['users/layout.tsx', 'root', 'users/layout'],
      ['users/index.tsx', 'root', 'users', 'index'],
      ['users/edit.tsx', 'root', 'users/edit'],
    ])
  })

  it('treats _layout.route.tsx as a normal route file', () => {
    expectRoutes([
      ['_layout.route.tsx', 'root', 'route'],
      ['index.tsx', 'root', undefined, 'index'],
    ])
  })

  it('allows _layout.tsx and layout.tsx to coexist in the same folder', () => {
    expectRoutes([
      ['dashboard/_layout.tsx', 'root', 'dashboard'],
      ['dashboard/layout.tsx', 'dashboard/_layout', 'layout'],
      ['dashboard/index.tsx', 'dashboard/_layout', undefined, 'index'],
      ['dashboard/settings.tsx', 'dashboard/_layout', 'settings'],
    ])
  })

  it('keeps foo.tsx and foo/route.tsx as siblings of foo/_layout.tsx', () => {
    expectRoutes([
      ['foo/_layout.tsx', 'root', 'foo'],
      ['foo.tsx', 'root', 'foo'],
      ['test-2/_layout.tsx', 'root', 'test-2'],
      ['test-2/about.tsx', 'test-2/_layout', 'about'],
      ['test-2/route.tsx', 'root', 'test-2'],
    ])
  })

  it('prefers the folder layout over a dot-notation layout with the same segments', () => {
    expectRoutes([
      ['x/route/route.team/_layout.tsx', 'root', 'x/route/route/team'],
      ['x.route.route.team/_layout.tsx', 'root', 'x/route/route/team'],
      ['x/route/route.team/item.tsx', 'x/route/route.team/_layout', 'item'],
    ])
  })

  it('supports dot-delimited layouts', () => {
    expectRoutes([
      ['_auth._modal._layout.tsx', 'root'],
      ['_auth._modal.login.tsx', '_auth._modal._layout', 'login'],
      ['_auth._modal.signup.tsx', '_auth._modal._layout', 'signup'],
    ])
  })

  it('nests dot-prefixed folders under a pathless folder layout', () => {
    expectRoutes([
      ['_login/_layout.tsx', 'root'],
      ['_login.login/index.tsx', '_login/_layout', 'login', 'index'],
      ['_login.register/index.tsx', '_login/_layout', 'register', 'index'],
    ])
  })

  it('keeps root _layout.tsx isolated to its own mount', () => {
    const manifest = mountedRoutes({
      root: ['_layout.tsx', 'about.tsx'],
      admin: ['index.tsx'],
    })

    expect(manifest['routes/about']?.parentId).toBe('routes/_layout')
    expect(manifest['admin/routes/index']?.parentId).toBe('root')
  })

  it('applies mount-local root _layout.tsx for secondary mounts only', () => {
    const manifest = mountedRoutes({
      root: ['about.tsx'],
      admin: ['_layout.tsx', 'users.tsx'],
    })

    expect(manifest['routes/about']?.parentId).toBe('root')
    expect(manifest['admin/routes/users']?.parentId).toBe(
      'admin/routes/_layout',
    )
  })
})

describe('hybrid route conventions', () => {
  it('handles hybrid flat and nested structures', () => {
    expectRoutes([
      ['_index/route.tsx', 'root', undefined, 'index'],
      ['_public/_layout.tsx', 'root'],
      ['_public/about/route.tsx', '_public/_layout', 'about'],
      ['_public/contact[.jpg]/route.tsx', '_public/_layout', 'contact.jpg'],
      ['test.$/route.tsx', 'root', 'test/*'],
      ['users/_layout.tsx', 'root', 'users'],
      'users/users.css',
      ['users/route/route.tsx', 'root', 'users'],
      ['users/$userId/route.tsx', 'users/_layout', ':userId'],
      'users/$userId/avatar.png',
      ['users/$userId_.edit/route.tsx', 'users/_layout', ':userId/edit'],
    ])
  })

  it('supports literal dot segments via escape syntax', () => {
    expectRoutes([
      ['robots[.]txt.ts', 'root', 'robots.txt'],
      [
        'app_.projects.$id.roadmap[.pdf].tsx',
        'root',
        'app/projects/:id/roadmap.pdf',
      ],
    ])
  })
})

describe('dot-notation routes', () => {
  it('keeps flat dot-notation files as root siblings', () => {
    expectRoutes([
      ['_auth.tsx', 'root'],
      ['_auth.login.tsx', 'root', 'login'],
      ['_landing.tsx', 'root'],
      ['_landing.about.tsx', 'root', 'about'],
      ['_landing.index.tsx', 'root', undefined, 'index'],
      ['app.tsx', 'root', 'app'],
      ['app.calendar.tsx', 'root', 'app/calendar'],
      ['app.calendar.index.tsx', 'root', 'app/calendar', 'index'],
      ['app.calendar.$day.tsx', 'root', 'app/calendar/:day'],
      ['users.$id.tsx', 'root', 'users/:id'],
      ['users.$id.edit.tsx', 'root', 'users/:id/edit'],
    ])
  })

  it('drops trailing underscores and pathless segments from paths', () => {
    expectRoutes([
      ['app_.projects.$id.roadmap.tsx', 'root', 'app/projects/:id/roadmap'],
      [
        'parent.some_.nested.settings.tsx',
        'root',
        'parent/some/nested/settings',
      ],
      [
        'app.$organizationSlug_._projects.projects.$projectId.edit.tsx',
        'root',
        'app/:organizationSlug/projects/:projectId/edit',
      ],
    ])
  })
})
