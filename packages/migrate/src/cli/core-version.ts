import fs from 'node:fs'
import path from 'node:path'

const CORE_PACKAGE = 'react-router-auto-routes'

/**
 * Version of the core library whose source is bundled into this CLI,
 * injected at build time. Undefined when running from source (tests).
 */
declare const __BUNDLED_CORE_VERSION__: string | undefined

export function bundledCoreVersion(): string | undefined {
  return typeof __BUNDLED_CORE_VERSION__ === 'string'
    ? __BUNDLED_CORE_VERSION__
    : undefined
}

/** Finds the core library the project resolves from `startDir`, if any. */
export function findInstalledCoreVersion(startDir: string): string | undefined {
  let current = path.resolve(startDir)
  while (true) {
    const manifest = path.join(
      current,
      'node_modules',
      CORE_PACKAGE,
      'package.json',
    )
    try {
      const { version } = JSON.parse(fs.readFileSync(manifest, 'utf8'))
      if (typeof version === 'string') {
        return version
      }
    } catch {
      // Not installed at this level (or unreadable); keep walking up.
    }

    const parent = path.dirname(current)
    if (parent === current) {
      return undefined
    }
    current = parent
  }
}

function major(version: string): string {
  return version.split('.')[0]
}

/**
 * The migrated routes are verified with the project's own copy of the core
 * library, so a different major than the bundled one can produce a route
 * diff that is not the migration's fault.
 */
export function coreVersionMismatchWarning(
  bundled: string | undefined,
  installed: string | undefined,
): string | undefined {
  if (!bundled || !installed || major(bundled) === major(installed)) {
    return undefined
  }

  return (
    `⚠️ This CLI was built against ${CORE_PACKAGE} ${major(bundled)}.x, ` +
    `but your project has ${installed} installed. ` +
    'The route verification may report differences caused by the version gap.'
  )
}
