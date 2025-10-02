#!/usr/bin/env node

import * as fs from 'fs'
import { migrate, type MigrateOptions } from './migrate'

main()

function main() {
  const argv = process.argv.slice(2)
  if (argv.length < 2) {
    usage()
    process.exit(1)
  }
  const sourceDir = argv[0]
  const targetDir = argv[1]

  if (sourceDir === targetDir) {
    console.error('source and target directories must be different')
    process.exit(1)
  }

  if (!fs.existsSync(sourceDir)) {
    console.error(`source directory '${sourceDir}' does not exist`)
    process.exit(1)
  }

  let options: MigrateOptions = { force: false }

  for (let option of argv.slice(2)) {
    if (option === '--force') {
      options.force = true
      continue
    }

    usage()
    process.exit(1)
  }
  if (fs.existsSync(targetDir)) {
    if (!options.force) {
      console.error(`❌ target directory '${targetDir}' already exists`)
      console.error(`   use --force to overwrite`)
      process.exit(1)
    }
    fs.rmSync(targetDir, { recursive: true, force: true })
  }

  migrate(sourceDir, targetDir, options)
}

function usage() {
  console.log(
    `Usage: migrate <sourceDir> <targetDir> [options]

Options:
  --force
    Overwrite target directory if it exists

The CLI rewrites routes using the folder + ` +
      ` colocation convention promoted by
react-router-auto-routes.
`,
  )
}
