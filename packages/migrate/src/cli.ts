#!/usr/bin/env node

import { runCli } from './cli/run-cli'

const exitCode = runCli(process.argv.slice(2))
if (exitCode !== 0) {
  process.exit(exitCode)
}
