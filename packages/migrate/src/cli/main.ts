import { logWarn } from '../logger'
import {
  bundledCoreVersion,
  coreVersionMismatchWarning,
  findInstalledCoreVersion,
} from './core-version'
import { runCli } from './run-cli'

export const LEGACY_BIN_NOTICE =
  '⚠️ The migration CLI now lives in its own package and will be removed ' +
  'from react-router-auto-routes in v2. ' +
  'Run `npx react-router-auto-routes-migrate` instead.'

export type MainOptions = {
  /** Set by the bin still shipped inside `react-router-auto-routes` 1.x. */
  legacyBin?: boolean
}

export function main(argv: string[], options: MainOptions = {}): void {
  if (options.legacyBin) {
    logWarn(LEGACY_BIN_NOTICE)
  }

  const mismatch = coreVersionMismatchWarning(
    bundledCoreVersion(),
    findInstalledCoreVersion(process.cwd()),
  )
  if (mismatch) {
    logWarn(mismatch)
  }

  const exitCode = runCli(argv)
  if (exitCode !== 0) {
    process.exit(exitCode)
  }
}
