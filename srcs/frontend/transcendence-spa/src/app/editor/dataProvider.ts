import {
  type Block,
  type ConnectionState,
  type DocumentPermission,
  type EditorDataProvider,
  type EditorEditEvent,
  type EditorInitEvent,
  type SyncConflict,
  type SyncOperation,
  type SyncResult,
  createBlock,
} from '@/app/editor/types'
import { escapeHtml, unescapeHtml } from '@/app/editor/textCodec'
import { i18n } from '@/i18n'

const isDocumentPermission = (value: unknown): value is DocumentPermission =>
  value === 'owner' || value === 'editor' || value === 'viewer'

const decodeBlock = (block: Block): Block => ({
  ...block,
  text: typeof block.text === 'string' ? unescapeHtml(block.text) : block.text,
})

const decodeBlocks = (blocks: Block[]): Block[] => blocks.map(decodeBlock)

const decodeTitle = (title?: string): string | undefined =>
  typeof title === 'string' ? unescapeHtml(title) : title

const decodeConflict = (conflict: SyncConflict): SyncConflict => ({
  ...conflict,
  block: conflict.block ? decodeBlock(conflict.block) : (conflict.block ?? null),
})

export type FatalConnectionReason = 'session-expired' | 'revoked' | 'not-found'

export class SyncConflictError extends Error {
  public readonly conflicts: SyncConflict[]

  constructor(conflicts: SyncConflict[]) {
    super('Sync conflict')
    this.name = 'SyncConflictError'
    this.conflicts = conflicts
  }
}

export interface WebSocketProviderOptions {
  documentId: string
  wsUrl?: string
  getHashes?: () => Promise<{ baseHash?: string; localHash?: string }>
  onOpen?: () => void
  onClose?: () => void
  onConnectionState?: (state: ConnectionState) => void
  onFatal?: (reason: FatalConnectionReason, message: string) => void
}

interface WsIncomingMessage {
  type: string
  documentId?: string
  permission?: DocumentPermission
  document?: {
    id: string
    title: string
    content?: string
  }
  unchanged?: boolean
  contentHash?: string
  locks?: Array<{
    blockId: string
    clientId?: string | null
    userId?: string | null
  }>
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
  requestId?: string
  conflicts?: SyncConflict[]
  applied?: number
}

interface PendingSync {
  resolve: (result: SyncResult) => void
  reject: (error: Error) => void
  timer: ReturnType<typeof setTimeout>
}

function resolveDefaultWsUrl(): string {
  if (typeof window === 'undefined') return 'ws://localhost:3001/api/ws'
  const isHttps = window.location.protocol === 'https:'
  const protocol = isHttps ? 'wss:' : 'ws:'
  return `${protocol}//${window.location.host}/api/ws`
}

const INITIAL_RECONNECT_DELAY_MS = 500
const MAX_RECONNECT_DELAY_MS = 30_000
const HEARTBEAT_INTERVAL_MS = 20_000
const PONG_TIMEOUT_MS = 10_000
const SYNC_TIMEOUT_MS = 15_000

export class WebSocketEditorDataProvider implements EditorDataProvider {
  public documentId: string
  public wsUrl: string
  public readonly clientId: string = crypto.randomUUID()
  private ws: WebSocket | null = null
  private isDestroyed = false
  private isFatal = false
  private joined = false
  private generation = 0
  private state: ConnectionState = 'connecting'
  private reconnectAttempt = 0
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null
  private pongTimer: ReturnType<typeof setTimeout> | null = null
  private contentHash: string | null = null
  private pendingSyncs = new Map<string, PendingSync>()
  private authCheckInFlight = false
  private getHashes?: () => Promise<{ baseHash?: string; localHash?: string }>
  private onOpenCallback?: () => void
  private onCloseCallback?: () => void
  private onConnectionStateCallback?: (state: ConnectionState) => void
  private onFatalCallback?: (reason: FatalConnectionReason, message: string) => void

  public onInit: (e: EditorInitEvent) => void = () => {}
  public onCreated: (e: { block: Block; afterBlockId?: string | null }) => void = () => {}
  public onUpdated: (e: {
    blockId: string
    text?: string
    decorator?: string
    userId?: string | null
  }) => void = () => {}
  public onDeleted: (e: { blockId: string }) => void = () => {}
  public onLocked: (e: { blockId: string; userId?: string | null; clientId?: string }) => void =
    () => {}
  public onUnlocked: (e: { blockId: string }) => void = () => {}
  public onTitleUpdated: (e: { title: string; userId?: string | null }) => void = () => {}
  public onPermission: (permission: DocumentPermission) => void = () => {}
  public onError: (e: { error: string }) => void = () => {}

  private readonly handleOnline = () => {
    if (this.isDestroyed || this.isFatal) return
    this.clearReconnectTimer()
    this.reconnectAttempt = 0
    this.connect()
  }

