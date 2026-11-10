import fs from 'node:fs'
import path from 'node:path'
import {
  type BindingRestElement,
  type BindingPattern,
  type Declaration,
  type Node,
  type Program,
  Visitor,
} from 'oxc-parser'
import { parseMigrationSource } from '../parser'

const LEGACY_PATTERNS = [
  'remix-flat-routes',
  'createRoutesFromFolders',
  'flatRoutes',
  '@react-router/remix-routes-option-adapter',
]

const NEXT_PATTERNS = ['react-router-auto-routes']

const ENTRY_CANDIDATES = ['routes.ts', 'routes.tsx', 'routes.js', 'routes.jsx']

export function detectLegacyRouteEntry(sourceDir: string): {
  entryPath: string | null
  isLegacy: boolean
} {
  const appDir = path.dirname(sourceDir)

  for (const candidate of ENTRY_CANDIDATES) {
    const candidatePath = path.join(appDir, candidate)
    if (!fs.existsSync(candidatePath) || !fs.statSync(candidatePath).isFile()) {
      continue
    }

    let contents: string
    try {
      contents = fs.readFileSync(candidatePath, 'utf8')
    } catch {
      continue
    }

    if (NEXT_PATTERNS.some((pattern) => contents.includes(pattern))) {
      return { entryPath: candidatePath, isLegacy: false }
    }

    if (LEGACY_PATTERNS.some((pattern) => contents.includes(pattern))) {
      return { entryPath: candidatePath, isLegacy: true }
    }
  }

  return { entryPath: null, isLegacy: false }
}

export type RewriteLegacyRouteEntryResult = {
  updated: boolean
  previousContents?: string
}

type LegacyRouteOptions = {
  sourceText: string
  program: Program
  foundCall: boolean
  routesDirArg?: Node
  optionsArg?: Node
}

export function rewriteLegacyRouteEntry(
  entryPath: string,
): RewriteLegacyRouteEntryResult {
  let contents: string
  try {
    contents = fs.readFileSync(entryPath, 'utf8')
  } catch {
    return { updated: false }
  }

  if (contents.includes('react-router-auto-routes')) {
    return { updated: false }
  }

  const legacyOptions = extractLegacyRouteOptions(entryPath, contents)
  assertRouteEntryCanBeRewritten(entryPath, legacyOptions)
  const optionsText = createAutoRoutesOptionsText(legacyOptions)
  const nextContents = createAutoRoutesEntry(optionsText)

  fs.writeFileSync(entryPath, nextContents)

  return {
    updated: true,
    previousContents: contents,
  }
}

function createAutoRoutesEntry(optionsText: string | undefined): string {
  const header =
    "import { autoRoutes } from 'react-router-auto-routes'\n" +
    "import { type RouteConfig } from '@react-router/dev/routes'\n\n"

  if (!optionsText) {
    return `${header}export default autoRoutes() satisfies RouteConfig\n`
  }

  return `${header}export default autoRoutes(${optionsText}) satisfies RouteConfig\n`
}

function extractLegacyRouteOptions(
  entryPath: string,
  contents: string,
): LegacyRouteOptions {
  const program = parseMigrationSource(entryPath, contents)

  const legacyCalls = new Set(['flatRoutes', 'createRoutesFromFolders'])
  const result: LegacyRouteOptions = {
    sourceText: contents,
    program,
    foundCall: false,
  }

  new Visitor({
    CallExpression(node) {
      if (result.routesDirArg || result.optionsArg) {
        return
      }

      const name = extractCalleeName(node.callee)
      if (name && legacyCalls.has(name)) {
        result.foundCall = true
        if (name === 'flatRoutes') {
          result.routesDirArg = node.arguments[0]
          result.optionsArg = node.arguments[2]
        } else if (name === 'createRoutesFromFolders') {
          result.optionsArg = node.arguments[1]
        }
      }
    },
  }).visit(program)
  return result
}

function assertRouteEntryCanBeRewritten(
  entryPath: string,
  legacy: LegacyRouteOptions,
): void {
  if (!legacy.foundCall) {
    throw new Error(
      `Unable to rewrite route entry '${entryPath}' because no supported legacy route call was found. ` +
        'Update the route entry manually, then rerun the migration.',
    )
  }

  const topLevelBindings = collectTopLevelBindings(legacy.program)
  const referencedBindings = new Set<string>()

  for (const expression of [legacy.routesDirArg, legacy.optionsArg]) {
    if (!expression) {
      continue
    }

    for (const name of collectReferencedBindings(expression, legacy.program)) {
      if (topLevelBindings.has(name)) {
        referencedBindings.add(name)
      }
    }
  }

  if (referencedBindings.size === 0) {
    return
  }

  const names = [...referencedBindings].sort().join(', ')
  throw new Error(
    `Unable to rewrite route entry '${entryPath}' because its legacy route options reference local bindings: ${names}. ` +
      'Inline these values in the legacy route call and rerun the migration.',
  )
}

