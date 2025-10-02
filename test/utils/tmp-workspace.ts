import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export type FileMap = Record<string, string>

const activeWorkspaces = new Set<string>()

export interface RoutesFixture {
  workspace: string
  sourceDir: string
  resolve: (...segments: string[]) => string
  toCwdRelativePath: (absolutePath: string) => string
  listRelativeFiles: (absoluteRoot: string) => string[]
}

export function createTmpWorkspace(prefix = 'flat-routes'): string {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), `${prefix}-`))
  activeWorkspaces.add(workspace)
  return workspace
}

export function cleanupTmpWorkspaces(): void {
  for (const workspace of activeWorkspaces) {
    if (fs.existsSync(workspace)) {
      fs.rmSync(workspace, { recursive: true, force: true })
    }
    activeWorkspaces.delete(workspace)
  }
}

export function writeFiles(root: string, files: FileMap): void {
  Object.entries(files).forEach(([relativePath, contents]) => {
    const filePath = path.join(root, relativePath)
    fs.mkdirSync(path.dirname(filePath), { recursive: true })
    fs.writeFileSync(filePath, contents)
  })
}

export function listRelativeFiles(root: string): string[] {
  const files: string[] = []

  const walk = (current: string) => {
    const entries = fs.readdirSync(current, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name)
      if (entry.isDirectory()) {
        walk(fullPath)
      } else {
        files.push(path.relative(root, fullPath))
      }
    }
  }

  if (fs.existsSync(root)) {
    walk(root)
  }

  return files.sort()
}

export function toCwdRelativePath(absolutePath: string): string {
  const relative = path.relative(process.cwd(), absolutePath)
  return relative === '' ? '.' : relative
}

export function createRoutesFixture(
  files: FileMap,
  prefix = 'flat-routes-fixture',
): RoutesFixture {
  const workspace = createTmpWorkspace(prefix)
  writeFiles(workspace, files)

  const resolve = (...segments: string[]) => path.join(workspace, ...segments)
  const sourceDir = resolve('app', 'routes')

  return {
    workspace,
    sourceDir,
    resolve,
    toCwdRelativePath,
    listRelativeFiles,
  }
}

export function createBasicRoutesFixture(
  prefix = 'migrate-cli',
): RoutesFixture {
  return createRoutesFixture(
    {
      'app/routes/index.tsx':
        'export default function Index() { return null }\n',
      'app/routes/admin/index.tsx':
        'export default function AdminIndex() { return null }\n',
      'app/routes/admin/dashboard.tsx':
        'export default function Dashboard() { return null }\n',
      'app/routes/admin/$id.tsx':
        'export default function AdminId() { return null }\n',
    },
    prefix,
  )
}
