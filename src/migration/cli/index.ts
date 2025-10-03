import { runCli } from './run-cli'

export { runCli }
export type { RunOptions } from './run-cli'
export type { CommandRunner, CommandResult } from './runner'

export function main(): void {
  const exitCode = runCli(process.argv.slice(2))
  if (exitCode !== 0) {
    process.exit(exitCode)
  }
}
