import { afterEach, describe, expect, it, vi } from 'vitest'
import autoRoutes from '../src/core/index'
import type { RouteConfig } from '../src/core/types'
import { normalizeSnapshot } from '../src/migration/cli/diff'
import {
  createRoutesFromFolders,
  type RouteManifest,
} from '../src/migration/create-routes-from-folders'
import { migrate } from '../src/migration/migrate'
import {
  cleanupTmpWorkspaces,
  createRoutesFixture,
} from './utils/tmp-workspace'

afterEach(() => {
  vi.restoreAllMocks()
  delete (globalThis as any).__reactRouterAppDirectory
  cleanupTmpWorkspaces()
})

const STUB = 'export default function Route() { return null }\n'

type Node = {
  path?: string
  index?: boolean
  file: string
  children: Node[]
}

/** Renders a route tree like `react-router routes` does. */
function render(nodes: Node[], depth = 2): string {
  return nodes
    .map((node) => {
      const indent = '  '.repeat(depth)
      const attrs = [
        node.path !== undefined ? `path="${node.path}"` : '',
        `file="${node.file.replace(/\\/g, '/')}"`,
        node.index ? 'index' : '',
      ]
        .filter(Boolean)
        .join(' ')
      if (node.children.length === 0) {
        return `${indent}<Route ${attrs} />\n`
      }
      return (
        `${indent}<Route ${attrs}>\n` +
        render(node.children, depth + 1) +
        `${indent}</Route>\n`
      )
    })
    .join('')
}

function snapshot(nodes: Node[]): string {
  return `<Routes>\n  <Route file="root.tsx">\n${render(nodes)}  </Route>\n</Routes>\n`
}

function legacyTree(manifest: RouteManifest, parentId = 'root'): Node[] {
  return Object.values(manifest)
    .filter((route) => route.parentId === parentId)
    .map((route) => ({
      path: route.path,
      index: route.index,
      file: route.file,
      children: legacyTree(manifest, route.id),
    }))
}

function autoTree(routes: RouteConfig[]): Node[] {
  return routes.map((route) => ({
    path: route.path,
    index: route.index,
    // Present migrated files under the legacy folder name so `normalizeSnapshot`
    // compares them the way the CLI does after swapping directories.
    file: route.file.replace(/^new-routes\//, 'routes/'),
    children: autoTree(route.children ?? []),
  }))
}

function migrateRoundTrip(files: string[]) {
  vi.spyOn(console, 'log').mockImplementation(() => {})
  const fixture = createRoutesFixture(
    Object.fromEntries(files.map((file) => [`app/routes/${file}`, STUB])),
    'migration-round-trip',
  )
  const appDir = fixture.resolve('app')

  const before = snapshot(
    legacyTree(
      createRoutesFromFolders({
        appDirectory: appDir,
        routesDirectory: 'routes',
      }),
    ),
  )

  const target = fixture.resolve('app', 'new-routes')
  migrate(
    fixture.toCwdRelativePath(fixture.sourceDir),
    fixture.toCwdRelativePath(target),
  )
  ;(globalThis as any).__reactRouterAppDirectory = appDir
  const after = snapshot(autoTree(autoRoutes({ routesDir: 'new-routes' })))

  return {
    before: normalizeSnapshot(before),
    after: normalizeSnapshot(after),
    files: fixture.listRelativeFiles(target).map((f) => f.replace(/\\/g, '/')),
  }
}

describe('migration round trip', () => {
  it('keeps dot-named siblings out of promoted layouts', () => {
    const result = migrateRoundTrip([
      'settings/profile.tsx',
      'settings/profile.index.tsx',
      'settings/profile.two-factor.tsx',
      'settings/profile.two-factor.index.tsx',
    ])

    expect(result.after).toBe(result.before)
    expect(result.before.split('\n')).toContain(
      'file=routes/settings/profile.two-factor.tsx|parent=root.tsx|path=/settings/profile/two-factor|index=0|caseSensitive=0',
    )
    expect(result.files).toEqual([
      'settings/profile.index.tsx',
      'settings/profile/_layout.tsx',
      'settings/profile_.two-factor.index.tsx',
      'settings/profile_.two-factor/_layout.tsx',
    ])
  })

  it.each([
    [
      'deeper dot chains and folder children of escaped routes',
      [
        'settings/profile.tsx',
        'settings/profile.index.tsx',
        'settings/profile.two-factor.tsx',
        'settings/profile.two-factor/backup.tsx',
        'settings/profile.two-factor.recovery.tsx',
      ],
    ],
    [
      'params and pathless layouts',
      [
        'users/$id.tsx',
        'users/$id/index.tsx',
        'users/$id.edit.tsx',
        '__auth.tsx',
        '__auth/login.tsx',
        '__auth.logout.tsx',
      ],
    ],
    [
      'root-level dot siblings of a folder layout',
      ['settings.tsx', 'settings/index.tsx', 'settings.profile.tsx'],
    ],
    [
      'optional segments containing dots',
      ['(a.b.c).team.tsx', '(a.b.c).team/index.tsx', '(a.b.c).team.edit.tsx'],
    ],
    [
      'already-escaped legacy names',
      [
        'users/$username.tsx',
        'users/$username/index.tsx',
        'users/$username_.note-editor.tsx',
      ],
    ],
  ])('keeps parents and URLs for %s', (_name, files) => {
    const result = migrateRoundTrip(files)
    expect(result.after).toBe(result.before)
  })
})
