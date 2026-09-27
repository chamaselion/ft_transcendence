export type BlockType = 'p' | 'li' | 'h' | 'cit' | 'c'

export interface Block {
  id: string
  text: string
  decorator: string
  lockedBy: string | null
}

export interface BlockDecorator {
  type: BlockType
  level?: 1 | 2 | 3 | 4 | 5 | 6
  ordered?: boolean
  marker?: string
  source?: string
  language?: string
}

export const blockTypes: BlockType[] = ['p', 'li', 'h', 'cit', 'c']

export const blockTypeLabels: Record<BlockType, string> = {
  p: 'Paragraph',
  li: 'List',
  h: 'Heading',
  cit: 'Citation',
  c: 'Code',
}

export function defaultDecorator(type: BlockType): BlockDecorator {
  switch (type) {
    case 'h':
      return { type, level: 2 }
    case 'li':
      return { type, ordered: false }
    case 'cit':
      return { type, source: '' }
    case 'c':
      return { type, language: 'plaintext' }
    case 'p':
    default:
      return { type }
  }
}

export function parseDecorator(decorator: string): BlockDecorator {
  try {
    const parsed = JSON.parse(decorator) as Partial<BlockDecorator>
    if (!parsed.type || !blockTypes.includes(parsed.type)) {
      return { type: 'p' }
    }
    return { ...defaultDecorator(parsed.type), ...parsed }
  } catch {
    return { type: 'p' }
  }
}

export function serializeDecorator(decorator: BlockDecorator): string {
  return JSON.stringify(decorator)
}

export function createBlock(type: BlockType, text = ''): Block {
  return {
    id: crypto.randomUUID(),
    text,
    decorator: serializeDecorator(defaultDecorator(type)),
    lockedBy: null,
  }
}
