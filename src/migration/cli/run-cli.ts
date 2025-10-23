import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

import {
  defaultTargetDir,
  pathRelative,
  revertRoutes,
  swapRoutes,
} from '../fs-helpers'
import { logError, logInfo, logWarn } from '../logger'
import { migrate, type MigrateOptions } from '../migrate'
import { diffSnapshots, normalizeSnapshot } from './diff'
import type { RewriteLegacyRouteEntryResult } from './route-entry'
import { detectLegacyRouteEntry, rewriteLegacyRouteEntry } from './route-entry'
import {
  captureRoutesSnapshot,
  defaultRunner,
  type CommandRunner,
} from './runner'

export type RunOptions = {
  runner?: CommandRunner
  dryRun?: boolean
}

export type { CommandRunner }

const defaultSourceDir = 'app/routes'

type CliArguments = { sourceDir: string; targetDir: string }

type MigrationPaths = {
  sourceArg: string
  targetArg: string
  resolvedSource: string
  resolvedTarget: string
  resolvedBackup: string
  parentDir: string
}

type MigrationContext = MigrationPaths & {
  runner: CommandRunner
  migrateOptions: MigrateOptions
  dryRun: boolean
}

function resolveCliArguments(argv: string[]): CliArguments | null {
  if (argv.length > 2) {
    return null
  }

  const sourceDir = argv[0] ?? defaultSourceDir
  const targetDir = argv[1] ?? defaultTargetDir(sourceDir)
  return { sourceDir, targetDir }
}

function buildMigrationPaths(args: CliArguments): MigrationPaths {
  const resolvedSource = path.resolve(args.sourceDir)
  const resolvedTarget = path.resolve(args.targetDir)
  const parentDir = path.dirname(resolvedSource)
  const resolvedBackup = path.join(parentDir, 'old-routes')

  return {
    sourceArg: args.sourceDir,
    targetArg: args.targetDir,
    resolvedSource,
    resolvedTarget,
    resolvedBackup,
    parentDir,
  }
}

function validateMigrationPaths(paths: MigrationPaths): boolean {
  const {
    sourceArg,
    targetArg,
    resolvedSource,
    resolvedTarget,
    resolvedBackup,
  } = paths
  const checks: Array<[boolean, () => string]> = [
    [
      sourceArg === targetArg,
      () => 'source and target directories must be different',
    ],
    [
      !fs.existsSync(sourceArg),
      () => `source directory '${sourceArg}' does not exist`,
    ],
    [
      resolvedSource === resolvedBackup,
      () => 'source directory cannot be named old-routes',
    ],
    [
      resolvedTarget === resolvedBackup,
      () => 'target directory cannot be the backup directory old-routes',
    ],
    [
      fs.existsSync(resolvedBackup),
      () =>
        `backup directory '${pathRelative(process.cwd(), resolvedBackup)}' already exists. ` +
        'Remove or rename it before running the migration.',
    ],
  ]

  for (const [condition, message] of checks) {
    if (condition) {
      logError(message())
      return false
    }
  }

  return true
}

export function runCli(argv: string[], options: RunOptions = {}): number {
  const args = resolveCliArguments(argv)
  if (!args) {
    usage()
    return 1
  }

  const paths = buildMigrationPaths(args)
  if (!validateMigrationPaths(paths)) {
    return 1
  }

  const runner = options.runner ?? defaultRunner
  const optionsForMigrate: MigrateOptions = { force: true }
  const context: MigrationContext = {
    ...paths,
    runner,
    migrateOptions: optionsForMigrate,
    dryRun: options.dryRun ?? false,
  }

  if (!ensureCleanGitWorktree(context.resolvedSource)) {
    return 1
  }

  return runMigrationWorkflow(context)
}

function runMigrationWorkflow(context: MigrationContext): number {
  const {
    sourceArg,
    targetArg,
    resolvedSource,
    resolvedTarget,
    resolvedBackup,
    runner,
    migrateOptions,
    dryRun,
  } = context

  const { entryPath, isLegacy } = detectLegacyRouteEntry(resolvedSource)
  let entryRewrite: RewriteLegacyRouteEntryResult | null = null
  const beforeSnapshot = captureRoutesSnapshot(runner, 'before migration')
  if (beforeSnapshot === null) {
    return 1
  }

  try {
    if (fs.existsSync(resolvedTarget)) {
      fs.rmSync(resolvedTarget, { recursive: true, force: true })
    }
    migrate(sourceArg, targetArg, migrateOptions)
  } catch (error) {
    logError(error)
    return 1
  }

  if (dryRun) {
    logInfo(
      `🧪 Dry run complete. Review generated routes in '${pathRelative(process.cwd(), resolvedTarget)}'.`,
    )
    return 0
  }

  let swapped = false

  try {
    swapRoutes(resolvedSource, resolvedTarget, resolvedBackup)
    swapped = true

    if (isLegacy && entryPath) {
      const rewriteResult = rewriteLegacyRouteEntry(entryPath)
      entryRewrite = rewriteResult.updated ? rewriteResult : null

      const entryRelative = pathRelative(process.cwd(), entryPath)
      logInfo(
        rewriteResult.updated
          ? `✏️ Updated route entry '${entryRelative}' to use autoRoutes().`
          : `✏️ Route entry '${entryRelative}' already references autoRoutes().`,
      )
    }

    const afterSnapshot = captureRoutesSnapshot(runner, 'after migration')
    if (afterSnapshot === null) {
      entryRewrite = restoreLegacyEntry(entryPath, entryRewrite)
      revertMigration(context, swapped)
      return 1
    }

    const beforeNormalized = normalizeSnapshot(beforeSnapshot)
    const afterNormalized = normalizeSnapshot(afterSnapshot)

    if (beforeNormalized === afterNormalized) {
      finalizeSuccessfulMigration(resolvedBackup)
      return 0
    }

    logError('❌ Route output changed. Reverting migration.')
    logError(diffSnapshots(beforeNormalized, afterNormalized))
    entryRewrite = restoreLegacyEntry(entryPath, entryRewrite)
    revertMigration(context, swapped)
    return 1
  } catch (error) {
    entryRewrite = restoreLegacyEntry(entryPath, entryRewrite)
    revertMigration(context, swapped)
    logError(error)
    return 1
  }
}

