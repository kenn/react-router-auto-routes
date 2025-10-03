import fs from 'node:fs'
import path from 'node:path'

import { migrate, type MigrateOptions } from '../migrate'
import {
  defaultTargetDir,
  pathRelative,
  revertRoutes,
  swapRoutes,
} from '../fs-helpers'
import { logError, logInfo, logWarn } from '../logger'
import { diffSnapshots, normalizeSnapshot } from './diff'
import { captureRoutesSnapshot, defaultRunner, type CommandRunner } from './runner'
import { detectLegacyRouteEntry, rewriteLegacyRouteEntry } from './route-entry'

export type RunOptions = {
  runner?: CommandRunner
}

export type { CommandRunner }

export function runCli(argv: string[], options: RunOptions = {}): number {
  if (argv.length === 0 || argv.length > 2) {
    usage()
    return 1
  }

  const sourceDir = argv[0]
  const targetDir = argv[1] ?? defaultTargetDir(sourceDir)

  if (sourceDir === targetDir) {
    logError('source and target directories must be different')
    return 1
  }

  if (!fs.existsSync(sourceDir)) {
    logError(`source directory '${sourceDir}' does not exist`)
    return 1
  }

  const runner = options.runner ?? defaultRunner
  const optionsForMigrate: MigrateOptions = { force: true }

  const resolvedSource = path.resolve(sourceDir)
  const resolvedTarget = path.resolve(targetDir)
  const parentDir = path.dirname(resolvedSource)
  const resolvedBackup = path.join(parentDir, 'old-routes')

  if (resolvedSource === resolvedBackup) {
    logError('source directory cannot be named old-routes')
    return 1
  }

  if (resolvedTarget === resolvedBackup) {
    logError('target directory cannot be the backup directory old-routes')
    return 1
  }

  if (fs.existsSync(resolvedBackup)) {
    logError(
      `backup directory '${pathRelative(process.cwd(), resolvedBackup)}' already exists. ` +
        'Remove or rename it before running the migration.',
    )
    return 1
  }

  const { entryPath, isLegacy } = detectLegacyRouteEntry(resolvedSource)

  const beforeSnapshot = captureRoutesSnapshot(runner, 'before migration')
  if (beforeSnapshot === null) {
    return 1
  }

  try {
    if (fs.existsSync(resolvedTarget)) {
      fs.rmSync(resolvedTarget, { recursive: true, force: true })
    }

    migrate(sourceDir, targetDir, optionsForMigrate)
  } catch (error) {
    logError(error)
    return 1
  }

  let swapped = false

  try {
    swapRoutes(resolvedSource, resolvedTarget, resolvedBackup)
    swapped = true

    if (isLegacy && entryPath) {
      const updated = rewriteLegacyRouteEntry(entryPath)
      const entryRelative = pathRelative(process.cwd(), entryPath)
      logInfo(
        updated
          ? `✏️ Updated route entry '${entryRelative}' to use autoRoutes().`
          : `✏️ Route entry '${entryRelative}' already references autoRoutes().`,
      )
    }

    const afterSnapshot = captureRoutesSnapshot(runner, 'after migration')
    if (afterSnapshot === null) {
      revertRoutes(resolvedSource, resolvedTarget, resolvedBackup)
      return 1
    }

    const beforeNormalized = normalizeSnapshot(beforeSnapshot)
    const afterNormalized = normalizeSnapshot(afterSnapshot)

    if (beforeNormalized === afterNormalized) {
      logInfo('✅ Routes match between runs. Migration looks good!')
      logInfo(
        `📁 Original routes moved to '${pathRelative(
          process.cwd(),
          resolvedBackup,
        )}'. Keep or remove at your discretion.`,
      )
      return 0
    }

    logError('❌ Route output changed. Reverting migration.')
    const diff = diffSnapshots(beforeNormalized, afterNormalized)
    logError(diff)
    revertRoutes(resolvedSource, resolvedTarget, resolvedBackup)
    return 1
  } catch (error) {
    if (swapped) {
      revertRoutes(resolvedSource, resolvedTarget, resolvedBackup)
    } else if (fs.existsSync(resolvedTarget)) {
      fs.rmSync(resolvedTarget, { recursive: true, force: true })
    }

    logError(error)
    return 1
  }
}

function usage(): void {
  logInfo(
    'Usage: migrate-auto-routes <sourceDir> [targetDir]\n\n' +
      'The CLI overwrites the target directory if it exists.\n\n' +
      'The CLI rewrites routes using the folder + colocation convention promoted by\n' +
      'react-router-auto-routes.\n\n' +
      'When targetDir is omitted, it defaults to a sibling named "new-routes".',
  )
}