  private readonly handleOffline = () => {
    if (this.isDestroyed || this.isFatal) return
    this.clearReconnectTimer()
    this.setState('offline')
    if (this.ws) this.forceReconnect()
  }

  private readonly handleVisibility = () => {
    if (this.isDestroyed || this.isFatal) return
    if (document.visibilityState !== 'visible') return
    if (this.isOpen()) return
    this.clearReconnectTimer()
    this.connect()
  }

  constructor(options: WebSocketProviderOptions) {
    this.documentId = options.documentId
    this.wsUrl = options.wsUrl || resolveDefaultWsUrl()
    this.getHashes = options.getHashes
    this.onOpenCallback = options.onOpen
    this.onCloseCallback = options.onClose
    this.onConnectionStateCallback = options.onConnectionState
    this.onFatalCallback = options.onFatal

    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.handleOnline)
      window.addEventListener('offline', this.handleOffline)
      document.addEventListener('visibilitychange', this.handleVisibility)
    }

    this.connect()
  }

  private setState(next: ConnectionState) {
    if (this.state === next) return
    this.state = next
    this.onConnectionStateCallback?.(next)
  }

  private setFatal(error: string, reason: FatalConnectionReason) {
    this.isFatal = true
    this.setState('offline')
    this.rejectPendingSyncs(error)
    this.onError({ error })
    this.onFatalCallback?.(reason, error)
    this.clearReconnectTimer()
  }

  public connect(): void {
    if (this.isDestroyed || this.isFatal) return
    if (
      this.ws &&
      (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)
    ) {
      return
    }

    const generation = ++this.generation
    this.joined = false
    this.stopHeartbeat()
    if (this.reconnectAttempt > 0) this.setState('syncing')
    else this.setState('connecting')

    let ws: WebSocket
    try {
      ws = new WebSocket(this.wsUrl)
    } catch (err) {
      this.onError({
        error: err instanceof Error ? err.message : 'WebSocket connection failed',
      })
      this.scheduleReconnect()
      return
    }
    this.ws = ws

    ws.onopen = () => {
      if (generation !== this.generation || this.ws !== ws) return
      this.onOpenCallback?.()
      this.startHeartbeat()
      void this.sendJoin(generation)
    }

    ws.onmessage = (event: MessageEvent) => {
      if (generation !== this.generation || this.ws !== ws) return
      let msg: WsIncomingMessage
      try {
        msg = JSON.parse(event.data) as WsIncomingMessage
      } catch {
        return
      }
      this.handleMessage(msg)
    }

    ws.onclose = () => {
      if (generation !== this.generation || this.ws !== ws) return
      this.ws = null
      this.joined = false
      this.stopHeartbeat()
      this.rejectPendingSyncs('Connection lost')
      this.onCloseCallback?.()
      if (this.isDestroyed || this.isFatal) {
        this.setState('offline')
        return
      }
      this.scheduleReconnect()
    }

    ws.onerror = () => {
      // The close handler owns reconnect scheduling; surfacing every transient
      // socket error would spam the editor banner.
    }
  }

  private async sendJoin(generation: number): Promise<void> {
    let hashes: { baseHash?: string; localHash?: string } = {}
    try {
      hashes = (await this.getHashes?.()) ?? {}
    } catch {
      hashes = {}
    }
    if (generation !== this.generation || !this.isSocketOpen()) return
    this.sendRaw({
      type: 'join',
      documentId: this.documentId,
      baseHash: hashes.baseHash,
      localHash: hashes.localHash,
    })
  }

  private handleMessage(msg: WsIncomingMessage): void {
    switch (msg.type) {
      case 'init': {
        let blocks: Block[] = []
        if (msg.document?.content) {
          try {
            const parsed = JSON.parse(msg.document.content)
            if (Array.isArray(parsed)) blocks = parsed
          } catch {
            // The backend normalizes legacy content before sending init.
          }
        }
        this.joined = true
        this.reconnectAttempt = 0
        this.contentHash = msg.contentHash ?? null
        this.setState('connected')
        this.onInit({
          blocks: decodeBlocks(blocks),
          documentId: msg.document?.id,
          title: decodeTitle(msg.document?.title),
          permission: msg.permission,
          unchanged: Boolean(msg.unchanged),
          contentHash: msg.contentHash,
          locks: msg.locks,
        })
        break
      }

      case 'sync_ok': {
        this.contentHash = msg.contentHash ?? this.contentHash
        const pending = msg.requestId ? this.pendingSyncs.get(msg.requestId) : undefined
        if (pending && msg.requestId) {
          clearTimeout(pending.timer)
          this.pendingSyncs.delete(msg.requestId)
          pending.resolve({
            contentHash: msg.contentHash ?? '',
            applied: msg.applied,
          })
        }
        break
      }

      case 'sync_conflict': {
        const pending = msg.requestId ? this.pendingSyncs.get(msg.requestId) : undefined
        if (pending && msg.requestId) {
          clearTimeout(pending.timer)
          this.pendingSyncs.delete(msg.requestId)
          pending.reject(new SyncConflictError((msg.conflicts ?? []).map(decodeConflict)))
        }
        break
      }

      case 'sync_error': {
        const pending = msg.requestId ? this.pendingSyncs.get(msg.requestId) : undefined
        if (pending && msg.requestId) {
          clearTimeout(pending.timer)
          this.pendingSyncs.delete(msg.requestId)
          pending.reject(new Error(msg.error || 'Sync failed'))
        }
        break
      }

      case 'permission':
        if (msg.documentId === this.documentId && isDocumentPermission(msg.permission)) {
          this.onPermission(msg.permission)
        }
        break

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
        if (msg.blockId) this.onDeleted({ blockId: msg.blockId })
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
        if (msg.blockId) this.onUnlocked({ blockId: msg.blockId })
        break

      case 'title_updated':
        if (msg.title) {
          this.onTitleUpdated({ title: unescapeHtml(msg.title), userId: msg.userId })
        }
        break

      case 'update':
        if (typeof msg.content === 'string') {
          try {
            const parsed = JSON.parse(msg.content)
            if (Array.isArray(parsed)) {
              this.contentHash = msg.contentHash ?? this.contentHash
              this.onInit({
                blocks: decodeBlocks(parsed),
                documentId: msg.documentId,
                unchanged: false,
                contentHash: msg.contentHash,
              })
            }
          } catch {
            // Ignore non-block string updates.
          }
        }
        break

      case 'pong':
        this.clearPongTimer()
        break

      case 'error':
        if (msg.error === 'Document not found') {
          this.setFatal(msg.error, 'not-found')
        } else if (msg.error === 'Session expired') {
          this.setFatal(i18n.global.t('errors.sessionExpired'), 'session-expired')
        } else {
          this.onError({ error: msg.error || 'Server error' })
        }
        break

      case 'revoked':
        this.setFatal('Access to document was revoked', 'revoked')
        break

      case 'session_expired':
        this.setFatal(i18n.global.t('errors.sessionExpired'), 'session-expired')
        break
    }
  }

  private scheduleReconnect(): void {
    if (this.isDestroyed || this.isFatal) return
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      this.setState('offline')
      return
    }
    this.reconnectAttempt += 1
    if (this.reconnectAttempt >= 3) void this.checkSession()
    const exponential = Math.min(
      MAX_RECONNECT_DELAY_MS,
      INITIAL_RECONNECT_DELAY_MS * 2 ** Math.min(this.reconnectAttempt - 1, 6),
    )
    const delay = exponential + Math.floor(Math.random() * 300)
    this.setState('reconnecting')
    this.clearReconnectTimer()
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.connect()
    }, delay)
  }

  private async checkSession(): Promise<void> {
    if (this.authCheckInFlight || this.isDestroyed || this.isFatal) return
    this.authCheckInFlight = true
    try {
      const response = await fetch('/api/auth/me', {
        credentials: 'include',
        signal: AbortSignal.timeout(5000),
      })
      const body = (await response.json().catch(() => null)) as { loggedIn?: boolean } | null
      if (response.status === 401 || body?.loggedIn === false) {
        this.setFatal(i18n.global.t('errors.sessionExpired'), 'session-expired')
      }
    } catch {
      // Network failures are handled by the reconnect loop.
    } finally {
      this.authCheckInFlight = false
    }
  }

  private clearReconnectTimer() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }

  private startHeartbeat() {
    this.stopHeartbeat()
    this.heartbeatTimer = setInterval(() => {
      if (!this.isOpen() || this.pongTimer) return
      this.sendRaw({ type: 'ping', timestamp: Date.now() })
      this.pongTimer = setTimeout(() => {
        this.pongTimer = null
        this.forceReconnect()
      }, PONG_TIMEOUT_MS)
    }, HEARTBEAT_INTERVAL_MS)
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
    this.clearPongTimer()
  }

  private clearPongTimer() {
    if (this.pongTimer) {
      clearTimeout(this.pongTimer)
      this.pongTimer = null
    }
  }

  private forceReconnect() {
    const ws = this.ws
    if (!ws) return
    this.ws = null
    this.joined = false
    this.stopHeartbeat()
    this.generation += 1
    ws.onopen = null
    ws.onmessage = null
    ws.onclose = null
    ws.onerror = null
    ws.close()
    this.rejectPendingSyncs('Connection lost')
    this.onCloseCallback?.()
    this.scheduleReconnect()
  }

  private isSocketOpen(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN
  }

  private isOpen(): boolean {
    return this.isSocketOpen() && this.joined
  }

  private rejectPendingSyncs(message: string) {
    for (const pending of this.pendingSyncs.values()) {
      clearTimeout(pending.timer)
      pending.reject(new Error(message))
    }
    this.pendingSyncs.clear()
  }

  private sendRaw(data: unknown): boolean {
    if (!this.isSocketOpen() || !this.ws) return false
    this.ws.send(JSON.stringify(data))
    return true
  }

  public getConnectionState(): ConnectionState {
    return this.state
  }

  public getContentHash(): string | null {
    return this.contentHash
  }

  public async sendEdit(e: EditorEditEvent): Promise<boolean> {
    if (!this.isOpen()) return false
    return this.sendRaw({
      type: 'block_edit',
      documentId: this.documentId,
      blockId: e.blockId,
      text: typeof e.text === 'string' ? escapeHtml(e.text) : e.text,
      decorator: e.decorator,
    })
  }

  public async sendBlockCreate(e: EditorEditEvent): Promise<boolean> {
    if (!this.isOpen()) return false
    return this.sendRaw({
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
  }

  public async sendBlockDelete(e: EditorEditEvent): Promise<boolean> {
    if (!this.isOpen()) return false
    return this.sendRaw({
      type: 'block_delete',
      documentId: this.documentId,
      blockId: e.blockId,
    })
  }

  public async sendBlockLock(blockId: string): Promise<boolean> {
    if (!this.isOpen()) return false
    return this.sendRaw({
      type: 'block_lock',
      documentId: this.documentId,
      blockId,
      clientId: this.clientId,
    })
  }

  public async sendBlockUnlock(blockId: string): Promise<boolean> {
    if (!this.isOpen()) return false
    return this.sendRaw({
      type: 'block_unlock',
      documentId: this.documentId,
      blockId,
      clientId: this.clientId,
    })
  }

  public async sendTitleUpdate(title: string): Promise<boolean> {
    if (!this.isOpen()) return false
    return this.sendRaw({
      type: 'title_update',
      documentId: this.documentId,
      title: escapeHtml(title),
    })
  }

  public sendSync(ops: SyncOperation[]): Promise<SyncResult> {
    if (!this.isOpen()) {
      return Promise.reject(new Error('Not connected'))
    }
    if (ops.length === 0) {
      return Promise.resolve({ contentHash: this.contentHash ?? '', applied: 0 })
    }

    const requestId = crypto.randomUUID()
    const encodedOps = ops.map((op) => {
      if (op.kind === 'set') {
        return {
          ...op,
          text: op.text !== undefined ? escapeHtml(op.text) : undefined,
        }
      }
      if (op.kind === 'create') {
        return {
          ...op,
          block: { ...op.block, text: escapeHtml(op.block.text) },
        }
      }
      if (op.kind === 'title') {
        return {
          ...op,
          title: escapeHtml(op.title),
          expectedTitle: op.expectedTitle !== undefined ? escapeHtml(op.expectedTitle) : undefined,
        }
      }
      return op
    })

    return new Promise<SyncResult>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingSyncs.delete(requestId)
        reject(new Error('Sync timed out'))
      }, SYNC_TIMEOUT_MS)
      this.pendingSyncs.set(requestId, { resolve, reject, timer })
      const sent = this.sendRaw({
        type: 'sync',
        documentId: this.documentId,
        requestId,
        ops: encodedOps,
      })
      if (!sent) {
        clearTimeout(timer)
        this.pendingSyncs.delete(requestId)
        reject(new Error('Not connected'))
      }
    })
  }

  public destroy(): void {
    this.isDestroyed = true
    this.clearReconnectTimer()
    this.stopHeartbeat()
    this.rejectPendingSyncs('Connection closed')
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.handleOnline)
      window.removeEventListener('offline', this.handleOffline)
      document.removeEventListener('visibilitychange', this.handleVisibility)
    }
    const ws = this.ws
    this.ws = null
    this.joined = false
    this.generation += 1
    if (ws) {
      ws.onopen = null
      ws.onmessage = null
      ws.onclose = null
      ws.onerror = null
      ws.close()
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
  public onLocked: (e: { blockId: string; userId?: string | null; clientId?: string }) => void =
    () => {}
  public onUnlocked: (e: { blockId: string }) => void = () => {}
  public onTitleUpdated: (e: { title: string; userId?: string | null }) => void = () => {}
  public onPermission: (permission: DocumentPermission) => void = () => {}
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

  public getConnectionState(): ConnectionState {
    return 'connected'
  }

  public async sendSync(ops: SyncOperation[]): Promise<SyncResult> {
    return { contentHash: '', applied: ops.length }
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

  public async sendBlockLock(): Promise<boolean> {
    return true
  }

  public async sendBlockUnlock(): Promise<boolean> {
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
