import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

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
  const stdoutPath = path.join(tempDir, 'stdout.txt')

  let stdoutFd: number | null = null
  let result: ReturnType<typeof spawnSync> | null = null
  let extraError: Error | undefined

  try {
    stdoutFd = fs.openSync(stdoutPath, 'w')
    result = spawnSync('npx', ['react-router', 'routes'], {
      encoding: 'utf8',
      maxBuffer: 50 * 1024 * 1024, // 50MB buffer for stderr
      stdio: ['ignore', stdoutFd, 'pipe'],
    })
  } catch (error) {
    extraError = error instanceof Error ? error : new Error(String(error))
  } finally {
    if (stdoutFd !== null) {
      try {
        fs.closeSync(stdoutFd)
      } catch (closeError) {
        if (!extraError && closeError instanceof Error) {
          extraError = closeError
        }
      }
    }
  }

  let stdout = ''
  try {
    if (fs.existsSync(stdoutPath)) {
      stdout = fs.readFileSync(stdoutPath, 'utf8')
    }
  } catch (readError) {
    if (!extraError && readError instanceof Error) {
      extraError = readError
    }
  } finally {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true })
    } catch (cleanupError) {
      if (!extraError && cleanupError instanceof Error) {
        extraError = cleanupError
      }
    }
  }

  if (result === null) {
    return {
      status: 1,
      stdout,
      stderr: '',
      error: extraError,
    }
  }

  const stderr = (() => {
    const value = result.stderr
    if (value === undefined || value === null) {
      return ''
    }

    return typeof value === 'string' ? value : value.toString('utf8')
  })()

  return {
    status: result.status ?? 1,
    stdout,
    stderr,
    error: extraError ?? result.error ?? undefined,
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
