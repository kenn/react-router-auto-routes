import { spawnSync, type SpawnSyncReturns } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { logError, logInfo, logWarn } from '../logger'

export type CommandResult = {
  status: number
  stdout: string
  stderr: string
  error?: Error
}

export type CommandRunner = () => CommandResult

const TEMP_PREFIX = 'react-router-auto-routes-'

export function defaultRunner(): CommandResult {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), TEMP_PREFIX))
  const result = runRoutesCommand(path.join(tempDir, 'stdout.txt'))

  try {
    fs.rmSync(tempDir, { recursive: true, force: true })
  } catch (cleanupError) {
    // Report cleanup failures without hiding an earlier error.
    result.error ??= toError(cleanupError)
  }

  return result
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error))
}

function runRoutesCommand(stdoutPath: string): CommandResult {
  try {
    // Keep stdout out of spawnSync's in-memory buffer: large route manifests
    // can otherwise exceed maxBuffer before the migration can compare them.
    const stdoutFd = fs.openSync(stdoutPath, 'w')
    let result: SpawnSyncReturns<string>
    try {
      result = spawnSync('npx', ['react-router', 'routes'], {
        encoding: 'utf8',
        maxBuffer: 50 * 1024 * 1024, // 50MB buffer for stderr
        stdio: ['ignore', stdoutFd, 'pipe'],
      })
    } finally {
      fs.closeSync(stdoutFd)
    }

    return {
      status: result.status ?? 1,
      stdout: fs.readFileSync(stdoutPath, 'utf8'),
      stderr: result.stderr ?? '',
      error: result.error,
    }
  } catch (error) {
    return {
      status: 1,
      stdout: '',
      stderr: '',
      error: toError(error),
    }
  }
}

export function captureRoutesSnapshot(
  runner: CommandRunner,
  label: string,
): string | null {
  logInfo(`▶️  Running "npx react-router routes" (${label})`)

  const result = runner()

  if (result.error) {
    logError('Failed to run "npx react-router routes".')
    logError(result.error)
    return null
  }

  if (result.status !== 0) {
    logError('"npx react-router routes" exited with a non-zero status.')
    if (result.stderr) {
      logError(result.stderr.trim())
    }
    return null
  }

  if (result.stderr) {
    const trimmed = result.stderr.trim()
    if (trimmed) {
      logWarn(trimmed)
    }
  }

  return result.stdout ?? ''
}
