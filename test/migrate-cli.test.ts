import fs from 'node:fs'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  diffSnapshots,
  findAmbiguousParents,
  normalizeSnapshot,
} from '../src/migration/cli/diff'
import { rewriteLegacyRouteEntry } from '../src/migration/cli/route-entry'
import { runCli, type CommandRunner } from '../src/migration/cli/run-cli'
import { migrate } from '../src/migration/migrate'

let consoleLogSpy: ReturnType<typeof vi.spyOn>
let consoleErrorSpy: ReturnType<typeof vi.spyOn>

function getStringMessages(calls: unknown[][]): string[] {
  return calls
    .map((call) => call[0])
    .filter((message): message is string => typeof message === 'string')
}

beforeEach(() => {
  consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

import {
  cleanupTmpWorkspaces,
  createBasicRoutesFixture,
  createRoutesFixture,
  type RoutesFixture,
  writeFiles,
} from './utils/tmp-workspace'

afterEach(() => {
  vi.restoreAllMocks()
  cleanupTmpWorkspaces()
})

const STUB = 'export default function Route() { return null }\n'

/** Route files with stub contents, keyed under `app/routes/`. */
function stubRoutes(...files: string[]) {
  return Object.fromEntries(files.map((file) => [`app/routes/${file}`, STUB]))
}

/** Runs `migrate()` from `app/routes` into `app/new-routes`. */
function migrateFixture(
  files: Record<string, string>,
  options?: Parameters<typeof migrate>[2],
) {
  const fixture = createRoutesFixture(files)
  const target = fixture.resolve('app', 'new-routes')
  migrate(
    fixture.toCwdRelativePath(fixture.sourceDir),
    fixture.toCwdRelativePath(target),
    options,
  )

  return {
    target,
    files: () => fixture.listRelativeFiles(target),
    read: (file: string) => fs.readFileSync(path.join(target, file), 'utf8'),
  }
}

describe('migrate', () => {
  it('normalizes trailing separators in provided directories', () => {
    const fixture = createBasicRoutesFixture()
    const target = fixture.resolve('app', 'new-routes')

    migrate(
      fixture.toCwdRelativePath(fixture.sourceDir) + path.sep,
      fixture.toCwdRelativePath(target) + path.sep,
    )

    expect(fixture.listRelativeFiles(target)).toEqual([
      'admin/$id.tsx',
      'admin/dashboard.tsx',
      'admin/index.tsx',
      'index.tsx',
    ])
  })

  it('migrates route files for each supported convention', () => {
    const result = migrateFixture(
      stubRoutes(
        'index.tsx',
        'about.tsx',
        'admin/_layout.tsx',
        'admin/_index.tsx',
        'admin/dashboard.tsx',
        'admin/users._index.tsx',
        'admin/users.$id.tsx',
        'blog/_index.tsx',
        'blog/$slug.tsx',
      ),
    )

    expect(result.files()).toEqual([
      'about.tsx',
      'admin/_index.tsx',
      'admin/_layout.tsx',
      'admin/dashboard.tsx',
      'admin/users.$id.tsx',
      'admin/users._index.tsx',
      'blog/$slug.tsx',
      'blog/_index.tsx',
      'index.tsx',
    ])
  })

  it('moves colocated files into + folders and keeps route entries', () => {
    const result = migrateFixture({
      ...stubRoutes(
        'app+/index.tsx',
        'app+/reports+/$id+/index.tsx',
        '_auth+/login/_login.tsx',
      ),
      'app/routes/app+/reports+/$id+/assets/template.mustache': 'mustache\n',
      'app/routes/app+/reports+/$id+/assets/support.ts': 'export {}\n',
      'app/routes/_auth+/login/schema.ts': 'export {}\n',
    })

    expect(result.files()).toEqual([
      '_auth/+login/schema.ts',
      '_auth/login/_login.tsx',
      'app/index.tsx',
      'app/reports/$id/+assets/support.ts',
      'app/reports/$id/+assets/template.mustache',
      'app/reports/$id/index.tsx',
    ])
  })

  it('converts folder routes (route.tsx) to flat files', () => {
    const result = migrateFixture({
      ...stubRoutes(
        'demo+/_layout/route.tsx',
        'demo+/_index/route.tsx',
        'demo+/conform.nested-array/route.tsx',
      ),
      'app/routes/demo+/about/route.tsx':
        "import type { Route } from './+types/route'\nexport default function About({ loaderData }: Route.ComponentProps) { return null }\n",
      'app/routes/demo+/conform.nested-array/schema.ts': 'export {}\n',
      'app/routes/demo+/conform.nested-array/components/field.tsx':
        'export {}\n',
    })

    expect(result.files()).toEqual([
      'demo/+conform.nested-array/components/field.tsx',
      'demo/+conform.nested-array/schema.ts',
      'demo/_index.tsx',
      'demo/_layout.tsx',
      'demo/about.tsx',
      'demo/conform.nested-array.tsx',
    ])
    expect(result.read('demo/about.tsx')).toContain("from './+types/about'")
  })

  it('ignores .DS_Store, also alongside custom ignore patterns', () => {
    const files = {
      ...stubRoutes('about.tsx'),
      'app/routes/.DS_Store': '',
      'app/routes/about.ignoreme': 'ignored\n',
    }

    expect(
      migrateFixture(files, { ignoredRouteFiles: ['**/*.ignoreme'] }).files(),
    ).toEqual(['about.tsx'])
    expect(() => migrateFixture(files)).toThrow(/about\.ignoreme/)
  })

  it('rewrites relative imports for migrated parent routes', () => {
    const result = migrateFixture({
      ...stubRoutes('admin/dashboard.tsx'),
      'app/routes/admin.tsx':
        "import { AdminShell } from '../components/AdminShell'\nexport default function AdminLayout() { return <AdminShell /> }\n",
      'app/components/AdminShell.tsx': 'export function AdminShell() {}\n',
    })

    expect(result.read('admin/_layout.tsx')).toContain(
      "from '../../components/AdminShell'",
    )
  })

  it('rewrites alias imports that reference legacy + folders', () => {
    const result = migrateFixture({
      ...stubRoutes('_top+/_layout.tsx', 'alternatives/index.tsx'),
      'app/routes/alternatives/_layout.tsx':
        "import TopLayout from '~/routes/_top+/_layout'\nexport default TopLayout\n",
      'app/routes/scribe+/_layout.tsx': STUB,
      'app/routes/scribe+/_modules/transcription.tsx': 'export {}\n',
      'app/routes/dash+/scribe+/index.tsx':
        "import { transcribe } from '~/routes/scribe+/_modules/transcription'\nexport default transcribe\n",
    })

    expect(result.read('alternatives/_layout.tsx')).toContain(
      "import TopLayout from '~/routes/_top/_layout'",
    )
    expect(result.read('dash/scribe/index.tsx')).toContain(
      "from '~/routes/scribe/+_modules/transcription'",
    )
  })

  it('rewrites alias imports for parent routes promoted to _layout', () => {
    const result = migrateFixture({
      'app/routes/settings/profile.two-factor.tsx':
        'export function TwoFactorLayout() { return null }\n',
      'app/routes/settings/profile.two-factor.index.tsx':
        "import { TwoFactorLayout } from '#app/routes/settings/profile.two-factor.tsx'\nexport default TwoFactorLayout\n",
    })

    expect(result.read('settings/profile.two-factor.index.tsx')).toContain(
      "from '#app/routes/settings/profile.two-factor/_layout.tsx'",
    )
  })

  it('rewrites own +types imports for promoted and escaped routes', () => {
    const typed = (name: string) =>
      `import type { Route } from './+types/${name}'\nexport default function R(_: Route.ComponentProps) { return null }\n`
    const result = migrateFixture({
      'app/routes/profile.tsx': typed('profile'),
      'app/routes/profile.index.tsx': typed('profile.index'),
      'app/routes/profile.edit.tsx': typed('profile.edit'),
    })

    expect(result.files()).toEqual([
      'profile.index.tsx',
      'profile/_layout.tsx',
      'profile_.edit.tsx',
    ])
    expect(result.read('profile/_layout.tsx')).toContain(
      "from './+types/_layout'",
    )
    expect(result.read('profile_.edit.tsx')).toContain(
      "from './+types/profile_.edit'",
    )
    expect(result.read('profile.index.tsx')).toContain(
      "from './+types/profile.index'",
    )
  })

  it('keeps explicit .js/.ts suffixes on rewritten +types imports', () => {
    const imports = (...specifiers: string[]) =>
      specifiers.map((s, i) => `import type { R${i} } from '${s}'\n`).join('') +
      'export default function R() { return null }\n'
    const result = migrateFixture({
      'app/routes/profile.tsx': imports('./+types/profile.js'),
      'app/routes/profile.index.tsx': STUB,
      'app/routes/profile.edit.tsx': imports(
        './+types/profile.edit.js',
        './+types/profile.edit.ts',
        './+types/profile.editor',
        './+types/profile.editor.js',
      ),
    })

    expect(result.read('profile/_layout.tsx')).toContain(
      "from './+types/_layout.js'",
    )
    const edit = result.read('profile_.edit.tsx')
    expect(edit).toContain("from './+types/profile_.edit.js'")
    expect(edit).toContain("from './+types/profile_.edit.ts'")
    expect(edit).toContain("from './+types/profile.editor'")
    expect(edit).toContain("from './+types/profile.editor.js'")
  })

  it('writes nothing when planning fails for any source file', () => {
    const fixture = createRoutesFixture({
      'app/routes/a.tsx': STUB,
      'app/routes/z.tsx': 'export default function Z( {\n',
    })
    const target = fixture.resolve('app', 'new-routes')

    expect(() =>
      migrate(
        fixture.toCwdRelativePath(fixture.sourceDir),
        fixture.toCwdRelativePath(target),
      ),
    ).toThrow(/z\.tsx.*Oxc could not parse.*Fix the syntax errors/s)
    expect(fs.existsSync(target)).toBe(false)
  })
})

describe('rewriteLegacyRouteEntry', () => {
  it('preserves ignoredRouteFiles from legacy flatRoutes config', () => {
    const fixture = createRoutesFixture(
      {
        'app/routes.ts': `import { flatRoutes } from 'remix-flat-routes'\nimport { defineRoutes } from '@remix-run/dev'\n\nexport default flatRoutes('routes', defineRoutes, {\n  ignoredRouteFiles: ['**/.*'],\n})\n`,
      },
      'rewrite-entry',
    )

    const entryPath = fixture.resolve('app', 'routes.ts')
    const result = rewriteLegacyRouteEntry(entryPath)
    expect(result.updated).toBe(true)

    const rewritten = fs.readFileSync(entryPath, 'utf8')
    expect(rewritten).toContain("routesDir: 'routes'")
    expect(rewritten).toContain("ignoredRouteFiles: ['**/.*']")
  })

  it('fails without overwriting when routesDir references a local binding', () => {
    const fixture = createRoutesFixture(
      {
        'app/routes.ts': `import { flatRoutes } from 'remix-flat-routes'
import { defineRoutes } from '@remix-run/dev'

const title = '日本語 😀'
const routesDirectory = 'routes'

export default flatRoutes(routesDirectory, defineRoutes, {
  // Keep this migration setting.
  ignoredRouteFiles: [title],
})
`,
      },
      'rewrite-entry-source-ranges',
    )

    const entryPath = fixture.resolve('app', 'routes.ts')
    const original = fs.readFileSync(entryPath, 'utf8')
    expect(() => rewriteLegacyRouteEntry(entryPath)).toThrow(
      /routesDirectory, title.*Inline these values/s,
    )
    expect(fs.readFileSync(entryPath, 'utf8')).toBe(original)
  })

  it('treats shorthand option properties as local references', () => {
    const fixture = createRoutesFixture(
      {
        'app/routes.ts': `import { flatRoutes } from 'remix-flat-routes'
import { defineRoutes } from '@remix-run/dev'
const ignoredRouteFiles = ['**/*.css']
export default flatRoutes('routes', defineRoutes, { ignoredRouteFiles })
`,
      },
      'rewrite-entry-shorthand',
    )
    const entryPath = fixture.resolve('app', 'routes.ts')
    const original = fs.readFileSync(entryPath, 'utf8')

    expect(() => rewriteLegacyRouteEntry(entryPath)).toThrow(
      /ignoredRouteFiles.*Inline these values/s,
    )
    expect(fs.readFileSync(entryPath, 'utf8')).toBe(original)
  })

  it('allows literal options with property names that match local bindings', () => {
    const fixture = createRoutesFixture(
      {
        'app/routes.ts': `import { flatRoutes } from 'remix-flat-routes'
import { defineRoutes } from '@remix-run/dev'
const ignoredRouteFiles = ['unused']
export default flatRoutes('routes', defineRoutes, { ignoredRouteFiles: ['**/*.css'] })
`,
      },
      'rewrite-entry-property-key',
    )
    const entryPath = fixture.resolve('app', 'routes.ts')

    expect(rewriteLegacyRouteEntry(entryPath).updated).toBe(true)
    expect(fs.readFileSync(entryPath, 'utf8')).toContain(
      "ignoredRouteFiles: ['**/*.css']",
    )
  })

  it('supports member-expression callees and JavaScript entry extensions', () => {
    for (const extension of ['js', 'jsx']) {
      const fixture = createRoutesFixture(
        {
          [`app/routes.${extension}`]: `import * as legacy from 'remix-flat-routes'\nexport default legacy.flatRoutes('routes', null, { ignoredRouteFiles: [] })\n`,
        },
        `rewrite-entry-${extension}`,
      )
      const entryPath = fixture.resolve('app', `routes.${extension}`)

      expect(rewriteLegacyRouteEntry(entryPath).updated).toBe(true)
      expect(fs.readFileSync(entryPath, 'utf8')).toContain(
        "export default autoRoutes({\n  routesDir: 'routes',",
      )
    }
  })

  it('leaves entries already using react-router-auto-routes unchanged', () => {
    const fixture = createRoutesFixture(
      {
        'app/routes.ts': `import { autoRoutes } from 'react-router-auto-routes'\nexport default autoRoutes()\n`,
      },
      'rewrite-entry-current',
    )
    const entryPath = fixture.resolve('app', 'routes.ts')
    const original = fs.readFileSync(entryPath, 'utf8')

    expect(rewriteLegacyRouteEntry(entryPath)).toEqual({ updated: false })
    expect(fs.readFileSync(entryPath, 'utf8')).toBe(original)
  })

  it('fails with parser diagnostics without overwriting invalid entries', () => {
    const fixture = createRoutesFixture(
      {
        'app/routes.ts': `import { flatRoutes } from 'remix-flat-routes'\nexport default flatRoutes({\n`,
      },
      'rewrite-entry-invalid',
    )
    const entryPath = fixture.resolve('app', 'routes.ts')
    const original = fs.readFileSync(entryPath, 'utf8')

    expect(() => rewriteLegacyRouteEntry(entryPath)).toThrow(
      /Oxc could not parse.*Fix the syntax errors/s,
    )
    expect(fs.readFileSync(entryPath, 'utf8')).toBe(original)
  })
})

const BASIC_ROUTE_FILES = [
  'admin/$id.tsx',
  'admin/dashboard.tsx',
  'admin/index.tsx',
  'index.tsx',
]
const LEGACY_ENTRY = `import { createRoutesFromFolders } from 'remix-flat-routes'\nexport default function routes() {\n  return createRoutesFromFolders(() => {})\n}\n`
const MISMATCHED_SNAPSHOTS = [
  `<Routes>\n  <Route file="routes/foo.tsx" />\n</Routes>\n`,
  `<Routes>\n  <Route file="routes/bar.tsx" />\n</Routes>\n`,
]

/** `foo.tsx` and `foo/_layout.tsx` normalize alike; `edit` sits under one. */
const ambiguousParentSnapshot = (parentFile: string) =>
  `<Routes>\n  <Route file="root.tsx">\n` +
  ['routes/foo.tsx', 'routes/foo/_layout.tsx']
    .map((file) =>
      file === parentFile
        ? `    <Route path="foo" file="${file}">\n      <Route path="edit" file="routes/foo/edit.tsx" />\n    </Route>\n`
        : `    <Route path="foo" file="${file}" />\n`,
    )
    .join('') +
  `  </Route>\n</Routes>\n`

/** A runner that returns `outputs` in order, repeating the last one. */
function runnerReturning(...outputs: string[]) {
  let call = 0
  return vi.fn<CommandRunner>(() => ({
    status: 0,
    stdout: outputs[Math.min(call++, outputs.length - 1)],
    stderr: '',
  }))
}

function runCliIn(
  fixture: RoutesFixture,
  argv: string[],
  options?: Parameters<typeof runCli>[1],
): number {
  const previousCwd = process.cwd()
  process.chdir(fixture.workspace)
  try {
    return runCli(argv, options)
  } finally {
    process.chdir(previousCwd)
  }
}

/**
 * A legacy workspace whose route file is renamed by the migration, so a
 * rollback can be told apart from a completed migration.
 */
function createRollbackFixture() {
  const fixture = createRoutesFixture({
    ...stubRoutes('index.tsx', 'demo+/about/route.tsx'),
    'app/routes.ts': LEGACY_ENTRY,
  })
  return { fixture, entryPath: fixture.resolve('app', 'routes.ts') }
}

/** The original tree and entry are restored; the migrated tree is kept aside. */
function expectRolledBack(fixture: RoutesFixture, entryPath: string) {
  expect(fixture.listRelativeFiles(fixture.sourceDir)).toEqual([
    path.join('demo+', 'about', 'route.tsx'),
    'index.tsx',
  ])
  expect(
    fixture.listRelativeFiles(fixture.resolve('app', 'new-routes')),
  ).toEqual([path.join('demo', 'about.tsx'), 'index.tsx'])
  expect(fs.existsSync(fixture.resolve('app', 'old-routes'))).toBe(false)
  expect(fs.readFileSync(entryPath, 'utf8')).toBe(LEGACY_ENTRY)
}

describe('runCli', () => {
  it('prints help without validating the workspace', () => {
    expect(runCli(['--help'])).toBe(0)
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Usage: migrate-auto-routes'),
    )
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('-h, --help'),
    )
    expect(consoleErrorSpy).not.toHaveBeenCalled()
  })

  it('rejects unknown flags instead of treating them as directories', () => {
    expect(runCli(['--dry-run'])).toBe(1)
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Unknown option '--dry-run'."),
    )
  })

  it('migrates with default directories, logs the swap, and removes the backup', () => {
    const fixture = createBasicRoutesFixture('run-cli-success')

    expect(runCliIn(fixture, [], { runner: runnerReturning('ROUTES\n') })).toBe(
      0,
    )

    expect(consoleErrorSpy.mock.calls).toEqual([])
    expect(fs.existsSync(fixture.resolve('app', 'old-routes'))).toBe(false)
    expect(fs.existsSync(fixture.resolve('app', 'new-routes'))).toBe(false)
    expect(fixture.listRelativeFiles(fixture.sourceDir)).toEqual(
      BASIC_ROUTE_FILES,
    )

    const messages = getStringMessages(consoleLogSpy.mock.calls)
    const backupIndex = messages.findIndex((message) =>
      message.includes("Backed up 'app/routes' to 'app/old-routes'"),
    )
    const promotedIndex = messages.findIndex((message) =>
      message.includes("Promoted 'app/new-routes' to 'app/routes'"),
    )
    expect(backupIndex).toBeGreaterThanOrEqual(0)
    expect(promotedIndex).toBeGreaterThan(backupIndex)
  })

  it('accepts route output that differs only by convention renames', () => {
    const fixture = createRoutesFixture({
      'app/routes/root.tsx': 'export default function Root() { return null }\n',
      'app/routes/_auth+/_layout.tsx':
        'export default function Layout() { return null }\n',
      'app/routes/_auth+/login.tsx':
        'export default function Login() { return null }\n',
    })
    const runner = runnerReturning(
      `<Routes>\n  <Route file="root.tsx">\n    <Route file="routes/_auth+/_layout.tsx">\n      <Route path="login" file="routes/_auth+/login.tsx" />\n    </Route>\n  </Route>\n</Routes>\n`,
      `<Routes>\n  <Route file="root.tsx">\n    <Route file="routes/_auth/_layout.tsx">\n      <Route path="login" file="routes/_auth/login.tsx" />\n    </Route>\n  </Route>\n</Routes>\n`,
    )

    expect(
      runCliIn(fixture, ['app/routes', 'app/new-routes'], { runner }),
    ).toBe(0)
    expect(fixture.listRelativeFiles(fixture.sourceDir)).toEqual([
      '_auth/_layout.tsx',
      '_auth/login.tsx',
      'root.tsx',
    ])
    expect(fs.existsSync(fixture.resolve('app', 'old-routes'))).toBe(false)
  })

  it('rewrites legacy remix-flat-routes entry to autoRoutes()', () => {
    const fixture = createBasicRoutesFixture('run-cli-legacy')
    const entryPath = fixture.resolve('app', 'routes.ts')
    fs.writeFileSync(entryPath, LEGACY_ENTRY)
    fixture.git('add', 'app/routes.ts')
    fixture.git('commit', '-m', 'legacy entry')
    const runner = runnerReturning('ROUTES\n')

    expect(runCliIn(fixture, ['app/routes'], { runner })).toBe(0)

    expect(runner).toHaveBeenCalledTimes(2)
    expect(fs.readFileSync(entryPath, 'utf8')).toBe(
      "import { autoRoutes } from 'react-router-auto-routes'\n" +
        "import { type RouteConfig } from '@react-router/dev/routes'\n\n" +
        'export default autoRoutes() satisfies RouteConfig\n',
    )
    expect(fixture.listRelativeFiles(fixture.sourceDir)).toEqual(
      BASIC_ROUTE_FILES,
    )
  })

  it('refuses to run when not inside a git repository', () => {
    const fixture = createBasicRoutesFixture('run-cli-no-git')
    fs.rmSync(path.join(fixture.workspace, '.git'), { recursive: true })

    expect(runCliIn(fixture, ['app/routes'])).toBe(1)
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Git repository not detected'),
    )
  })

  it('refuses to run when the source directory is dirty, but not for other files', () => {
    const fixture = createBasicRoutesFixture('run-cli-dirty')
    fs.writeFileSync(fixture.resolve('NOTES.md'), 'notes\n')
    fs.writeFileSync(fixture.resolve('app', 'routes', 'dirty.tmp'), 'dirty\n')

    expect(runCliIn(fixture, ['app/routes'])).toBe(1)
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Working tree must be clean for 'app/routes'"),
    )

    // An unstaged edit to a tracked route (` M app/routes/...`) also counts.
    fs.rmSync(fixture.resolve('app', 'routes', 'dirty.tmp'))
    fs.appendFileSync(
      fixture.resolve('app', 'routes', 'index.tsx'),
      '// edit\n',
    )
    consoleErrorSpy.mockClear()
    expect(runCliIn(fixture, ['app/routes'])).toBe(1)
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Working tree must be clean for 'app/routes'"),
    )

    fixture.git('checkout', '--', 'app/routes/index.tsx')
    expect(
      runCliIn(fixture, ['app/routes'], {
        runner: runnerReturning('ROUTES\n'),
      }),
    ).toBe(0)
  })

  it.each([
    ['./app/routes', 'source and target directories must be different'],
    ['app/routes/new', 'target directory cannot be inside the source'],
    ['app', 'source directory cannot be inside the target'],
  ])('refuses target %s without touching the source', (target, message) => {
    const fixture = createBasicRoutesFixture('run-cli-same-dir')

    expect(
      runCliIn(fixture, ['app/routes', target], {
        runner: runnerReturning('ROUTES\n'),
      }),
    ).toBe(1)
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining(message),
    )
    expect(fixture.listRelativeFiles(fixture.sourceDir)).toEqual(
      BASIC_ROUTE_FILES,
    )
  })

  it('refuses a target that reaches the source through a symlinked alias', () => {
    const fixture = createBasicRoutesFixture('run-cli-alias')
    fs.symlinkSync(fixture.resolve('app'), fixture.resolve('alias'), 'dir')

    expect(runCliIn(fixture, ['app/routes', 'alias/routes'])).toBe(1)
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        'source and target directories must be different',
      ),
    )
    expect(fixture.listRelativeFiles(fixture.sourceDir)).toEqual(
      BASIC_ROUTE_FILES,
    )
  })

  it('refuses a target that contains the source link itself', () => {
    const fixture = createRoutesFixture({
      ...stubRoutes('index.tsx'),
      'links/notes.md': 'notes\n',
    })
    fs.symlinkSync('../app/routes', fixture.resolve('links', 'routes'), 'dir')

    expect(runCliIn(fixture, ['links/routes', 'links'])).toBe(1)
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('source directory cannot be inside the target'),
    )
    expect(fs.existsSync(fixture.resolve('links', 'notes.md'))).toBe(true)
  })

  it.for([
    ['links/app', 'links'],
    ['links/../app', 'links'],
    ['links/app', 'LINKS'],
  ])('protects source link %s when the target is %s', ([link, target], ctx) => {
    const fixture = createRoutesFixture(stubRoutes('index.tsx'))
    writeFiles(fixture.workspace, { 'links/notes.md': 'local notes' })
    if (!fs.existsSync(fixture.resolve(target))) ctx.skip()
    fs.symlinkSync('../app', fixture.resolve('links', 'app'), 'dir')
    fs.symlinkSync(link, fixture.resolve('alias'), 'dir')
    const runner = runnerReturning('ROUTES')

    expect(runCliIn(fixture, ['alias/routes', target], { runner })).toBe(1)
    expect(runner).not.toHaveBeenCalled()
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('source directory cannot be inside the target'),
    )
    expect(fs.readFileSync(fixture.resolve('links', 'notes.md'), 'utf8')).toBe(
      'local notes',
    )
    expect(
      fs.readFileSync(fixture.resolve('alias/routes/index.tsx'), 'utf8'),
    ).toBe(STUB)
  })

  it('refuses a target that is an existing file and leaves it intact', () => {
    const { fixture, entryPath } = createRollbackFixture()
    const runner = runnerReturning('ROUTES\n')

    expect(runCliIn(fixture, ['app/routes', 'app/routes.ts'], { runner })).toBe(
      1,
    )
    expect(runner).not.toHaveBeenCalled()
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("target 'app/routes.ts' is not a directory"),
    )
    expect(fs.readFileSync(entryPath, 'utf8')).toBe(LEGACY_ENTRY)
  })

  it('refuses a source that is a file', () => {
    const { fixture, entryPath } = createRollbackFixture()

    expect(runCliIn(fixture, ['app/routes.ts', 'app/new-routes'])).toBe(1)
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("source 'app/routes.ts' is not a directory"),
    )
    expect(fs.readFileSync(entryPath, 'utf8')).toBe(LEGACY_ENTRY)
  })

  it.each(['app/old-routes/staging', 'app/OLD-ROUTES'])(
    'refuses target %s that overlaps the backup directory',
    (target) => {
      const fixture = createBasicRoutesFixture('run-cli-backup')

      expect(runCliIn(fixture, ['app/routes', target])).toBe(1)
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('backup directory old-routes'),
      )
      expect(fixture.listRelativeFiles(fixture.sourceDir)).toEqual(
        BASIC_ROUTE_FILES,
      )
    },
  )

  it('restores the source when promoting the new routes fails', () => {
    const fixture = createBasicRoutesFixture('run-cli-promote-fail')
    const rename = fs.renameSync
    let calls = 0
    vi.spyOn(fs, 'renameSync').mockImplementation((from, to) => {
      if (++calls === 2) {
        throw new Error('EXDEV: cross-device link not permitted')
      }
      rename(from, to)
    })

    expect(
      runCliIn(fixture, ['app/routes'], {
        runner: runnerReturning('ROUTES\n'),
      }),
    ).toBe(1)
    expect(fixture.listRelativeFiles(fixture.sourceDir)).toEqual(
      BASIC_ROUTE_FILES,
    )
    expect(fs.existsSync(fixture.resolve('app', 'old-routes'))).toBe(false)
  })

  it('refuses a case-variant target on case-insensitive filesystems', (ctx) => {
    const fixture = createBasicRoutesFixture('run-cli-case')
    if (!fs.existsSync(fixture.resolve('app', 'ROUTES'))) {
      ctx.skip()
    }

    expect(runCliIn(fixture, ['app/routes', 'app/ROUTES'])).toBe(1)
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        'source and target directories must be different',
      ),
    )
    expect(fixture.listRelativeFiles(fixture.sourceDir)).toEqual(
      BASIC_ROUTE_FILES,
    )
  })

  it('treats a ..-prefixed directory name as a child, not a parent', () => {
    const fixture = createRoutesFixture({ 'app/..routes/index.tsx': STUB })

    expect(runCliIn(fixture, ['app/..routes', 'app'])).toBe(1)
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('source directory cannot be inside the target'),
    )
    expect(
      fixture.listRelativeFiles(fixture.resolve('app', '..routes')),
    ).toEqual(['index.tsx'])
  })

  it('detects dirty files whose paths git would quote', () => {
    const fixture = createRoutesFixture({ 'app/画面/about.tsx': STUB })
    fs.appendFileSync(fixture.resolve('app', '画面', 'about.tsx'), '// edit\n')

    expect(runCliIn(fixture, ['app/画面'])).toBe(1)
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Working tree must be clean'),
    )
  })

  it('detects a source inside an untracked parent directory', () => {
    const fixture = createRoutesFixture({ 'README.md': 'readme\n' })
    writeFiles(fixture.workspace, stubRoutes('index.tsx'))

    expect(runCliIn(fixture, ['app/routes'])).toBe(1)
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Working tree must be clean for 'app/routes'"),
    )
  })

  it('stops before migrating when the current routes have ambiguous parents', () => {
    const fixture = createBasicRoutesFixture('run-cli-ambiguous-before')
    const runner = runnerReturning(ambiguousParentSnapshot('routes/foo.tsx'))

    expect(runCliIn(fixture, ['app/routes'], { runner })).toBe(1)
    expect(runner).toHaveBeenCalledTimes(1)
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('routes/foo.tsx, routes/foo/_layout.tsx'),
    )
    expect(fs.existsSync(fixture.resolve('app', 'new-routes'))).toBe(false)
    expect(fixture.listRelativeFiles(fixture.sourceDir)).toEqual(
      BASIC_ROUTE_FILES,
    )
  })

  it('reverts when the migrated routes have ambiguous parents', () => {
    const { fixture, entryPath } = createRollbackFixture()
    const runner = runnerReturning(
      'ROUTES\n',
      ambiguousParentSnapshot('routes/foo/_layout.tsx'),
    )

    expect(runCliIn(fixture, ['app/routes'], { runner })).toBe(1)
    expectRolledBack(fixture, entryPath)
    // Stopped by the ambiguity check, not by the ordinary route diff.
    const errors = getStringMessages(consoleErrorSpy.mock.calls)
    expect(errors).toContainEqual(
      expect.stringContaining('routes/foo.tsx, routes/foo/_layout.tsx'),
    )
    expect(errors).not.toContainEqual(
      expect.stringContaining('Route output changed'),
    )
  })

  it('reverts routes and the legacy entry when route generation differs', () => {
    const { fixture, entryPath } = createRollbackFixture()

    expect(
      runCliIn(fixture, ['app/routes'], {
        runner: runnerReturning(...MISMATCHED_SNAPSHOTS),
      }),
    ).toBe(1)

    expectRolledBack(fixture, entryPath)
    expect(getStringMessages(consoleErrorSpy.mock.calls)).toContainEqual(
      expect.stringContaining('--- react-router routes (before)'),
    )
  })

  it('reverts routes and the legacy entry when the second snapshot fails', () => {
    const { fixture, entryPath } = createRollbackFixture()
    const runner = vi
      .fn<CommandRunner>()
      .mockReturnValueOnce({ status: 0, stdout: 'ROUTES\n', stderr: '' })
      .mockReturnValueOnce({ status: 1, stdout: '', stderr: 'boom' })

    expect(runCliIn(fixture, ['app/routes'], { runner })).toBe(1)

    expectRolledBack(fixture, entryPath)
  })

  it('supports dry run mode without swapping directories', () => {
    const fixture = createBasicRoutesFixture('run-cli-dry-run')

    expect(
      runCliIn(fixture, [], {
        runner: runnerReturning('ROUTES\n'),
        dryRun: true,
      }),
    ).toBe(0)

    expect(getStringMessages(consoleLogSpy.mock.calls)).toContainEqual(
      expect.stringContaining('Dry run complete'),
    )
    expect(fs.existsSync(fixture.resolve('app', 'old-routes'))).toBe(false)
    expect(fs.existsSync(fixture.sourceDir)).toBe(true)
    expect(fs.existsSync(fixture.resolve('app', 'new-routes'))).toBe(true)
  })
})

