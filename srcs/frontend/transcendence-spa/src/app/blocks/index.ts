import { isBlockDefinition, type BlockDefinition } from './types'

// Vite resolves every block add-in at build time. Adding a new folder with an
// index.ts is enough: no central switch statement has to be edited.
const modules = import.meta.glob<{ default: BlockDefinition }>('./*/index.ts', {
  eager: true,
})

const definitions = Object.values(modules)
  .map((module) => module.default)
  .filter(isBlockDefinition)
  .sort((a, b) => (a.order ?? 1000) - (b.order ?? 1000) || a.type.localeCompare(b.type))

const byType = new Map(definitions.map((definition) => [definition.type, definition]))

export const blockDefinitions: readonly BlockDefinition[] = definitions
export const blockTypes: string[] = definitions.map((definition) => definition.type)

export function getBlockDefinition(type: string): BlockDefinition | undefined {
  return byType.get(type)
}

export function getBlockLabel(
  definition: Pick<BlockDefinition, 'name' | 'nameKey'>,
  t: (key: string) => string,
): string {
  return definition.nameKey ? t(definition.nameKey) : definition.name
}

export function getBlockDescription(
  definition: Pick<BlockDefinition, 'description' | 'descriptionKey'>,
  t: (key: string) => string,
): string {
  return definition.descriptionKey ? t(definition.descriptionKey) : definition.description
}

export type { BlockDefinition } from './types'
