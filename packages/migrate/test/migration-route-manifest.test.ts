import { afterEach, describe, expect, it } from 'vitest'
import {
  cleanupTmpWorkspaces,
  createRoutesFixture,
} from '../../../test/utils/tmp-workspace'
import { createRoutesFromFolders } from '../src/create-routes-from-folders'

afterEach(() => {
  cleanupTmpWorkspaces()
})

const body = 'export default function Route() { return null }\n'

function manifestFor(files: string[]) {
  const fixture = createRoutesFixture(
    Object.fromEntries(files.map((file) => [`app/routes/${file}`, body])),
  )

  const routes = createRoutesFromFolders({
    appDirectory: fixture.resolve('app'),
    routesDirectory: 'routes',
  })

  // Use POSIX separators so the snapshot matches on Windows, and drop
  // undefined fields so it reflects only meaningful values.
  return JSON.parse(
    JSON.stringify(
      Object.values(routes).map((route) => ({
        ...route,
        file: route.file.replace(/\\/g, '/'),
      })),
    ),
  )
}

describe('legacy route manifest', () => {
  it('builds ids, parents, paths, and order for mixed conventions', () => {
    expect(
      manifestFor([
        '_index.tsx',
        'admin.tsx',
        'admin/index.tsx',
        'admin/$id.tsx',
        'admin/settings/route.tsx',
        'blog+/_layout.tsx',
        'blog+/$slug.tsx',
        'blog+/_index.tsx',
        'newsletter.tsx',
        'newsletter._index.tsx',
        '__auth.tsx',
        '__auth/login.tsx',
        '($lang).about.tsx',
        'files.$.tsx',
        'settings+/profile.two-factor.tsx',
        'settings+/profile.two-factor.index.tsx',
        'products.tsx',
        'products._index/route.tsx',
      ]),
    ).toMatchInlineSnapshot(`
      [
        {
          "file": "routes/settings+/profile.two-factor.tsx",
          "id": "routes/settings+/profile.two-factor",
          "parentId": "root",
          "path": "settings+/profile/two-factor",
        },
        {
          "file": "routes/settings+/profile.two-factor.index.tsx",
          "id": "routes/settings+/profile.two-factor.index",
          "index": true,
          "parentId": "routes/settings+/profile.two-factor",
        },
        {
          "file": "routes/($lang).about.tsx",
          "id": "routes/($lang).about",
          "parentId": "root",
          "path": ":lang?/about",
        },
        {
          "file": "routes/blog+/_layout.tsx",
          "id": "routes/blog+/_layout",
          "parentId": "root",
          "path": "blog+/_layout",
        },
        {
          "file": "routes/blog+/_index.tsx",
          "id": "routes/blog+/_index",
          "parentId": "root",
          "path": "blog+",
        },
        {
          "file": "routes/blog+/$slug.tsx",
          "id": "routes/blog+/$slug",
          "parentId": "root",
          "path": "blog+/:slug",
        },
        {
          "file": "routes/newsletter.tsx",
          "id": "routes/newsletter",
          "parentId": "root",
          "path": "newsletter",
        },
        {
          "file": "routes/newsletter._index.tsx",
          "id": "routes/newsletter._index",
          "index": true,
          "parentId": "routes/newsletter",
        },
        {
          "file": "routes/products.tsx",
          "id": "routes/products",
          "parentId": "root",
          "path": "products",
        },
        {
          "file": "routes/products._index/route.tsx",
          "id": "routes/products._index",
          "index": true,
          "parentId": "routes/products",
        },
        {
          "file": "routes/files.$.tsx",
          "id": "routes/files.$",
          "parentId": "root",
          "path": "files/*",
        },
        {
          "file": "routes/__auth.tsx",
          "id": "routes/__auth",
          "parentId": "root",
        },
        {
          "file": "routes/__auth/login.tsx",
          "id": "routes/__auth/login",
          "parentId": "routes/__auth",
          "path": "login",
        },
        {
          "file": "routes/_index.tsx",
          "id": "routes/_index",
          "parentId": "root",
        },
        {
          "file": "routes/admin.tsx",
          "id": "routes/admin",
          "parentId": "root",
          "path": "admin",
        },
        {
          "file": "routes/admin/settings/route.tsx",
          "id": "routes/admin/settings",
          "parentId": "routes/admin",
          "path": "settings",
        },
        {
          "file": "routes/admin/index.tsx",
          "id": "routes/admin/index",
          "index": true,
          "parentId": "routes/admin",
        },
        {
          "file": "routes/admin/$id.tsx",
          "id": "routes/admin/$id",
          "parentId": "routes/admin",
          "path": ":id",
        },
      ]
    `)
  })

  it('rejects duplicate paths', () => {
    expect(() => manifestFor(['users.list.tsx', 'users/list.tsx'])).toThrow(
      /conflicts with route/,
    )
  })

  it('rejects children under index routes', () => {
    expect(() => manifestFor(['index.tsx', 'index/child.tsx'])).toThrow(
      'Child routes are not allowed in index routes',
    )
  })
})
