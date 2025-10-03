#!/usr/bin/env node

import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { main, runCli } from './cli/index'

const entryPath = fileURLToPath(import.meta.url)

if (process.argv[1] && path.resolve(process.argv[1]) === entryPath) {
  main()
}

export { main, runCli }
export type { RunOptions } from './cli/index'
export type { CommandRunner, CommandResult } from './cli/index'