function restoreLegacyEntry(
  entryPath: string | null,
  rewrite: RewriteLegacyRouteEntryResult | null,
): RewriteLegacyRouteEntryResult | null {
  if (
    !rewrite?.updated ||
    !entryPath ||
    typeof rewrite.previousContents !== 'string'
  ) {
    return null
  }

  try {
    fs.writeFileSync(entryPath, rewrite.previousContents)
  } catch (restoreError) {
    const entryRelative = pathRelative(process.cwd(), entryPath)
    logWarn(
      `⚠️ Failed to restore route entry '${entryRelative}'. Restore it manually if needed.`,
    )
    logWarn(String(restoreError))
  }

  return null
}

function revertMigration(context: MigrationContext, swapped: boolean): void {
  if (swapped) {
    revertRoutes(
      context.resolvedSource,
      context.resolvedTarget,
      context.resolvedBackup,
    )
    return
  }

  if (fs.existsSync(context.resolvedTarget)) {
    fs.rmSync(context.resolvedTarget, { recursive: true, force: true })
  }
}

function finalizeSuccessfulMigration(resolvedBackup: string): void {
  logInfo('✅ Routes match between runs. Migration looks good!')
  if (!fs.existsSync(resolvedBackup)) {
    return
  }

  fs.rmSync(resolvedBackup, { recursive: true, force: true })
  logInfo(
    `🧹 Removed temporary backup '${pathRelative(process.cwd(), resolvedBackup)}'. ` +
      'Use git history if you need the previous structure.',
  )
}

function ensureCleanGitWorktree(resolvedSource: string): boolean {
  const repoCheck = spawnSync('git', ['rev-parse', '--is-inside-work-tree'], {
    cwd: process.cwd(),
    encoding: 'utf8',
  })

  if (repoCheck.status !== 0 || repoCheck.stdout.trim() !== 'true') {
    logError(
      'Git repository not detected. Initialize git (or run inside a repository) before using migrate-auto-routes.',
    )
    return false
  }

  const topLevelResult = spawnSync('git', ['rev-parse', '--show-toplevel'], {
    cwd: process.cwd(),
    encoding: 'utf8',
  })

  if (topLevelResult.status !== 0) {
    logError(
      'Unable to determine git repository root. Ensure git is installed and accessible.',
    )
    return false
  }

  const repoRoot = topLevelResult.stdout.trim()
  const sourceRelative = path.relative(repoRoot, resolvedSource)

  if (sourceRelative.startsWith('..')) {
    logError('Source directory must be inside the git repository.')
    return false
  }

  const status = spawnSync('git', ['status', '--porcelain'], {
    cwd: process.cwd(),
    encoding: 'utf8',
  })

  if (status.status !== 0) {
    logError(
      'Unable to read git status. Ensure git is installed and accessible.',
    )
    return false
  }

  const dirtyEntries = status.stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => isWithinSources(line, sourceRelative))

  if (dirtyEntries.length > 0) {
    logError(
      `Working tree must be clean for '${sourceRelative}'. Commit or stash changes affecting this directory and rerun.`,
    )
    return false
  }

  return true
}

function isWithinSources(statusLine: string, sourceRelative: string): boolean {
  if (!sourceRelative || sourceRelative === '.') {
    return statusLine.length > 0
  }

  const indicator = statusLine.slice(0, 3)
  let remainder = statusLine.slice(3)

  if (indicator.startsWith('R')) {
    const parts = remainder.split(' -> ')
    return parts.some((part) => matchesSource(part, sourceRelative))
  }

  return matchesSource(remainder, sourceRelative)
}

function matchesSource(pathname: string, sourceRelative: string): boolean {
  const normalized = pathname.replace(/"/g, '').trim()
  if (normalized === sourceRelative) {
    return true
  }
  return normalized.startsWith(`${sourceRelative}/`)
}

function usage(): void {
  logInfo(
    'Usage: migrate-auto-routes [sourceDir] [targetDir]\n\n' +
      'The CLI overwrites the target directory if it exists.\n\n' +
      'The CLI rewrites routes using the folder + colocation convention promoted by\n' +
      'react-router-auto-routes.\n\n' +
      'When sourceDir is omitted, it defaults to "app/routes".\n' +
      'When targetDir is omitted, it defaults to a sibling named "new-routes".',
  )
}
