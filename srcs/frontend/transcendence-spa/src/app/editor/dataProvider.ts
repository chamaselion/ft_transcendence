import {
  type Block,
  type EditorDataProvider,
  type EditorEditEvent,
  type EditorInitEvent,
  createBlock,
} from '@/app/editor/types'
import { escapeHtml, unescapeHtml } from '@/app/editor/textCodec'
import { i18n } from '@/i18n'

const decodeBlock = (block: Block): Block => ({
  ...block,
  text: typeof block.text === 'string' ? unescapeHtml(block.text) : block.text,
})

const decodeBlocks = (blocks: Block[]): Block[] => blocks.map(decodeBlock)

const decodeTitle = (title?: string): string | undefined =>
  typeof title === 'string' ? unescapeHtml(title) : title

export interface WebSocketProviderOptions {
  documentId: string
  wsUrl?: string
  onOpen?: () => void
  onClose?: () => void
}

interface WsIncomingMessage {
  type: string
  documentId?: string
  permission?: 'owner' | 'editor' | 'viewer'
  document?: {
    id: string
    title: string
    content: string
  }
  block?: Block
  afterBlockId?: string | null
  blockId?: string
  text?: string
  decorator?: string
  userId?: string | null
  clientId?: string
  title?: string
  content?: string
  error?: string
}

function resolveDefaultWsUrl(): string {
  if (typeof window === 'undefined') return 'ws://localhost:3001/api/ws'
  const isHttps = window.location.protocol === 'https:'
  const protocol = isHttps ? 'wss:' : 'ws:'
  return `${protocol}//${window.location.host}/api/ws`
}

export class WebSocketEditorDataProvider implements EditorDataProvider {
  public documentId: string
  public wsUrl: string
  public readonly clientId: string = crypto.randomUUID()
  private ws: WebSocket | null = null
  private isDestroyed = false

  public onInit: (e: EditorInitEvent) => void = () => {}
  public onCreated: (e: { block: Block; afterBlockId?: string | null }) => void = () => {}
  public onUpdated: (e: {
    blockId: string
    text?: string
    decorator?: string
    userId?: string | null
  }) => void = () => {}
  public onDeleted: (e: { blockId: string }) => void = () => {}
  public onLocked: (e: {
    blockId: string
    userId?: string | null
    clientId?: string
  }) => void = () => {}
  public onUnlocked: (e: { blockId: string }) => void = () => {}
  public onTitleUpdated: (e: { title: string; userId?: string | null }) => void = () => {}
  public onError: (e: { error: string }) => void = () => {}

  private onOpenCallback?: () => void
  private onCloseCallback?: () => void

  constructor(options: WebSocketProviderOptions) {
    this.documentId = options.documentId
    this.wsUrl = options.wsUrl || resolveDefaultWsUrl()
    this.onOpenCallback = options.onOpen
    this.onCloseCallback = options.onClose
    this.connect()
  }

  public connect(): void {
    if (this.isDestroyed) return
    try {
      this.ws = new WebSocket(this.wsUrl)
    } catch (err) {
      this.onError({ error: err instanceof Error ? err.message : 'WebSocket connection failed' })
      return
    }

    this.ws.onopen = () => {
      this.onOpenCallback?.()
      this.sendRaw({ type: 'join', documentId: this.documentId })
    }

    this.ws.onmessage = (event: MessageEvent) => {
      let msg: WsIncomingMessage
      try {
        msg = JSON.parse(event.data) as WsIncomingMessage
      } catch {
        return
      }

      switch (msg.type) {
        case 'init': {
          let blocks: Block[] = []
          if (msg.document?.content) {
            try {
              const parsed = JSON.parse(msg.document.content)
              if (Array.isArray(parsed)) {
                blocks = parsed
              }
            } catch {
              // If unparsed legacy string, backend handles migration on join
            }
          }
          this.onInit({
            blocks: decodeBlocks(blocks),
            documentId: msg.document?.id,
            title: decodeTitle(msg.document?.title),
            permission: msg.permission,
          })
          break
        }

        case 'block_created':
          if (msg.block) {
            this.onCreated({
              block: decodeBlock(msg.block),
              afterBlockId: msg.afterBlockId,
            })
          }
          break

        case 'block_updated':
          if (msg.blockId) {
            this.onUpdated({
              blockId: msg.blockId,
              text: typeof msg.text === 'string' ? unescapeHtml(msg.text) : msg.text,
              decorator: msg.decorator,
              userId: msg.userId,
            })
          }
          break

        case 'block_deleted':
          if (msg.blockId) {
            this.onDeleted({ blockId: msg.blockId })
          }
          break

        case 'block_locked':
          if (msg.blockId) {
            this.onLocked({
              blockId: msg.blockId,
              userId: msg.userId,
              clientId: msg.clientId,
            })
          }
          break

        case 'block_unlocked':
          if (msg.blockId) {
            this.onUnlocked({ blockId: msg.blockId })
          }
          break

        case 'title_updated':
          if (msg.title) {
            this.onTitleUpdated({ title: unescapeHtml(msg.title), userId: msg.userId })
          }
          break

        case 'update':
          // Backwards compatibility with legacy full-content update
          if (typeof msg.content === 'string') {
            try {
              const parsed = JSON.parse(msg.content)
              if (Array.isArray(parsed)) {
                this.onInit({ blocks: decodeBlocks(parsed), documentId: msg.documentId })
              }
            } catch {
              // Ignore non-block string updates
            }
          }
          break

        case 'error':
          this.onError({ error: msg.error || 'Server error' })
          break

        case 'revoked':
          this.onError({ error: 'Access to document was revoked' })
          break

        case 'session_expired':
          this.onError({ error: i18n.global.t('errors.sessionExpired') })
          break
      }
    }

    this.ws.onclose = () => {
      this.onCloseCallback?.()
    }

    this.ws.onerror = () => {
      this.onError({ error: 'WebSocket encountered an error' })
    }
  }

