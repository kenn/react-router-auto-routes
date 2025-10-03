import fs from 'node:fs'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { migrate } from '../src/migration/migrate'
import { runCli, type CommandRunner } from '../src/migration/cli/run-cli'

let consoleErrorSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {})
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
})

describe('runCli', () => {
  it('migrates routes using default target and keeps a backup on success', () => {
    const fixture = createBasicRoutesFixture('run-cli-success')

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

    expect(consoleErrorSpy.mock.calls).toEqual([])

    const backupDir = path.join(fixture.workspace, 'app', 'old-routes')
    expect(fs.existsSync(backupDir)).toBe(true)
    expect(fs.existsSync(fixture.sourceDir)).toBe(true)
    expect(fs.existsSync(path.join(fixture.workspace, 'app', 'new-routes'))).toBe(
      false,
    )

    const migratedFiles = fixture.listRelativeFiles(fixture.sourceDir)
    expect(migratedFiles).toEqual([
      'admin/$id.tsx',
      'admin/dashboard.tsx',
      'admin/index.tsx',
      'index.tsx',
    ])

    const backupFiles = fixture.listRelativeFiles(backupDir)
    expect(backupFiles).toEqual([
      'admin/$id.tsx',
      'admin/dashboard.tsx',
      'admin/index.tsx',
      'index.tsx',
    ])
  })

  it('reverts when route generation differs', () => {
    const fixture = createBasicRoutesFixture('run-cli-diff')

    const snapshots = ['OLD ROUTES\n', 'NEW ROUTES\n']
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

    const diffCall = consoleErrorSpy.mock.calls.find(([message]) =>
      typeof message === 'string' && message.includes('--- react-router routes (before)'),
    )
    expect(diffCall).toBeDefined()
  })
})
