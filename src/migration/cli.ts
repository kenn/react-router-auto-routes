#!/usr/bin/env node

import * as fs from 'fs'
import { migrate, type MigrateOptions } from './migrate'

const COMMAND_NAME = 'migrate-auto-routes'

main()

function main() {
  const argv = process.argv.slice(2)
  if (argv.length < 2) {
    usage()
    process.exit(1)
  }
  const sourceDir = argv[0]
  const targetDir = argv[1]

  if (argv.length > 2) {
    usage()
    process.exit(1)
  }

  if (sourceDir === targetDir) {
    console.error('source and target directories must be different')
    process.exit(1)
  }

  if (!fs.existsSync(sourceDir)) {
    console.error(`source directory '${sourceDir}' does not exist`)
    process.exit(1)
  }

  const options: MigrateOptions = { force: true }
  if (fs.existsSync(targetDir)) {
    fs.rmSync(targetDir, { recursive: true, force: true })
  }

  migrate(sourceDir, targetDir, options)
}

function usage() {
  console.log(
    `Usage: ${COMMAND_NAME} <sourceDir> <targetDir>\n\n` +
      'The CLI overwrites the target directory if it exists.\n\n' +
      'The CLI rewrites routes using the folder + colocation convention promoted by\n' +
      'react-router-auto-routes.\n',
  )
}
