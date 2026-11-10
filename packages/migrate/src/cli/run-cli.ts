import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { toPosixPath } from '../../../../src/utils'
import {
  defaultTargetDir,
  pathRelative,
  revertRoutes,
  swapRoutes,
} from '../fs-helpers'
import { logError, logInfo, logWarn } from '../logger'
import { migrate } from '../migrate'
import { diffSnapshots, findAmbiguousParents, normalizeSnapshot } from './diff'
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

type CliParseResult =
  | { mode: 'run'; arguments: CliArguments }
  | { mode: 'help' }
  | { mode: 'error'; message: string }

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
  dryRun: boolean
}

function resolveCliArguments(argv: string[]): CliParseResult {
  if (argv.includes('--help') || argv.includes('-h')) {
    return { mode: 'help' }
  }

  const unknownFlag = argv.find((argument) => argument.startsWith('-'))
  if (unknownFlag) {
    return { mode: 'error', message: `Unknown option '${unknownFlag}'.` }
  }

  if (argv.length > 2) {
    return { mode: 'error', message: 'Too many arguments.' }
  }

  const sourceDir = argv[0] ?? defaultSourceDir
  const targetDir = argv[1] ?? defaultTargetDir(sourceDir)
  return { mode: 'run', arguments: { sourceDir, targetDir } }
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
  const { sourceArg, resolvedSource, resolvedTarget, resolvedBackup } = paths

  if (!fs.existsSync(resolvedSource)) {
    logError(`source directory '${sourceArg}' does not exist`)
    return false
  }

  // The target is removed recursively before migrating; a file there (e.g.
  // `app/routes.ts`) would be lost.
  if (!fs.statSync(resolvedSource).isDirectory()) {
    logError(`source '${sourceArg}' is not a directory`)
    return false
  }
  const targetStats = fs.statSync(resolvedTarget, { throwIfNoEntry: false })
  if (targetStats && !targetStats.isDirectory()) {
    logError(`target '${paths.targetArg}' is not a directory`)
    return false
  }

  // The target is deleted and the source/backup are renamed, so none of them
  // may overlap — neither as spelled (the entries being moved) nor on disk
  // (symlinks, case-insensitive names).
  const targetVsSource =
    overlap(resolvedTarget, resolvedSource) ??
    (sourceTraversesTarget(resolvedSource, resolvedTarget) ? 'contains' : null)
  const messages: Record<Overlap, string> = {
    same: 'source and target directories must be different',
    inside: 'target directory cannot be inside the source directory',
    contains: 'source directory cannot be inside the target directory',
  }

  const checks: Array<[boolean, () => string]> = [
    [targetVsSource !== null, () => messages[targetVsSource!]],
    [
      overlap(resolvedSource, resolvedBackup) !== null,
      () => 'source directory cannot overlap the backup directory old-routes',
    ],
    [
      // The backup name is reserved regardless of case.
      overlap(resolvedTarget, resolvedBackup, { ignoreCase: true }) !== null,
      () => 'target directory cannot overlap the backup directory old-routes',
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

/** How `a` relates to `b`: the same entry, inside it, or containing it. */
type Overlap = 'same' | 'inside' | 'contains'

function overlap(
  a: string,
  b: string,
  { ignoreCase = false } = {},
): Overlap | null {
  return (
    lexicalOverlap(a, b, ignoreCase) ??
    lexicalOverlap(realPathOf(a), realPathOf(b), ignoreCase)
  )
}

function lexicalOverlap(
  a: string,
  b: string,
  ignoreCase: boolean,
): Overlap | null {
  const left = ignoreCase ? a.toLowerCase() : a
  const right = ignoreCase ? b.toLowerCase() : b
  if (path.relative(right, left) === '') {
    return 'same'
  }
  if (isDescendant(path.relative(right, left))) {
    return 'inside'
  }
  return isDescendant(path.relative(left, right)) ? 'contains' : null
}

function isDescendant(relative: string): boolean {
  return relative.split(path.sep)[0] !== '..' && !path.isAbsolute(relative)
}

/** Would removing the target entry break the path used to reach the source? */
function sourceTraversesTarget(source: string, target: string): boolean {
  const removed = fs.lstatSync(target, { bigint: true, throwIfNoEntry: false })
  if (!removed) return false

  const pending = segmentsBelowRoot(source)
  let current = path.parse(source).root
  let hops = 0
  while (pending.length > 0) {
    const entry = path.join(current, pending.shift()!)
    const stat = fs.lstatSync(entry, { bigint: true })
    if (stat.dev === removed.dev && stat.ino === removed.ino) return true

    if (!stat.isSymbolicLink()) {
      current = entry
      continue
    }

    // Fail closed if a changing link chain cannot be fully checked.
    if (++hops > 64) return true
    const link = fs.readlinkSync(entry)
    const root = path.parse(link).root
    if (root) current = path.resolve(current, root)
    // Keep '..' until every preceding component (including links) was visited.
    pending.unshift(...segmentsBelowRoot(link))
  }
  return false
}

function segmentsBelowRoot(target: string): string[] {
  const tail = target.slice(path.parse(target).root.length)
  return tail.split(path.sep === '/' ? '/' : /[\\/]/).filter(Boolean)
}

/**
 * Resolves symlinks (and, via the native call, on-disk casing) in the longest
 * existing prefix of `target`.
 */
function realPathOf(target: string): string {
  const missing: string[] = []
  let current = target
  while (!fs.existsSync(current)) {
    const parent = path.dirname(current)
    if (parent === current) {
      break
    }
    missing.unshift(path.basename(current))
    current = parent
  }
  return path.join(fs.realpathSync.native(current), ...missing)
}

export function runCli(argv: string[], options: RunOptions = {}): number {
  const parsed = resolveCliArguments(argv)
  if (parsed.mode === 'help') {
    usage()
    return 0
  }

  if (parsed.mode === 'error') {
    logError(parsed.message)
    usage()
    return 1
  }

  const paths = buildMigrationPaths(parsed.arguments)
  if (!validateMigrationPaths(paths)) {
    return 1
  }

  if (!ensureCleanGitWorktree(paths.resolvedSource)) {
    return 1
  }

  return runMigrationWorkflow({
    ...paths,
    runner: options.runner ?? defaultRunner,
    dryRun: options.dryRun ?? false,
  })
}

function runMigrationWorkflow(context: MigrationContext): number {
  const {
    sourceArg,
    targetArg,
    resolvedSource,
    resolvedTarget,
    resolvedBackup,
    runner,
    dryRun,
  } = context

  const { entryPath, isLegacy } = detectLegacyRouteEntry(resolvedSource)
  let entryRewrite: RewriteLegacyRouteEntryResult | null = null
  const beforeSnapshot = captureRoutesSnapshot(runner, 'before migration')
  if (beforeSnapshot === null || !hasUnambiguousParents(beforeSnapshot)) {
    return 1
  }

  try {
    if (fs.existsSync(resolvedTarget)) {
      fs.rmSync(resolvedTarget, { recursive: true, force: true })
    }
    migrate(sourceArg, targetArg)
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
      restoreLegacyEntry(entryPath, entryRewrite)
      revertMigration(context, swapped)
      return 1
    }

    if (!hasUnambiguousParents(afterSnapshot)) {
      logError('❌ Cannot verify the migrated routes. Reverting migration.')
      restoreLegacyEntry(entryPath, entryRewrite)
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
    restoreLegacyEntry(entryPath, entryRewrite)
    revertMigration(context, swapped)
    return 1
  } catch (error) {
    restoreLegacyEntry(entryPath, entryRewrite)
    revertMigration(context, swapped)
    logError(error)
    return 1
  }
}

/** Logs and rejects snapshots whose parents the comparison cannot tell apart. */
function hasUnambiguousParents(snapshot: string): boolean {
  const groups = findAmbiguousParents(snapshot)
  for (const files of groups) {
    logError(
      `Cannot verify routes nested under ${files.join(', ')}: these files ` +
        'normalize to the same route, so a change of parent would go unnoticed. ' +
        'Rename one of them and rerun.',
    )
  }
  return groups.length === 0
}

function restoreLegacyEntry(
  entryPath: string | null,
  rewrite: RewriteLegacyRouteEntryResult | null,
): void {
  if (!entryPath || typeof rewrite?.previousContents !== 'string') {
    return
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

  const repoRoot = fs.realpathSync.native(topLevelResult.stdout.trim())
  const sourceRelative = path.relative(
    repoRoot,
    fs.realpathSync.native(resolvedSource),
  )

  if (
    sourceRelative.split(path.sep)[0] === '..' ||
    path.isAbsolute(sourceRelative)
  ) {
    logError('Source directory must be inside the git repository.')
    return false
  }

  // Let git filter by the source itself: no parsing of quoted names, renames
  // or collapsed untracked directories (`?? app/`).
  const status = spawnSync(
    'git',
    [
      '--literal-pathspecs',
      'status',
      '--porcelain=v1',
      '-z',
      '--untracked-files=all',
      '--',
      sourceRelative || '.',
    ],
    { cwd: repoRoot, encoding: 'utf8' },
  )

  if (status.status !== 0) {
    logError(
      'Unable to read git status. Ensure git is installed and accessible.',
    )
    return false
  }

  if (status.stdout.length > 0) {
    logError(
      `Working tree must be clean for '${toPosixPath(sourceRelative) || '.'}'. Commit or stash changes affecting this directory and rerun.`,
    )
    return false
  }

  return true
}

function usage(): void {
  logInfo(
    'Usage: migrate-auto-routes [sourceDir] [targetDir]\n\n' +
      'Options:\n' +
      '  -h, --help  Show this help message.\n\n' +
      'The CLI overwrites the target directory if it exists.\n\n' +
      'The CLI rewrites routes using the folder + colocation convention promoted by\n' +
      'react-router-auto-routes.\n\n' +
      'When sourceDir is omitted, it defaults to "app/routes".\n' +
      'When targetDir is omitted, it defaults to a sibling named "new-routes".',
  )
}
