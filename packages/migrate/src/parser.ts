import { parseSync, type Program } from 'oxc-parser'

export function parseMigrationSource(
  filename: string,
  sourceText: string,
): Program {
  const { program, errors } = parseSync(filename, sourceText)

  if (errors.length === 0) {
    return program
  }

  const details = errors
    .map((error) => error.codeframe ?? error.message)
    .join('\n\n')

  throw new Error(
    `Unable to migrate '${filename}' because Oxc could not parse it:\n${details}\n` +
      'Fix the syntax errors in this file and rerun the migration.',
  )
}
