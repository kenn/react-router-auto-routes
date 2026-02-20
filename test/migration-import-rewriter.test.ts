import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import {
  buildImportRewritePlan,
  executeImportRewritePlan,
  normalizeAbsolutePath,
  rewriteAndCopy,
  type ImportRewritePlan,
  type SpecifierReplacement,
} from '../src/migration/import-rewriter'

let workspace: string | undefined

afterEach(() => {
  if (workspace && fs.existsSync(workspace)) {
    fs.rmSync(workspace, { recursive: true, force: true })
  }
  workspace = undefined
})

describe('buildImportRewritePlan', () => {
  it('returns copy plans for non-transformable files', () => {
    workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'rewrite-plan-copy-'))

    const sourceFile = path.join(workspace, 'readme.css')
    const targetFile = path.join(workspace, 'out', 'readme.css')
    fs.mkdirSync(path.dirname(sourceFile), { recursive: true })
    fs.writeFileSync(sourceFile, '.demo { color: red; }\n')

    const plan = buildImportRewritePlan(
      { source: sourceFile, target: targetFile },
      new Map(),
      [],
    )

    expect(plan).toMatchObject<ImportRewritePlan>({
      mode: 'copy',
      sourcePath: normalizeAbsolutePath(sourceFile),
      targetPath: normalizeAbsolutePath(targetFile),
    })
  })

  it('captures rewrite contents for transformable files', () => {
    workspace = fs.mkdtempSync(
      path.join(os.tmpdir(), 'rewrite-plan-transform-'),
    )

    const sourceDir = path.join(workspace, 'app', 'routes')
    const targetDir = path.join(workspace, 'app', 'new-routes')
    const componentsDir = path.join(workspace, 'app', 'components')

    const sourceFile = path.join(sourceDir, 'admin.tsx')
    const targetFile = path.join(targetDir, 'admin', '_layout.tsx')
    const componentFile = path.join(componentsDir, 'AdminShell.tsx')

    fs.mkdirSync(path.dirname(sourceFile), { recursive: true })
    fs.mkdirSync(path.dirname(componentFile), { recursive: true })
    fs.writeFileSync(
      sourceFile,
      `
import { AdminShell } from '../components/AdminShell'

export default function Admin() {
  return <AdminShell />
}
`.trimStart(),
    )
    fs.writeFileSync(
      componentFile,
      `
export function AdminShell() {
  return null
}
`.trimStart(),
    )

    const normalizedMapping = new Map<string, string>([
      [normalizeAbsolutePath(sourceFile), normalizeAbsolutePath(targetFile)],
    ])

    const plan = buildImportRewritePlan(
      { source: sourceFile, target: targetFile },
      normalizedMapping,
      [],
    )

    expect(plan.mode).toBe('rewrite')
    if (plan.mode === 'rewrite') {
      expect(plan.changed).toBe(true)
      expect(plan.originalContents).toContain('../components/AdminShell')
      expect(plan.rewrittenContents).toContain('../../components/AdminShell')

      executeImportRewritePlan(plan)
      const rewritten = fs.readFileSync(targetFile, 'utf8')
      expect(rewritten).toBe(plan.rewrittenContents)
    }
  })
})

