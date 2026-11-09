import fs from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'

const spawnSync = vi.hoisted(() => vi.fn())
vi.mock('node:child_process', () => ({ spawnSync }))

import { defaultRunner } from '../src/migration/cli/runner'

const createdTempDirs: string[] = []

function trackTempDirs() {
  const mkdtempSync = fs.mkdtempSync
  vi.spyOn(fs, 'mkdtempSync').mockImplementation((prefix, options) => {
    const dir = mkdtempSync(prefix, options as BufferEncoding)
    createdTempDirs.push(dir)
    return dir
  })
}

afterEach(() => {
  vi.restoreAllMocks()
  spawnSync.mockReset()
  for (const dir of createdTempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

describe('defaultRunner', () => {
  it('reports temp directory cleanup failures as the result error', () => {
    trackTempDirs()
    spawnSync.mockReturnValue({ status: 0, stderr: '' })
    const cleanupError = new Error('cleanup failed')
    vi.spyOn(fs, 'rmSync').mockImplementationOnce(() => {
      throw cleanupError
    })

    const result = defaultRunner()

    expect(result.status).toBe(0)
    expect(result.error).toBe(cleanupError)
  })

  it('keeps the command error when cleanup also fails', () => {
    trackTempDirs()
    const commandError = new Error('spawn npx ENOENT')
    spawnSync.mockReturnValue({ status: null, stderr: '', error: commandError })
    vi.spyOn(fs, 'rmSync').mockImplementationOnce(() => {
      throw new Error('cleanup failed')
    })

    const result = defaultRunner()

    expect(result.status).toBe(1)
    expect(result.error).toBe(commandError)
  })
})
