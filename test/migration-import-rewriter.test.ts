import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import {
  normalizeAbsolutePath,
  rewriteAndCopy,
} from '../src/migration/import-rewriter'

let workspace: string | undefined

afterEach(() => {
  if (workspace && fs.existsSync(workspace)) {
    fs.rmSync(workspace, { recursive: true, force: true })
  }
  workspace = undefined
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

    rewriteAndCopy({ source: sourceFile, target: targetFile }, normalizedMapping)

    const rewritten = fs.readFileSync(targetFile, 'utf8')
    expect(rewritten).toContain(
      `from '../../components/AdminShell'`,
    )
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

    rewriteAndCopy({ source: sourceFile, target: targetFile }, normalizedMapping)

    const rewritten = fs.readFileSync(targetFile, 'utf8')
    // Relative path changes: ../utils+ → ../../utils (moved deeper + parent up)
    // Legacy + stripped: utils+ → utils, auth+ → auth
    expect(rewritten).toContain(`from '../utils/auth/index'`)
  })
})
