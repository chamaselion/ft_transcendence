import { getBlockDefinition } from '@/app/blocks'

export type BlockType = string

export interface Block {
  id: string
  text: string
  decorator: string
  lockedBy: string | null
}

export type ParagraphAlignment = 'left' | 'center' | 'right' | 'justify'

export interface TableData {
  rows: string[][]
  headerRow: boolean
}

export interface BlockDecorator {
  type: BlockType
  level?: 1 | 2 | 3 | 4 | 5 | 6
  ordered?: boolean
  marker?: string
  source?: string
  language?: string
  align?: ParagraphAlignment
  checklist?: boolean
  checked?: boolean[]
  rows?: string[][]
  headerRow?: boolean
  src?: string
  imageId?: string
  alt?: string
  displayMode?: 'inline' | 'block'
  [key: string]: unknown
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

export type DocumentPermission = 'owner' | 'editor' | 'viewer'

export type ConnectionState = 'connecting' | 'connected' | 'reconnecting' | 'syncing' | 'offline'

export interface EditorLockInfo {
  blockId: string
  clientId?: string | null
  userId?: string | null
}

export interface EditorInitEvent {
  blocks: Block[]
  documentId?: string
  title?: string
  permission?: DocumentPermission
  unchanged?: boolean
  contentHash?: string
  locks?: EditorLockInfo[]
}

export type SyncOperation =
  | {
      kind: 'set'
      blockId: string
      text?: string
      decorator?: string
      expected: string
    }
  | {
      kind: 'create'
      block: Block
      afterBlockId?: string | null
      expected: null
    }
  | {
      kind: 'delete'
      blockId: string
      expected: string
    }
  | {
      kind: 'move'
      blockId: string
      afterBlockId?: string | null
    }
  | {
      kind: 'title'
      title: string
      expectedTitle?: string
    }

export interface SyncConflict {
  kind?: 'block' | 'title'
  blockId?: string
  reason: string
  block?: Block | null
  fingerprint?: string | null
  remoteTitle?: string
}

export interface SyncResult {
  contentHash: string
  applied?: number
}

export interface EditorDataProvider {
  sendEdit: (e: EditorEditEvent) => Promise<boolean>
  sendBlockCreate: (e: EditorEditEvent) => Promise<boolean>
  sendBlockDelete: (e: EditorEditEvent) => Promise<boolean>
  sendBlockLock?: (blockId: string) => Promise<boolean>
  sendBlockUnlock?: (blockId: string) => Promise<boolean>
  sendTitleUpdate?: (title: string) => Promise<boolean>
  sendSync?: (ops: SyncOperation[]) => Promise<SyncResult>
  getConnectionState?: () => ConnectionState
  onConnectionState?: (state: ConnectionState) => void
  onInit: (e: EditorInitEvent) => void
  onCreated: (e: { block: Block; afterBlockId?: string | null }) => void
  onUpdated: (e: {
    blockId: string
    text?: string
    decorator?: string
    userId?: string | null
  }) => void
  onDeleted: (e: { blockId: string }) => void
  onMoved?: (e: { blockId: string; afterBlockId?: string | null }) => void
  onLocked?: (e: { blockId: string; userId?: string | null; clientId?: string }) => void
  onUnlocked: (e: { blockId: string }) => void
  onTitleUpdated?: (e: { title: string; userId?: string | null }) => void
  onPermission?: (permission: DocumentPermission) => void
  onError: (e: { error: string }) => void
  destroy?: () => void
}

export const defaultDecoratorForType = (type: BlockType): BlockDecorator =>
  getBlockDefinition(type)?.createDecorator() ?? { type: 'p', align: 'left' }

export function parseDecorator(decorator: string): BlockDecorator {
  try {
    const parsed = JSON.parse(decorator) as Partial<BlockDecorator>
    const definition = parsed.type ? getBlockDefinition(parsed.type) : undefined
    if (!definition) return defaultDecoratorForType('p')
    const merged = { ...definition.createDecorator(), ...parsed } as BlockDecorator
    return definition.normalizeDecorator ? definition.normalizeDecorator(merged) : merged
  } catch {
    return defaultDecoratorForType('p')
  }
}

export function serializeDecorator(decorator: BlockDecorator): string {
  return JSON.stringify(decorator)
}

const isTranslatableType = (type: string): boolean =>
  getBlockDefinition(type)?.translatable !== false

export function isTranslatableBlock(decorator: string): boolean {
  return isTranslatableType(parseDecorator(decorator).type)
}

export function isElaboratableBlock(decorator: string): boolean {
  return getBlockDefinition(parseDecorator(decorator).type)?.elaboratable === true
}

export function showsCanonicalPreview(decorator: string): boolean {
  return getBlockDefinition(parseDecorator(decorator).type)?.showCanonicalPreview !== false
}

// Kept for older call sites; code and citations are not sent to translation.
export function isCodeOrCitation(decorator: string): boolean {
  return !isTranslatableBlock(decorator)
}

export function createBlock(type: BlockType, text = ''): Block {
  return {
    id: crypto.randomUUID(),
    text,
    decorator: serializeDecorator(defaultDecoratorForType(type)),
    lockedBy: null,
  }
}