describe('rewriteAndCopy', () => {
  it('adjusts relative imports when route files move', () => {
    workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'rewrite-imports-'))

    const sourceDir = path.join(workspace, 'app', 'routes')
    const targetDir = path.join(workspace, 'app', 'new-routes')
    const componentsDir = path.join(workspace, 'app', 'components')

    const sourceFile = path.join(sourceDir, 'admin.tsx')
    const targetFile = path.join(targetDir, 'admin', '_layout.tsx')
    const componentFile = path.join(componentsDir, 'AdminShell.tsx')
    const localAsset = path.join(sourceDir, 'fixture.json')

    fs.mkdirSync(path.dirname(sourceFile), { recursive: true })
    fs.mkdirSync(path.dirname(componentFile), { recursive: true })
    fs.writeFileSync(
      sourceFile,
      `
import { AdminShell } from '../components/AdminShell'
import data from './fixture.json?raw'

export default function Admin() {
  return <AdminShell data={data} />
}
`.trimStart(),
    )
    fs.writeFileSync(
      componentFile,
      `
export function AdminShell() {
  return null
}
`.trimStart(),
    )
    fs.writeFileSync(localAsset, '{"demo":true}\n')

    const normalizedMapping = new Map<string, string>([
      [normalizeAbsolutePath(sourceFile), normalizeAbsolutePath(targetFile)],
    ])

    const specifierReplacements: SpecifierReplacement[] = []
    rewriteAndCopy(
      { source: sourceFile, target: targetFile },
      normalizedMapping,
      specifierReplacements,
    )

    const rewritten = fs.readFileSync(targetFile, 'utf8')
    expect(rewritten).toContain(`from '../../components/AdminShell'`)
    expect(rewritten).toContain(`from '../../routes/fixture.json?raw'`)
  })

  it('strips legacy + segments from import paths', () => {
    workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'rewrite-legacy-'))

    const sourceDir = path.join(workspace, 'app', 'routes+')
    const targetDir = path.join(workspace, 'app', 'routes')

    const sourceFile = path.join(sourceDir, 'admin.tsx')
    const targetFile = path.join(targetDir, 'admin', '_layout.tsx')

    fs.mkdirSync(path.dirname(sourceFile), { recursive: true })
    fs.writeFileSync(
      sourceFile,
      `import { validate } from '../utils+/auth+/index'

export default function Admin() {
  return null
}
`,
    )

    const normalizedMapping = new Map<string, string>([
      [normalizeAbsolutePath(sourceFile), normalizeAbsolutePath(targetFile)],
    ])

    const specifierReplacements: SpecifierReplacement[] = []
    rewriteAndCopy(
      { source: sourceFile, target: targetFile },
      normalizedMapping,
      specifierReplacements,
    )

    const rewritten = fs.readFileSync(targetFile, 'utf8')
    // Relative path changes: ../utils+ → ../../utils (moved deeper + parent up)
    // Legacy + stripped: utils+ → utils, auth+ → auth
    expect(rewritten).toContain(`from '../utils/auth/index'`)
  })

  it('rewrites +types/route specifier when route.tsx becomes a flat file', () => {
    workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'rewrite-types-route-'))

    const sourceDir = path.join(workspace, 'app', 'routes')
    const targetDir = path.join(workspace, 'app', 'new-routes')

    // route.tsx → about.tsx: ./+types/route should become ./+types/about
    const sourceFile = path.join(sourceDir, 'demo+', 'about', 'route.tsx')
    const targetFile = path.join(targetDir, 'demo', 'about.tsx')

    fs.mkdirSync(path.dirname(sourceFile), { recursive: true })
    fs.writeFileSync(
      sourceFile,
      `import type { Route } from './+types/route'

export function loader({ params }: Route.LoaderArgs) {
  return { title: 'About' }
}

export default function About({ loaderData }: Route.ComponentProps) {
  return <h1>{loaderData.title}</h1>
}
`,
    )

    const normalizedMapping = new Map<string, string>([
      [normalizeAbsolutePath(sourceFile), normalizeAbsolutePath(targetFile)],
    ])

    const specifierReplacements: SpecifierReplacement[] = []
    rewriteAndCopy(
      { source: sourceFile, target: targetFile },
      normalizedMapping,
      specifierReplacements,
    )

    const rewritten = fs.readFileSync(targetFile, 'utf8')
    expect(rewritten).toContain("from './+types/about'")
    expect(rewritten).not.toContain("from './+types/route'")
  })

  it('strips /index.ts extension from import specifiers', () => {
    workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'rewrite-strip-ts-ext-'))

    const sourceDir = path.join(workspace, 'app', 'routes')
    const targetDir = path.join(workspace, 'app', 'new-routes')

    const sourceFile = path.join(sourceDir, 'demo+', 'example', 'route.tsx')
    const targetFile = path.join(targetDir, 'demo', 'example.tsx')

    const componentsDir = path.join(sourceDir, 'demo+', 'example', 'components')
    fs.mkdirSync(componentsDir, { recursive: true })
    fs.writeFileSync(
      path.join(componentsDir, 'index.ts'),
      'export { Header } from "./header"\n',
    )
    fs.writeFileSync(
      path.join(componentsDir, 'header.tsx'),
      'export function Header() { return null }\n',
    )

    // Colocated components move to +components/
    const targetComponentsDir = path.join(
      targetDir,
      'demo',
      '+example',
      'components',
    )
    fs.mkdirSync(targetComponentsDir, { recursive: true })
    fs.writeFileSync(
      path.join(targetComponentsDir, 'index.ts'),
      'export { Header } from "./header"\n',
    )
    fs.writeFileSync(
      path.join(targetComponentsDir, 'header.tsx'),
      'export function Header() { return null }\n',
    )

    fs.mkdirSync(path.dirname(sourceFile), { recursive: true })
    fs.writeFileSync(
      sourceFile,
      `import { Header } from './components/index.ts'

export default function Example() {
  return <Header />
}
`,
    )

    const normalizedMapping = new Map<string, string>([
      [normalizeAbsolutePath(sourceFile), normalizeAbsolutePath(targetFile)],
    ])

    const specifierReplacements: SpecifierReplacement[] = []
    rewriteAndCopy(
      { source: sourceFile, target: targetFile },
      normalizedMapping,
      specifierReplacements,
    )

    const rewritten = fs.readFileSync(targetFile, 'utf8')
    // /index.ts should be stripped
    expect(rewritten).not.toContain('/index.ts')
  })

  it('rewrites aliased imports for parent routes promoted to _layout', () => {
    workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'rewrite-alias-'))

    const sourceDir = path.join(workspace, 'app', 'routes')
    const targetDir = path.join(workspace, 'app', 'new-routes')

    const sourceFile = path.join(
      sourceDir,
      'settings',
      'profile.two-factor.index.tsx',
    )
    const targetFile = path.join(
      targetDir,
      'settings',
      'profile.two-factor.index.tsx',
    )
    const parentSource = path.join(
      sourceDir,
      'settings',
      'profile.two-factor.tsx',
    )
    const parentTarget = path.join(
      targetDir,
      'settings',
      'profile.two-factor',
      '_layout.tsx',
    )

    fs.mkdirSync(path.dirname(sourceFile), { recursive: true })
    fs.writeFileSync(
      sourceFile,
      `import { TwoFactorLayout } from '#app/routes/settings/profile.two-factor.tsx'\nexport default function TwoFactorIndex() {\n  return <TwoFactorLayout />\n}\n`,
    )
    fs.writeFileSync(
      parentSource,
      'export default function Layout() { return null }\n',
    )

    const normalizedMapping = new Map<string, string>([
      [normalizeAbsolutePath(sourceFile), normalizeAbsolutePath(targetFile)],
      [
        normalizeAbsolutePath(parentSource),
        normalizeAbsolutePath(parentTarget),
      ],
    ])
    const specifierReplacements: SpecifierReplacement[] = [
      {
        from: 'app/routes/settings/profile.two-factor.tsx',
        to: 'app/routes/settings/profile.two-factor/_layout.tsx',
      },
      {
        from: 'routes/settings/profile.two-factor.tsx',
        to: 'routes/settings/profile.two-factor/_layout.tsx',
      },
      {
        from: 'settings/profile.two-factor.tsx',
        to: 'settings/profile.two-factor/_layout.tsx',
      },
    ]

    rewriteAndCopy(
      { source: sourceFile, target: targetFile },
      normalizedMapping,
      specifierReplacements,
    )

    const rewritten = fs.readFileSync(targetFile, 'utf8')
    expect(rewritten).toContain(
      "import { TwoFactorLayout } from '#app/routes/settings/profile.two-factor/_layout.tsx'",
    )
  })
})
