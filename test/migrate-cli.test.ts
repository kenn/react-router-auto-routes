import path from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { migrate } from '../src/migration/migrate'

import {
  cleanupTmpWorkspaces,
  createBasicRoutesFixture,
  createRoutesFixture,
} from './utils/tmp-workspace'

afterEach(() => {
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
      '_index.tsx',
      'admin+/$id.tsx',
      'admin+/_index.tsx',
      'admin+/dashboard.tsx',
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
      '_index.tsx',
      'about.tsx',
      'admin+/[_]index.tsx',
      'admin+/[_]layout.tsx',
      'admin+/dashboard.tsx',
      'admin+/users.$id.tsx',
      'admin+/users.[_]index.tsx',
      'blog+/$slug.tsx',
      'blog+/[_]index.tsx',
      'marketing+/[_]index.tsx',
      'marketing+/[_]layout.tsx',
      'marketing+/pricing.tsx',
    ])
  })
})