describe('normalizeSnapshot', () => {
  const routes = (...lines: string[]) =>
    `<Routes>\n  <Route file="root.tsx">\n${lines.map((line) => `    ${line}\n`).join('')}  </Route>\n</Routes>\n`

  it.each([
    [
      'folder routes (route.tsx) and flat files',
      routes(
        '<Route file="routes/demo+/about/route.tsx" />',
        '<Route file="routes/demo+/_index/route.tsx" index />',
      ),
      routes(
        '<Route file="routes/demo/about.tsx" />',
        '<Route file="routes/demo/_index.tsx" index />',
      ),
    ],
    [
      'parent routes and promoted _layout files',
      routes(
        '<Route path="settings/profile" file="routes/settings/profile.tsx">',
        '  <Route file="routes/settings/profile.index.tsx" index />',
        '</Route>',
      ),
      routes(
        '<Route path="settings/profile" file="routes/settings/profile/_layout.tsx">',
        '  <Route file="routes/settings/profile/index.tsx" index />',
        '</Route>',
      ),
    ],
    [
      // The migration escapes `profile_` so two-factor keeps its legacy parent.
      'a dot-named sibling escaped out of a promoted layout',
      routes(
        '<Route path="settings/profile" file="routes/settings/profile.tsx" />',
        '<Route path="settings/profile/two-factor" file="routes/settings/profile.two-factor.tsx" />',
      ),
      routes(
        '<Route path="settings/profile" file="routes/settings/profile/_layout.tsx" />',
        '<Route path="settings/profile/two-factor" file="routes/settings/profile_.two-factor/_layout.tsx" />',
      ),
    ],
    [
      'trailing underscore folders and dot notation',
      routes('<Route file="routes/users/$username_.note-editor.tsx" />'),
      routes('<Route file="routes/users/$username_/_note-editor.tsx" />'),
    ],
  ])('treats %s as equivalent', (_name, before, after) => {
    expect(normalizeSnapshot(before)).toBe(normalizeSnapshot(after))
  })

  it.each([
    [
      'a URL change for the same file',
      routes('<Route path="old" file="routes/about.tsx" />'),
      routes('<Route path="new" file="routes/about.tsx" />'),
    ],
    [
      'the same URL split differently across a new parent',
      routes(
        '<Route path="settings" file="routes/settings.tsx" />',
        '<Route path="settings/profile" file="routes/settings.profile.tsx" />',
      ),
      routes(
        '<Route path="settings" file="routes/settings.tsx">',
        '  <Route path="profile" file="routes/settings.profile.tsx" />',
        '</Route>',
      ),
    ],
    [
      // Real legacy vs migrated output: `profile.two-factor.tsx` is a root
      // route in the folder convention, but its migrated `_layout` nests
      // under `profile/_layout.tsx`.
      'a dot-named sibling the migration nests under a promoted layout',
      routes(
        '<Route path="settings/profile" file="routes/settings/profile.tsx" />',
        '<Route path="settings/profile/two-factor" file="routes/settings/profile.two-factor.tsx" />',
      ),
      routes(
        '<Route path="settings/profile" file="routes/settings/profile/_layout.tsx">',
        '  <Route path="two-factor" file="routes/settings/profile.two-factor/_layout.tsx" />',
        '</Route>',
      ),
    ],
    [
      'a route moved out of its layout',
      routes(
        '<Route file="routes/_auth.tsx">',
        '  <Route path="login" file="routes/_auth.login.tsx" />',
        '</Route>',
      ),
      routes(
        '<Route file="routes/_auth.tsx" />',
        '<Route path="login" file="routes/_auth.login.tsx" />',
      ),
    ],
  ])('treats %s as a mismatch', (_name, before, after) => {
    expect(normalizeSnapshot(before)).not.toBe(normalizeSnapshot(after))
  })

  it('keeps the full URL and parent in each normalized line', () => {
    expect(
      normalizeSnapshot(
        routes(
          '<Route path="settings" file="routes/settings/_layout.tsx">',
          '  <Route path="profile" file="routes/settings/profile.tsx" />',
          '  <Route index file="routes/settings/index.tsx" />',
          '</Route>',
        ),
      ).split('\n'),
    ).toContain(
      'file=routes/settings/profile.tsx|parent=routes/settings.tsx|path=/settings/profile|index=0|caseSensitive=0',
    )
  })

  it('reports parents whose files normalize to the same name', () => {
    for (const parent of ['routes/foo.tsx', 'routes/foo/_layout.tsx']) {
      expect(findAmbiguousParents(ambiguousParentSnapshot(parent))).toEqual([
        ['routes/foo.tsx', 'routes/foo/_layout.tsx'],
      ])
    }
    // Both placements normalize identically, which is why they must be caught.
    expect(normalizeSnapshot(ambiguousParentSnapshot('routes/foo.tsx'))).toBe(
      normalizeSnapshot(ambiguousParentSnapshot('routes/foo/_layout.tsx')),
    )
  })

  it('does not flag a plain foo.tsx to foo/_layout.tsx promotion', () => {
    const before = routes(
      '<Route path="foo" file="routes/foo.tsx">',
      '  <Route path="edit" file="routes/foo/edit.tsx" />',
      '</Route>',
    )
    const after = routes(
      '<Route path="foo" file="routes/foo/_layout.tsx">',
      '  <Route path="edit" file="routes/foo/edit.tsx" />',
      '</Route>',
    )
    expect(findAmbiguousParents(before)).toEqual([])
    expect(findAmbiguousParents(after)).toEqual([])
    expect(normalizeSnapshot(before)).toBe(normalizeSnapshot(after))
  })

  it('renders a line diff for mismatched snapshots', () => {
    const diff = diffSnapshots(
      normalizeSnapshot(MISMATCHED_SNAPSHOTS[0]),
      normalizeSnapshot(MISMATCHED_SNAPSHOTS[1]),
    )
    expect(diff).toContain('-file=routes/foo.tsx')
    expect(diff).toContain('+file=routes/bar.tsx')
  })
})