function collectTopLevelBindings(program: Program): Set<string> {
  const bindings = new Set<string>()

  for (const statement of program.body) {
    if (statement.type === 'ImportDeclaration') {
      for (const specifier of statement.specifiers) {
        bindings.add(specifier.local.name)
      }
      continue
    }

    if (statement.type === 'ExportNamedDeclaration' && statement.declaration) {
      collectDeclarationBindings(statement.declaration, bindings)
      continue
    }

    if (
      statement.type === 'VariableDeclaration' ||
      statement.type === 'FunctionDeclaration' ||
      statement.type === 'ClassDeclaration'
    ) {
      collectDeclarationBindings(statement, bindings)
    }
  }

  return bindings
}

function collectDeclarationBindings(
  declaration: Declaration,
  bindings: Set<string>,
): void {
  if (declaration.type === 'VariableDeclaration') {
    for (const declarator of declaration.declarations) {
      collectBindingPatternNames(declarator.id, bindings)
    }
    return
  }

  if (
    (declaration.type === 'FunctionDeclaration' ||
      declaration.type === 'ClassDeclaration') &&
    declaration.id
  ) {
    bindings.add(declaration.id.name)
  }
}

function collectBindingPatternNames(
  pattern: BindingPattern | BindingRestElement,
  bindings: Set<string>,
): void {
  if (pattern.type === 'Identifier') {
    bindings.add(pattern.name)
    return
  }

  if (pattern.type === 'AssignmentPattern') {
    collectBindingPatternNames(pattern.left, bindings)
    return
  }

  if (pattern.type === 'RestElement') {
    collectBindingPatternNames(pattern.argument, bindings)
    return
  }

  if (pattern.type === 'ArrayPattern') {
    for (const element of pattern.elements) {
      if (element) {
        collectBindingPatternNames(element, bindings)
      }
    }
    return
  }

  for (const property of pattern.properties) {
    if (property.type === 'RestElement') {
      collectBindingPatternNames(property.argument, bindings)
    } else {
      collectBindingPatternNames(property.value, bindings)
    }
  }
}

function collectReferencedBindings(
  expression: Node,
  program: Program,
): Set<string> {
  const references = new Set<string>()
  const ignoredIdentifierSpans = new Set<string>()
  const isWithinExpression = (node: Node) =>
    node.start >= expression.start && node.end <= expression.end
  const spanKey = (node: Node) => `${node.start}:${node.end}`

  new Visitor({
    Property(node) {
      if (
        isWithinExpression(node) &&
        !node.computed &&
        !node.shorthand &&
        node.key.type === 'Identifier'
      ) {
        ignoredIdentifierSpans.add(spanKey(node.key))
      }
    },
    MemberExpression(node) {
      if (
        isWithinExpression(node) &&
        !node.computed &&
        node.property.type === 'Identifier'
      ) {
        ignoredIdentifierSpans.add(spanKey(node.property))
      }
    },
    Identifier(node) {
      if (
        isWithinExpression(node) &&
        !ignoredIdentifierSpans.has(spanKey(node))
      ) {
        references.add(node.name)
      }
    },
  }).visit(program)

  return references
}

function createAutoRoutesOptionsText(
  legacy: LegacyRouteOptions,
): string | undefined {
  const { routesDirArg, optionsArg, sourceText } = legacy

  const hasRoutesDirProperty =
    optionsArg &&
    optionsArg.type === 'ObjectExpression' &&
    optionsArg.properties.some(isRoutesDirProperty)

  const parts: string[] = []

  if (routesDirArg && !hasRoutesDirProperty) {
    parts.push(`routesDir: ${printExpression(sourceText, routesDirArg)}`)
  }

  if (optionsArg) {
    const spreadExpression = printExpression(sourceText, optionsArg)
    parts.push(`...${spreadExpression}`)
  }

  if (parts.length === 0) {
    return undefined
  }

  const multiline =
    parts.length > 1 || parts.some((part) => part.includes('\n'))
  if (!multiline) {
    return `{ ${parts[0]} }`
  }

  const newline = '\n'
  const body = parts.map((part) => `  ${part},`).join(newline)
  return `{${newline}${body}${newline}}`
}

function printExpression(sourceText: string, expression: Node): string {
  return sourceText.slice(expression.start, expression.end)
}

function isRoutesDirProperty(property: Node): boolean {
  return (
    property.type === 'Property' &&
    !property.computed &&
    getPropertyNameText(property.key) === 'routesDir'
  )
}

function getPropertyNameText(name: Node): string | undefined {
  if (name.type === 'Identifier') {
    return name.name
  }

  if (name.type === 'Literal' && typeof name.value === 'string') {
    return name.value
  }

  return undefined
}

function extractCalleeName(expression: Node): string | null {
  if (expression.type === 'Identifier') {
    return expression.name
  }

  if (
    expression.type === 'MemberExpression' &&
    !expression.computed &&
    expression.property.type === 'Identifier'
  ) {
    return expression.property.name
  }

  return null
}