  private sendRaw(data: unknown): boolean {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data))
      return true
    }
    return false
  }

  public async sendEdit(e: EditorEditEvent): Promise<boolean> {
    const success = this.sendRaw({
      type: 'block_edit',
      documentId: this.documentId,
      blockId: e.blockId,
      text: typeof e.text === 'string' ? escapeHtml(e.text) : e.text,
      decorator: e.decorator,
    })
    return success
  }

  public async sendBlockCreate(e: EditorEditEvent): Promise<boolean> {
    const success = this.sendRaw({
      type: 'block_create',
      documentId: this.documentId,
      block: e.block
        ? {
            ...e.block,
            text: typeof e.block.text === 'string' ? escapeHtml(e.block.text) : e.block.text,
          }
        : e.block,
      afterBlockId: e.afterBlockId,
    })
    return success
  }

  public async sendBlockDelete(e: EditorEditEvent): Promise<boolean> {
    const success = this.sendRaw({
      type: 'block_delete',
      documentId: this.documentId,
      blockId: e.blockId,
    })
    return success
  }

  public async sendBlockLock(blockId: string): Promise<boolean> {
    const success = this.sendRaw({
      type: 'block_lock',
      documentId: this.documentId,
      blockId,
      clientId: this.clientId,
    })
    return success
  }

  public async sendBlockUnlock(blockId: string): Promise<boolean> {
    const success = this.sendRaw({
      type: 'block_unlock',
      documentId: this.documentId,
      blockId,
      clientId: this.clientId,
    })
    return success
  }

  public async sendTitleUpdate(title: string): Promise<boolean> {
    const success = this.sendRaw({
      type: 'title_update',
      documentId: this.documentId,
      title: escapeHtml(title),
    })
    return success
  }

  public destroy(): void {
    this.isDestroyed = true
    if (this.ws) {
      this.ws.onclose = null
      this.ws.onerror = null
      this.ws.onmessage = null
      this.ws.close()
      this.ws = null
    }
  }
}

export class LocalEditorDataProvider implements EditorDataProvider {
  private blocks: Block[] = []
  public readonly clientId: string = 'local'

  public onInit: (e: EditorInitEvent) => void = () => {}
  public onCreated: (e: { block: Block; afterBlockId?: string | null }) => void = () => {}
  public onUpdated: (e: {
    blockId: string
    text?: string
    decorator?: string
    userId?: string | null
  }) => void = () => {}
  public onDeleted: (e: { blockId: string }) => void = () => {}
  public onLocked: (e: {
    blockId: string
    userId?: string | null
    clientId?: string
  }) => void = () => {}
  public onUnlocked: (e: { blockId: string }) => void = () => {}
  public onTitleUpdated: (e: { title: string; userId?: string | null }) => void = () => {}
  public onError: (e: { error: string }) => void = () => {}

  constructor(initialBlocks: Block[] = []) {
    this.blocks = initialBlocks.length > 0 ? initialBlocks : [createBlock('p', '')]
    setTimeout(() => {
      this.onInit({
        blocks: this.blocks.map((b) => ({ ...b })),
        permission: 'owner',
      })
    }, 0)
  }

  public async sendEdit(e: EditorEditEvent): Promise<boolean> {
    const target = this.blocks.find((b) => b.id === e.blockId)
    if (target) {
      if (e.text !== undefined) target.text = e.text
      if (e.decorator !== undefined) target.decorator = e.decorator
      this.onUpdated({
        blockId: target.id,
        text: target.text,
        decorator: target.decorator,
        userId: e.userId,
      })
      return true
    }
    return false
  }

  public async sendBlockCreate(e: EditorEditEvent): Promise<boolean> {
    if (!e.block) return false
    const index = this.blocks.findIndex((b) => b.id === e.afterBlockId)
    if (index === -1) {
      this.blocks.push(e.block)
    } else {
      this.blocks.splice(index + 1, 0, e.block)
    }
    this.onCreated({ block: e.block, afterBlockId: e.afterBlockId })
    return true
  }

  public async sendBlockDelete(e: EditorEditEvent): Promise<boolean> {
    if (!e.blockId) return false
    const index = this.blocks.findIndex((b) => b.id === e.blockId)
    if (index !== -1) {
      this.blocks.splice(index, 1)
      this.onDeleted({ blockId: e.blockId })
      return true
    }
    return false
  }

  public async sendBlockLock(_blockId: string): Promise<boolean> {
    return true
  }

  public async sendBlockUnlock(_blockId: string): Promise<boolean> {
    return true
  }

  public async sendTitleUpdate(title: string): Promise<boolean> {
    this.onTitleUpdated({ title })
    return true
  }

  public destroy(): void {
    this.blocks = []
  }
}
