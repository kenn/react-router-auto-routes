#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const WORKSPACE_ROOT = path.resolve(ROOT, 'tmp/manual-migrate')
const SOURCE_RELATIVE = 'app/routes'
const TARGET_RELATIVE = 'app/new-routes'
const SOURCE_DIR = workspacePath(SOURCE_RELATIVE)

const ROUTE_FILES = {
  'app/routes/index.tsx':
    'export default function Index() {\n  return <h1>Home</h1>\n}\n',
  'app/routes/about.tsx':
    'export default function About() {\n  return <h1>About</h1>\n}\n',
  'app/routes/admin/_layout.tsx':
    'import { Outlet } from "react-router"\n\nexport default function AdminLayout() {\n  return (\n    <div>\n      <h1>Admin</h1>\n      <Outlet />\n    </div>\n  )\n}\n',
  'app/routes/admin/_index.tsx':
    'export default function AdminIndex() {\n  return <p>Select a section</p>\n}\n',
  'app/routes/admin/users._index.tsx':
    'export default function UsersIndex() {\n  return <p>Users index</p>\n}\n',
  'app/routes/admin/users.$id.tsx':
    'export default function UserDetail() {\n  return <p>User detail</p>\n}\n',
  'app/routes/blog/_index.tsx':
    'export default function BlogIndex() {\n  return <h2>Blog</h2>\n}\n',
  'app/routes/blog/$slug.tsx':
    'export default function BlogPost() {\n  return <p>Blog post</p>\n}\n',
  'app/routes/marketing/_layout.tsx':
    'import { Outlet } from "react-router"\n\nexport default function MarketingLayout() {\n  return (\n    <section>\n      <h1>Marketing</h1>\n      <Outlet />\n    </section>\n  )\n}\n',
  'app/routes/marketing/_index.tsx':
    'export default function MarketingIndex() {\n  return <p>Welcome</p>\n}\n',
  'app/routes/marketing/pricing.tsx':
    'export default function Pricing() {\n  return <p>Pricing</p>\n}\n',
}

const TARGET_DIR = workspacePath(TARGET_RELATIVE)

const toWorkspaceRelative = (absolutePath) => {
  const relative = path.relative(ROOT, absolutePath)
  return relative === '' ? '.' : relative
}

function workspacePath(...segments) {
  return path.resolve(WORKSPACE_ROOT, ...segments)
}

main()

function main() {
  const command = process.argv[2] || 'prepare'

  if (command === 'clean') {
    cleanWorkspace()
    return
  }

  if (command === 'prepare') {
    prepareWorkspace()
    return
  }

  console.error(`Unknown command: ${command}`)
  process.exit(1)
}

function prepareWorkspace() {
  ensureDistBuilt()
  createRoutes()
  runMigrations()
  printSummary()
}

function ensureDistBuilt() {
  const cliPath = path.join(ROOT, 'dist', 'cli.cjs')
  if (!fs.existsSync(cliPath)) {
    console.log('⚙️  Building project so CLI is available...')
    const build = spawnSync('npm', ['run', 'build'], { stdio: 'inherit' })
    if (build.status !== 0) {
      console.error('Build failed; cannot continue.')
      process.exit(build.status ?? 1)
    }
  }
}

function createRoutes() {
  console.log('📁 Creating sample route files...')
  Object.entries(ROUTE_FILES).forEach(([relativePath, contents]) => {
    const filePath = workspacePath(relativePath)
    fs.mkdirSync(path.dirname(filePath), { recursive: true })
    fs.writeFileSync(filePath, contents, 'utf8')
  })
}

function runMigrations() {
  console.log('🚚 Running migration CLI...')
  const cli = path.join(ROOT, 'dist', 'cli.cjs')

  const args = [
    toWorkspaceRelative(SOURCE_DIR),
    toWorkspaceRelative(TARGET_DIR),
    '--force',
  ]
  console.log(`  • output: ${TARGET_DIR}`)
  const result = spawnSync('node', [cli, ...args], { stdio: 'inherit' })
  if (result.status !== 0) {
    console.error('Migration failed')
    process.exit(result.status ?? 1)
  }
}

function printSummary() {
  console.log('\n✅ Sample workspace ready for inspection:')
  console.log(`   Source routes: ${SOURCE_DIR}`)
  console.log(`   Output        → ${TARGET_DIR}`)
  console.log(
    '\nRun `npm run migrate:sample:clean` to remove the workspace when finished.',
  )
}

function cleanWorkspace() {
  if (fs.existsSync(WORKSPACE_ROOT)) {
    console.log(`🧹 Removing ${WORKSPACE_ROOT}`)
    fs.rmSync(WORKSPACE_ROOT, { recursive: true, force: true })
  } else {
    console.log('Nothing to clean; workspace not found.')
  }
}
