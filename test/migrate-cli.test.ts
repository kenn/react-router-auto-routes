import fs from 'node:fs'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { diffSnapshots, normalizeSnapshot } from '../src/migration/cli/diff'
import { rewriteLegacyRouteEntry } from '../src/migration/cli/route-entry'
import { runCli, type CommandRunner } from '../src/migration/cli/run-cli'
import { createRoutesFromFolders } from '../src/migration/create-routes-from-folders'
import { migrate } from '../src/migration/migrate'
import { defineRoutes } from '../src/migration/route-definition'

let consoleLogSpy: ReturnType<typeof vi.spyOn>
let consoleErrorSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

import {
  cleanupTmpWorkspaces,
  createBasicRoutesFixture,
  createRoutesFixture,
} from './utils/tmp-workspace'

afterEach(() => {
  vi.restoreAllMocks()
  cleanupTmpWorkspaces()
})

describe('migrate CLI', () => {
  it('normalizes trailing separators in provided directories', () => {
    const fixture = createBasicRoutesFixture()

    const sourceAbsolute = fixture.sourceDir
    const targetAbsolute = fixture.resolve('app', 'new-routes')

    const sourceArg = fixture.toCwdRelativePath(sourceAbsolute) + path.sep
    const targetArg = fixture.toCwdRelativePath(targetAbsolute) + path.sep

    migrate(sourceArg, targetArg, { force: true })

    const files = fixture.listRelativeFiles(targetAbsolute)
    expect(files).toEqual([
      'admin/$id.tsx',
      'admin/dashboard.tsx',
      'admin/index.tsx',
      'index.tsx',
    ])
  })

  it('migrates route files for each supported convention', () => {
    const fixture = createRoutesFixture({
      'app/routes/index.tsx':
        'export default function Index() { return null }\n',
      'app/routes/about.tsx':
        'export default function About() { return null }\n',
      'app/routes/admin/_layout.tsx':
        'import { Outlet } from "react-router"\nexport default function AdminLayout() { return <Outlet /> }\n',
      'app/routes/admin/_index.tsx':
        'export default function AdminIndex() { return null }\n',
      'app/routes/admin/dashboard.tsx':
        'export default function Dashboard() { return null }\n',
      'app/routes/admin/users._index.tsx':
        'export default function UsersIndex() { return null }\n',
      'app/routes/admin/users.$id.tsx':
        'export default function UserDetail() { return null }\n',
      'app/routes/blog/_index.tsx':
        'export default function BlogIndex() { return null }\n',
      'app/routes/blog/$slug.tsx':
        'export default function BlogPost() { return null }\n',
      'app/routes/marketing/_layout.tsx':
        'import { Outlet } from "react-router"\nexport default function MarketingLayout() { return <Outlet /> }\n',
      'app/routes/marketing/_index.tsx':
        'export default function MarketingIndex() { return null }\n',
      'app/routes/marketing/pricing.tsx':
        'export default function Pricing() { return null }\n',
    })

    const sourceAbsolute = fixture.sourceDir
    const sourceArg = fixture.toCwdRelativePath(sourceAbsolute)

    const targetAbsolute = fixture.resolve('app', 'new-routes')
    const targetArg = fixture.toCwdRelativePath(targetAbsolute)

    migrate(sourceArg, targetArg, {
      force: true,
    })

    const files = fixture.listRelativeFiles(targetAbsolute)
    expect(files).toEqual([
      'about.tsx',
      'admin/_index.tsx',
      'admin/_layout.tsx',
      'admin/dashboard.tsx',
      'admin/users.$id.tsx',
      'admin/users._index.tsx',
      'blog/$slug.tsx',
      'blog/_index.tsx',
      'index.tsx',
      'marketing/_index.tsx',
      'marketing/_layout.tsx',
      'marketing/pricing.tsx',
    ])
  })

  it('migrates colocated files with + prefix', () => {
    const fixture = createRoutesFixture({
      'app/routes/app+/index.tsx':
        'export default function AppHome() { return null }\n',
      'app/routes/app+/reports+/$id+/index.tsx':
        'export default function Report() { return null }\n',
      'app/routes/app+/reports+/$id+/assets/template.mustache':
        'ignored mustache\n',
      'app/routes/app+/reports+/$id+/assets/support.ts':
        'export const helper = () => null\n',
    })

    const sourceAbsolute = fixture.sourceDir
    const sourceArg = fixture.toCwdRelativePath(sourceAbsolute)

    const targetAbsolute = fixture.resolve('app', 'new-routes')
    const targetArg = fixture.toCwdRelativePath(targetAbsolute)

    migrate(sourceArg, targetArg, {
      force: true,
    })

    const files = fixture.listRelativeFiles(targetAbsolute)
    expect(files).toContain('app/reports/$id/+assets/template.mustache')
    expect(files).toContain('app/reports/$id/+assets/support.ts')
    expect(files).toContain('app/index.tsx')
    expect(files).toContain('app/reports/$id/index.tsx')
  })

  it('ignores macOS metadata files', () => {
    const fixture = createRoutesFixture({
      'app/routes/.DS_Store': '',
      'app/routes/index.tsx':
        'export default function Index() { return null }\n',
    })

    const sourceAbsolute = fixture.sourceDir
    const sourceArg = fixture.toCwdRelativePath(sourceAbsolute)

    const targetAbsolute = fixture.resolve('app', 'new-routes')
    const targetArg = fixture.toCwdRelativePath(targetAbsolute)

    migrate(sourceArg, targetArg, {
      force: true,
    })

    const files = fixture.listRelativeFiles(targetAbsolute)
    expect(files).toEqual(['index.tsx'])
  })

  it('keeps ignoring .DS_Store when custom ignore patterns are provided', () => {
    const fixture = createRoutesFixture({
      'app/routes/.DS_Store': '',
      'app/routes/about.ignoreme': 'ignored\n',
      'app/routes/about.tsx':
        'export default function About() { return null }\n',
    })

    const sourceArg = fixture.toCwdRelativePath(fixture.sourceDir)
    const targetAbsolute = fixture.resolve('app', 'new-routes')
    const targetArg = fixture.toCwdRelativePath(targetAbsolute)

    migrate(sourceArg, targetArg, {
      force: true,
      ignoredRouteFiles: ['**/*.ignoreme'],
    })

    const files = fixture.listRelativeFiles(targetAbsolute)
    expect(files).toEqual(['about.tsx'])
  })

  it('rewrites relative imports for migrated parent routes', () => {
    const fixture = createRoutesFixture({
      'app/routes/admin.tsx':
        "import { AdminShell } from '../components/AdminShell'\nexport default function AdminLayout() { return <AdminShell /> }\n",
      'app/routes/admin/dashboard.tsx':
        'export default function Dashboard() { return null }\n',
      'app/components/AdminShell.tsx':
        'export function AdminShell() { return null }\n',
    })

    const sourceAbsolute = fixture.sourceDir
    const sourceArg = fixture.toCwdRelativePath(sourceAbsolute)

    const targetAbsolute = fixture.resolve('app', 'new-routes')
    const targetArg = fixture.toCwdRelativePath(targetAbsolute)

    migrate(sourceArg, targetArg, {
      force: true,
    })

    const layoutPath = path.join(targetAbsolute, 'admin', '_layout.tsx')
    const contents = fs.readFileSync(layoutPath, 'utf8')
    expect(contents).toContain("from '../../components/AdminShell'")
  })

  it('updates legacy alias imports that reference + suffixed folders', () => {
    const fixture = createRoutesFixture({
      'app/routes/_top+/_layout.tsx':
        'export default function TopLayout() { return null }\n',
      'app/routes/alternatives/_layout.tsx':
        "import TopLayout from '~/routes/_top+/_layout'\nexport default TopLayout\n",
      'app/routes/alternatives/index.tsx':
        'export default function AlternativesIndex() { return null }\n',
    })

    const sourceArg = fixture.toCwdRelativePath(fixture.sourceDir)
    const targetAbsolute = fixture.resolve('app', 'new-routes')
    const targetArg = fixture.toCwdRelativePath(targetAbsolute)

    migrate(sourceArg, targetArg, {
      force: true,
    })

    const layoutPath = path.join(targetAbsolute, 'alternatives', '_layout.tsx')
    const contents = fs.readFileSync(layoutPath, 'utf8')
    expect(contents).toContain("import TopLayout from '~/routes/_top/_layout'")
  })

  it('rewrites alias imports for colocated modules with + prefix', () => {
    const fixture = createRoutesFixture({
      'app/routes/scribe+/_layout.tsx':
        'import { Outlet } from "react-router"\nexport default function ScribeLayout() { return <Outlet /> }\n',
      'app/routes/scribe+/_modules/transcription.tsx':
        'export const transcribe = () => null\n',
      'app/routes/dash+/scribe+/index.tsx':
        "import { transcribe } from '~/routes/scribe+/_modules/transcription'\nexport default function ScribeIndex() { return transcribe() }\n",
    })

    const sourceArg = fixture.toCwdRelativePath(fixture.sourceDir)
    const targetAbsolute = fixture.resolve('app', 'new-routes')
    const targetArg = fixture.toCwdRelativePath(targetAbsolute)

    migrate(sourceArg, targetArg, {
      force: true,
    })

    const routePath = path.join(targetAbsolute, 'dash', 'scribe', 'index.tsx')
    const contents = fs.readFileSync(routePath, 'utf8')
    expect(contents).toContain(
      "import { transcribe } from '~/routes/scribe/+_modules/transcription'",
    )
  })

  it('rewrites alias imports for parent routes promoted to _layout', () => {
    const fixture = createRoutesFixture({
      'app/routes/settings/profile.two-factor.tsx':
        'export function TwoFactorLayout() { return null }\n',
      'app/routes/settings/profile.two-factor.index.tsx':
        "import { TwoFactorLayout } from '#app/routes/settings/profile.two-factor.tsx'\nexport default function TwoFactorIndex() { return <TwoFactorLayout /> }\n",
    })

    const sourceArg = fixture.toCwdRelativePath(fixture.sourceDir)
    const targetAbsolute = fixture.resolve('app', 'new-routes')
    const targetArg = fixture.toCwdRelativePath(targetAbsolute)

    migrate(sourceArg, targetArg, {
      force: true,
    })

    const generatedFiles = fixture.listRelativeFiles(targetAbsolute)
    const indexFile = generatedFiles.find((file) =>
      /settings\/profile\.two-factor(\/|\.index\.tsx$)/.test(file),
    )
    expect(indexFile).toBeDefined()

    const routePath = path.join(targetAbsolute, indexFile!)
    const contents = fs.readFileSync(routePath, 'utf8')
    expect(contents).toContain(
      "import { TwoFactorLayout } from '#app/routes/settings/profile.two-factor/_layout.tsx'",
    )
  })

  it('treats dot notation index files as index routes', () => {
    const fixture = createRoutesFixture({
      'app/routes/settings+/profile.two-factor.tsx':
        'export default function TwoFactor() { return null }\n',
      'app/routes/settings+/profile.two-factor.index.tsx':
        'export default function TwoFactorIndex() { return null }\n',
    })

    const routes = createRoutesFromFolders(defineRoutes, {
      appDirectory: fixture.resolve('app'),
      routesDirectory: 'routes',
    })

    const parentRouteId = 'routes/settings+/profile.two-factor'
    const indexRouteId = 'routes/settings+/profile.two-factor.index'

    expect(routes[parentRouteId]).toBeDefined()
    expect(routes[indexRouteId]).toBeDefined()
    expect(routes[indexRouteId].index).toBe(true)
    expect(routes[indexRouteId].path).toBeUndefined()
    expect(routes[indexRouteId].parentId).toBe(parentRouteId)
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
})

describe('runCli', () => {
  it('migrates routes using default source and target and cleans up backup on success', () => {
    const fixture = createBasicRoutesFixture('run-cli-success')

    const snapshots = ['ROUTES\n', 'ROUTES\n']
    const runner: CommandRunner = () => {
      const stdout = snapshots.shift() ?? 'ROUTES\n'
      return { status: 0, stdout, stderr: '' }
    }

    const previousCwd = process.cwd()
    process.chdir(fixture.workspace)
    try {
      const exitCode = runCli([], { runner })
      expect(exitCode).toBe(0)
    } finally {
      process.chdir(previousCwd)
    }

    expect(consoleErrorSpy.mock.calls).toEqual([])

    const backupDir = path.join(fixture.workspace, 'app', 'old-routes')
    expect(fs.existsSync(backupDir)).toBe(false)
    expect(fs.existsSync(fixture.sourceDir)).toBe(true)
    expect(
      fs.existsSync(path.join(fixture.workspace, 'app', 'new-routes')),
    ).toBe(false)

    const migratedFiles = fixture.listRelativeFiles(fixture.sourceDir)
    expect(migratedFiles).toEqual([
      'admin/$id.tsx',
      'admin/dashboard.tsx',
      'admin/index.tsx',
      'index.tsx',
    ])

    const backupFiles = fixture.listRelativeFiles(backupDir)
    expect(backupFiles).toEqual([])
  })

  it('logs directory renames during successful swaps', () => {
    const fixture = createBasicRoutesFixture('run-cli-logs')

    const snapshots = ['ROUTES\n', 'ROUTES\n']
    const runner: CommandRunner = () => {
      const stdout = snapshots.shift() ?? 'ROUTES\n'
      return { status: 0, stdout, stderr: '' }
    }

    const previousCwd = process.cwd()
    process.chdir(fixture.workspace)
    try {
      const exitCode = runCli(['app/routes'], { runner })
      expect(exitCode).toBe(0)
    } finally {
      process.chdir(previousCwd)
    }

    const messages = consoleLogSpy.mock.calls
      .map(([message]) => message)
      .filter((message): message is string => typeof message === 'string')

    const backupIndex = messages.findIndex((message) =>
      message.includes("Backed up 'app/routes' to 'app/old-routes'"),
    )
    const promotedIndex = messages.findIndex((message) =>
      message.includes("Promoted 'app/new-routes' to 'app/routes'"),
    )

    expect(backupIndex).toBeGreaterThanOrEqual(0)
    expect(promotedIndex).toBeGreaterThan(backupIndex)
  })

  it('treats + suffix renames as equivalent in route snapshots', () => {
    const fixture = createRoutesFixture({
      'app/routes/root.tsx': 'export default function Root() { return null }\n',
      'app/routes/_auth+/_layout.tsx':
        'import { Outlet } from "react-router"\nexport default function Layout() { return <Outlet /> }\n',
      'app/routes/_auth+/login.tsx':
        'export default function Login() { return null }\n',
    })

    const snapshots = [
      `<Routes>\n  <Route file="root.tsx">\n    <Route file="routes/_auth+/_layout.tsx">\n      <Route path="login" file="routes/_auth+/login.tsx" />\n    </Route>\n  </Route>\n</Routes>\n`,
      `<Routes>\n  <Route file="root.tsx">\n    <Route file="routes/_auth/_layout.tsx">\n      <Route path="login" file="routes/_auth/login.tsx" />\n    </Route>\n  </Route>\n</Routes>\n`,
    ]

    let callCount = 0
    const runner: CommandRunner = () => {
      const stdout = snapshots[Math.min(callCount, snapshots.length - 1)]
      callCount += 1
      return { status: 0, stdout, stderr: '' }
    }

    const previousCwd = process.cwd()
    process.chdir(fixture.workspace)
    try {
      const beforeNormalized = normalizeSnapshot(snapshots[0])
      const afterNormalized = normalizeSnapshot(snapshots[1])
      if (beforeNormalized !== afterNormalized) {
        const diff = diffSnapshots(beforeNormalized, afterNormalized)
        throw new Error(`normalized snapshots differ:\n${diff}`)
      }

      const exitCode = runCli(['app/routes', 'app/new-routes'], { runner })
      if (exitCode !== 0) {
        const messages = consoleErrorSpy.mock.calls
          .map(([message]) => message)
          .filter((message): message is string => typeof message === 'string')
        throw new Error(
          `CLI failed with exit ${exitCode}:\n${messages.join('\n')}`,
        )
      }
    } finally {
      process.chdir(previousCwd)
    }

    expect(consoleErrorSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('Route output changed'),
    )

    const migratedFiles = fixture.listRelativeFiles(
      fixture.resolve('app', 'routes'),
    )
    expect(migratedFiles).toEqual([
      '_auth/_layout.tsx',
      '_auth/login.tsx',
      'root.tsx',
    ])

    const backupFiles = fixture.listRelativeFiles(
      fixture.resolve('app', 'old-routes'),
    )
    expect(backupFiles).toEqual([])
  })

  it('treats parent route -> _layout renames as equivalent in route snapshots', () => {
    const fixture = createRoutesFixture({
      'app/routes/root.tsx': 'export default function Root() { return null }\n',
    })

    const snapshots = [
      `<Routes>
  <Route file="root.tsx">
    <Route file="routes/settings/profile.tsx">
      <Route file="routes/settings/profile.index.tsx" index />
      <Route file="routes/settings/profile.two-factor.tsx" />
      <Route file="routes/settings/profile.two-factor.index.tsx" index />
    </Route>
  </Route>
</Routes>
`,
      `<Routes>
  <Route file="root.tsx">
    <Route file="routes/settings/profile/_layout.tsx">
      <Route file="routes/settings/profile/index.tsx" index />
      <Route file="routes/settings/profile.two-factor/_layout.tsx">
        <Route file="routes/settings/profile.two-factor/index.tsx" index />
      </Route>
    </Route>
  </Route>
</Routes>
`,
    ]

    let callCount = 0
    const runner: CommandRunner = () => {
      const stdout = snapshots[Math.min(callCount, snapshots.length - 1)]
      callCount += 1
      return { status: 0, stdout, stderr: '' }
    }

    const previousCwd = process.cwd()
    process.chdir(fixture.workspace)
    try {
      const beforeNormalized = normalizeSnapshot(snapshots[0])
      const afterNormalized = normalizeSnapshot(snapshots[1])
      if (beforeNormalized !== afterNormalized) {
        const diff = diffSnapshots(beforeNormalized, afterNormalized)
        throw new Error(`normalized snapshots differ:\n${diff}`)
      }

      const exitCode = runCli(['app/routes', 'app/new-routes'], { runner })
      if (exitCode !== 0) {
        const messages = consoleErrorSpy.mock.calls
          .map(([message]) => message)
          .filter((message): message is string => typeof message === 'string')
        throw new Error(
          `CLI failed with exit ${exitCode}:\n${messages.join('\n')}`,
        )
      }
    } finally {
      process.chdir(previousCwd)
    }

    const backupDir = fixture.resolve('app', 'old-routes')
    expect(fs.existsSync(backupDir)).toBe(false)
  })

  it('rewrites legacy remix-flat-routes entry to autoRoutes()', () => {
    const fixture = createBasicRoutesFixture('run-cli-legacy')
    const entryPath = fixture.resolve('app', 'routes.ts')
    fs.writeFileSync(
      entryPath,
      `import { createRoutesFromFolders } from 'remix-flat-routes'\nexport default function routes() {\n  return createRoutesFromFolders(() => {})\n}\n`,
    )
    fixture.git('add', 'app/routes.ts')
    fixture.git('commit', '-m', 'legacy entry')

    const runnerMock = vi.fn(() => ({
      status: 0,
      stdout: 'ROUTES\n',
      stderr: '',
    }))
    const runner = runnerMock as unknown as CommandRunner

    const previousCwd = process.cwd()
    process.chdir(fixture.workspace)
    try {
      const exitCode = runCli(['app/routes'], { runner })
      expect(exitCode).toBe(0)
    } finally {
      process.chdir(previousCwd)
    }

    expect(runnerMock).toHaveBeenCalledTimes(2)

    const backupDir = fixture.resolve('app', 'old-routes')
    expect(fs.existsSync(backupDir)).toBe(false)

    const updatedEntry = fs.readFileSync(entryPath, 'utf8')
    expect(updatedEntry).toBe(
      "import { autoRoutes } from 'react-router-auto-routes'\n" +
        "import { type RouteConfig } from '@react-router/dev/routes'\n\n" +
        'export default autoRoutes() satisfies RouteConfig\n',
    )

    const migratedFiles = fixture.listRelativeFiles(fixture.sourceDir)
    expect(migratedFiles).toEqual([
      'admin/$id.tsx',
      'admin/dashboard.tsx',
      'admin/index.tsx',
      'index.tsx',
    ])
  })

  it('treats trailing underscore folder with leading underscore file as dot notation rename', () => {
    const before = normalizeSnapshot(
      `<Routes>
  <Route file="root.tsx">
    <Route file="routes/users/$username_.note-editor.tsx" />
  </Route>
</Routes>
`,
    )

    const after = normalizeSnapshot(
      `<Routes>
  <Route file="root.tsx">
    <Route file="routes/users/$username_/_note-editor.tsx" />
  </Route>
</Routes>
`,
    )

    expect(before).toBe(after)
  })

  it('refuses to run when not inside a git repository', () => {
    const fixture = createBasicRoutesFixture('run-cli-no-git')
    fs.rmSync(path.join(fixture.workspace, '.git'), {
      recursive: true,
      force: true,
    })

    const previousCwd = process.cwd()
    process.chdir(fixture.workspace)
    let exitCode = -1
    try {
      exitCode = runCli(['app/routes'])
    } finally {
      process.chdir(previousCwd)
    }

    expect(exitCode).toBe(1)
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Git repository not detected'),
    )
  })

  it('refuses to run when git worktree is dirty', () => {
    const fixture = createBasicRoutesFixture('run-cli-dirty')
    fs.writeFileSync(fixture.resolve('app', 'routes', 'dirty.tmp'), 'dirty\n')

    const previousCwd = process.cwd()
    process.chdir(fixture.workspace)
    let exitCode = -1
    try {
      exitCode = runCli(['app/routes'])
    } finally {
      process.chdir(previousCwd)
    }

    expect(exitCode).toBe(1)
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Working tree must be clean for 'app/routes'"),
    )
  })

  it('allows dirty files outside the source directory', () => {
    const fixture = createBasicRoutesFixture('run-cli-dirty-outside')
    fs.writeFileSync(fixture.resolve('NOTES.md'), 'notes\n')

    const runner: CommandRunner = () => ({
      status: 0,
      stdout: 'ROUTES\n',
      stderr: '',
    })

    const previousCwd = process.cwd()
    process.chdir(fixture.workspace)
    try {
      const exitCode = runCli(['app/routes'], { runner })
      expect(exitCode).toBe(0)
    } finally {
      process.chdir(previousCwd)
    }
  })

  it('reverts when route generation differs', () => {
    const fixture = createBasicRoutesFixture('run-cli-diff')

    const snapshots = [
      `<Routes>\n  <Route file="routes/foo.tsx" />\n</Routes>\n`,
      `<Routes>\n  <Route file="routes/bar.tsx" />\n</Routes>\n`,
    ]
    const runner: CommandRunner = () => {
      const stdout = snapshots.shift() ?? ''
      return { status: 0, stdout, stderr: '' }
    }

    const previousCwd = process.cwd()
    process.chdir(fixture.workspace)
    let exitCode = -1
    try {
      exitCode = runCli(['app/routes'], { runner })
    } finally {
      process.chdir(previousCwd)
    }
    expect(exitCode).toBe(1)

    const backupDir = path.join(fixture.workspace, 'app', 'old-routes')
    expect(fs.existsSync(backupDir)).toBe(false)

    const newDir = path.join(fixture.workspace, 'app', 'new-routes')
    expect(fs.existsSync(newDir)).toBe(true)

    const restoredFiles = fixture.listRelativeFiles(fixture.sourceDir)
    expect(restoredFiles).toEqual([
      'admin/$id.tsx',
      'admin/dashboard.tsx',
      'admin/index.tsx',
      'index.tsx',
    ])

    const migratedFiles = fixture.listRelativeFiles(newDir)
    expect(migratedFiles).toEqual([
      'admin/$id.tsx',
      'admin/dashboard.tsx',
      'admin/index.tsx',
      'index.tsx',
    ])

    const diffCall = consoleErrorSpy.mock.calls.find(
      ([message]) =>
        typeof message === 'string' &&
        message.includes('--- react-router routes (before)'),
    )
    expect(diffCall).toBeDefined()
  })

  it('restores legacy route entry when route diff does not match', () => {
    const fixture = createBasicRoutesFixture('run-cli-diff-entry')
    const entryPath = fixture.resolve('app', 'routes.ts')
    const legacyEntry = `import { createRoutesFromFolders } from 'remix-flat-routes'\nexport default function routes() {\n  return createRoutesFromFolders(() => {})\n}\n`
    fs.writeFileSync(entryPath, legacyEntry)

    const snapshots = [
      `<Routes>\n  <Route file="routes/foo.tsx" />\n</Routes>\n`,
      `<Routes>\n  <Route file="routes/bar.tsx" />\n</Routes>\n`,
    ]

    const runner: CommandRunner = () => {
      const stdout = snapshots.shift() ?? ''
      return { status: 0, stdout, stderr: '' }
    }

    const previousCwd = process.cwd()
    process.chdir(fixture.workspace)
    let exitCode = -1
    try {
      exitCode = runCli(['app/routes'], { runner })
    } finally {
      process.chdir(previousCwd)
    }

    expect(exitCode).toBe(1)

    const entryContents = fs.readFileSync(entryPath, 'utf8')
    expect(entryContents).toBe(legacyEntry)
  })

  it('supports dry run mode without swapping directories', () => {
    const fixture = createBasicRoutesFixture('run-cli-dry-run')

    const runner: CommandRunner = () => ({
      status: 0,
      stdout: 'ROUTES\n',
      stderr: '',
    })

    const previousCwd = process.cwd()
    process.chdir(fixture.workspace)
    try {
      const exitCode = runCli([], { runner, dryRun: true })
      expect(exitCode).toBe(0)
    } finally {
      process.chdir(previousCwd)
    }

    const messages = consoleLogSpy.mock.calls
      .map(([message]) => message)
      .filter((message): message is string => typeof message === 'string')

    expect(
      messages.some((message) => message.includes('Dry run complete')),
    ).toBe(true)

    const backupDir = fixture.resolve('app', 'old-routes')
    expect(fs.existsSync(backupDir)).toBe(false)
    expect(fs.existsSync(fixture.sourceDir)).toBe(true)
    expect(fs.existsSync(fixture.resolve('app', 'new-routes'))).toBe(true)
  })
})
