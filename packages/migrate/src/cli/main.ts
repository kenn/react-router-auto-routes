import { logWarn } from '../logger'
import {
  bundledCoreVersion,
  coreVersionMismatchWarning,
  findInstalledCoreVersion,
} from './core-version'
import { runCli } from './run-cli'

export function main(argv: string[]): void {
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
