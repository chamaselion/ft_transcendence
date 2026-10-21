export type BlockType = 'p' | 'li' | 'h' | 'cit' | 'c'

export interface Block {
  id: string
  text: string
  decorator: string
  lockedBy: string | null
}

export type ParagraphAlignment = 'left' | 'center' | 'right' | 'justify'

export interface BlockDecorator {
  type: BlockType
  level?: 1 | 2 | 3 | 4 | 5 | 6
  ordered?: boolean
  marker?: string
  source?: string
  language?: string
  align?: ParagraphAlignment
}

export interface EditorEditEvent {
  blockId?: string
  type?: BlockType
  text?: string
  decorator?: string
  afterBlockId?: string | null
  block?: Block
  userId?: string | null
}

export interface EditorInitEvent {
  blocks: Block[]
  documentId?: string
  title?: string
  permission?: 'owner' | 'editor' | 'viewer'
}

export interface EditorDataProvider {
  sendEdit: (e: EditorEditEvent) => Promise<boolean>
  sendBlockCreate: (e: EditorEditEvent) => Promise<boolean>
  sendBlockDelete: (e: EditorEditEvent) => Promise<boolean>
  sendBlockLock?: (blockId: string) => Promise<boolean>
  sendBlockUnlock?: (blockId: string) => Promise<boolean>
  sendTitleUpdate?: (title: string) => Promise<boolean>
  onInit: (e: EditorInitEvent) => void
  onCreated: (e: { block: Block; afterBlockId?: string | null }) => void
  onUpdated: (e: {
    blockId: string
    text?: string
    decorator?: string
    userId?: string | null
  }) => void
  onDeleted: (e: { blockId: string }) => void
  onLocked?: (e: { blockId: string; userId?: string | null; clientId?: string }) => void
  onUnlocked: (e: { blockId: string }) => void
  onTitleUpdated?: (e: { title: string; userId?: string | null }) => void
  onError: (e: { error: string }) => void
  destroy?: () => void
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
      return { type, align: 'left' }
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

export function isCodeOrCitation(decorator: string): boolean {
  if (decorator === 'c' || decorator === 'cit') return true
  try {
    const parsed = JSON.parse(decorator) as Partial<BlockDecorator>
    return parsed?.type === 'c' || parsed?.type === 'cit'
  } catch {
    return false
  }
}

export function createBlock(type: BlockType, text = ''): Block {
  return {
    id: crypto.randomUUID(),
    text,
    decorator: serializeDecorator(defaultDecorator(type)),
    lockedBy: null,
  }
}
