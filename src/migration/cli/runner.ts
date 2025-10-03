import { spawnSync } from 'node:child_process'

import { logError, logInfo, logWarn } from '../logger'

export type CommandResult = {
  status: number
  stdout: string
  stderr: string
  error?: Error
}

export type CommandRunner = () => CommandResult

export function defaultRunner(): CommandResult {
  const result = spawnSync('npx', ['react-router', 'routes'], {
    encoding: 'utf8',
    stdio: 'pipe',
  })

  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    error: result.error ?? undefined,
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
