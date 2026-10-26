import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import {
  createBlock,
  type Block,
  type BlockType,
  type ConnectionState,
  type SyncOperation,
} from '@/app/editor/types'
import { useAuthStore } from '@/stores/auth'
import type { SupportedLanguage } from '@/app/editor/translation.api'
import type { BaseSnapshot, BlockConflict, TitleConflict } from '@/app/editor/merge'
import { createBaseSnapshot } from '@/app/editor/merge'
import { fingerprintBlock, hashBlocks } from '@/app/editor/contentHash'
import type { EditorDraft } from '@/app/editor/draftStorage'

export const useEditorStore = defineStore('editor', () => {
  const blocks = ref<Block[]>([])
  const activeBlockId = ref<string | null>(null)
  const clientId = ref<string>('')
  const authStore = useAuthStore()

  const documentId = ref<string | null>(null)
  const title = ref<string>('')
  const base = ref<BaseSnapshot | null>(null)
  const conflicts = ref<Record<string, BlockConflict>>({})
  const titleConflict = ref<TitleConflict | null>(null)
  const connectionState = ref<ConnectionState>('connecting')
  const isSyncing = ref(false)
  const syncError = ref<string | null>(null)
  const syncRequest = ref(0)
  const conflictCount = computed(() => Object.keys(conflicts.value).length)
  const hasConflicts = computed(() => conflictCount.value > 0 || titleConflict.value !== null)

  // Translation & Canonical Language State
  const activeLanguage = ref<SupportedLanguage>('en')
  const canonicalEnglishMap = ref<Map<string, string>>(new Map())
  const dirtyBlockIds = ref<Set<string>>(new Set())
  const isTranslating = ref<boolean>(false)
  const translationError = ref<string | null>(null)
  const translationProgress = ref<{ done: number; total: number } | null>(null)

  const activeBlock = computed(
    () => blocks.value.find((block) => block.id === activeBlockId.value) ?? null,
  )

  const activeIndex = computed(() =>
    blocks.value.findIndex((block) => block.id === activeBlockId.value),
  )

  const elaboratingBlockId = ref<string | null>(null)
  const isElaborating = computed(() => elaboratingBlockId.value !== null)

  function beginElaboration(id: string) {
    elaboratingBlockId.value = id
  }

  function endElaboration() {
    elaboratingBlockId.value = null
  }

  function previewBlockText(id: string, text: string) {
    const index = blocks.value.findIndex((item) => item.id === id)
    const current = blocks.value[index]
    if (index !== -1 && current) {
      blocks.value[index] = { ...current, text }
    }
  }

  function setClientId(id: string) {
    clientId.value = id
  }

  function setDocumentId(id: string | null) {
    documentId.value = id
  }

  function startSession(id: string, nextTitle: string) {
    documentId.value = id
    title.value = nextTitle
    blocks.value = []
    activeBlockId.value = null
    base.value = null
    conflicts.value = {}
    titleConflict.value = null
    canonicalEnglishMap.value = new Map()
    dirtyBlockIds.value = new Set()
    syncError.value = null
    isSyncing.value = false
    connectionState.value = 'connecting'
    isTranslating.value = false
    translationError.value = null
    translationProgress.value = null
  }

  function setTitle(next: string) {
    title.value = next
  }

  function setConnectionState(next: ConnectionState) {
    connectionState.value = next
  }

  function setSyncing(next: boolean) {
    isSyncing.value = next
  }

  function setSyncError(next: string | null) {
    syncError.value = next
  }

  function requestSync() {
    syncRequest.value += 1
  }

  function setBase(next: BaseSnapshot | null) {
    base.value = next
  }

  async function setBaseFromBlocks(nextBlocks: Block[], nextTitle: string, contentHash: string) {
    base.value = await createBaseSnapshot(nextBlocks, nextTitle, contentHash)
  }

  function setConflicts(next: Record<string, BlockConflict>) {
    conflicts.value = { ...next }
  }

  function setTitleConflict(next: TitleConflict | null) {
    titleConflict.value = next
  }

  function getConflict(blockId: string): BlockConflict | null {
    return conflicts.value[blockId] ?? null
  }

  function removeConflict(blockId: string) {
    const next = { ...conflicts.value }
    delete next[blockId]
    conflicts.value = next
  }

  function setConflict(conflict: BlockConflict) {
    conflicts.value = { ...conflicts.value, [conflict.blockId]: conflict }
  }

  function updateConflictLocal(blockId: string, text: string, decorator: string) {
    const conflict = conflicts.value[blockId]
    if (!conflict || !conflict.local) return
    conflicts.value = {
      ...conflicts.value,
      [blockId]: { ...conflict, local: { text, decorator } },
    }
  }

  function updateConflictRemote(
    blockId: string,
    remote: { text: string; decorator: string } | null,
    remoteFingerprint: string | null,
  ) {
    const conflict = conflicts.value[blockId]
    if (!conflict) return
    const remoteMissing = remote === null
    conflicts.value = {
      ...conflicts.value,
      [blockId]: {
        ...conflict,
        remote,
        remoteFingerprint,
        kind:
          conflict.kind === 'local-deleted' && remoteMissing
            ? 'local-deleted'
            : remoteMissing
              ? 'remote-deleted'
              : conflict.kind === 'remote-deleted'
                ? 'diff'
                : conflict.kind,
      },
    }
  }

  async function recordBaseOperation(
    op: SyncOperation,
    localBlock: Block | null,
    contentHash: string,
    nextTitle?: string,
  ) {
    const current = base.value
    if (!current) return
    if (op.kind === 'title') {
      base.value = {
        ...current,
        contentHash,
        title: nextTitle ?? op.title,
      }
      return
    }

    const nextBlocks = current.blocks.slice()
    if (op.kind === 'set' && localBlock) {
      const confirmedBlock = {
        id: op.blockId,
        text: op.text ?? localBlock.text,
        decorator: op.decorator ?? localBlock.decorator,
        lockedBy: null,
      }
      const fingerprint = await fingerprintBlock(confirmedBlock)
      const index = nextBlocks.findIndex((block) => block.id === op.blockId)
      if (index !== -1) nextBlocks[index] = { id: op.blockId, fingerprint }
      else nextBlocks.push({ id: op.blockId, fingerprint })
    } else if (op.kind === 'create') {
      const created = op.block
      const fingerprint = await fingerprintBlock(created)
      const existingIndex = nextBlocks.findIndex((block) => block.id === created.id)
      if (existingIndex !== -1) {
        nextBlocks[existingIndex] = { id: created.id, fingerprint }
      } else {
        const afterIndex = op.afterBlockId
          ? nextBlocks.findIndex((block) => block.id === op.afterBlockId)
          : -1
        if (afterIndex !== -1) nextBlocks.splice(afterIndex + 1, 0, { id: created.id, fingerprint })
        else nextBlocks.push({ id: created.id, fingerprint })
      }
    } else if (op.kind === 'delete') {
      const index = nextBlocks.findIndex((block) => block.id === op.blockId)
      if (index !== -1) nextBlocks.splice(index, 1)
    }

    base.value = {
      contentHash,
      title: nextTitle ?? current.title,
      blocks: nextBlocks,
    }
  }

  async function setBaseBlockFingerprint(blockId: string, block: Block) {
    const current = base.value
    if (!current) return
    const fingerprint = await fingerprintBlock(block)
    const nextBlocks = current.blocks.slice()
    const index = nextBlocks.findIndex((item) => item.id === blockId)
    if (index !== -1) nextBlocks[index] = { id: blockId, fingerprint }
    else nextBlocks.push({ id: blockId, fingerprint })
    base.value = { ...current, blocks: nextBlocks }
  }

  function removeBaseBlockFingerprint(blockId: string) {
    const current = base.value
    if (!current) return
    const nextBlocks = current.blocks.filter((block) => block.id !== blockId)
    base.value = { ...current, blocks: nextBlocks }
  }

  function restoreDraft(draft: EditorDraft) {
    documentId.value = draft.documentId
    title.value = draft.title
    blocks.value = draft.blocks
    base.value = draft.base
    activeLanguage.value = draft.activeLanguage
    canonicalEnglishMap.value = new Map(Object.entries(draft.canonicalEnglish))
    dirtyBlockIds.value = new Set(draft.dirtyBlockIds)
    conflicts.value = { ...draft.conflicts }
    titleConflict.value = draft.titleConflict
    const firstAvailable = draft.blocks.find((block) => !block.lockedBy) ?? draft.blocks[0] ?? null
    activeBlockId.value = firstAvailable?.id ?? null
  }

  function createDraft(userId: string): EditorDraft | null {
    if (!documentId.value) return null
    return {
      version: 1,
      documentId: documentId.value,
      userId,
      savedAt: Date.now(),
      base: base.value,
      blocks: blocks.value,
      title: title.value,
      activeLanguage: activeLanguage.value,
      canonicalEnglish: Object.fromEntries(canonicalEnglishMap.value),
      dirtyBlockIds: [...dirtyBlockIds.value],
      conflicts: conflicts.value,
      titleConflict: titleConflict.value,
    }
  }

  function getCanonicalBlocks(): Block[] {
    if (activeLanguage.value === 'en') return blocks.value.map((block) => ({ ...block }))
    return blocks.value.map((block) => ({
      ...block,
      text: canonicalEnglishMap.value.get(block.id) ?? block.text,
    }))
  }

  async function computeLocalContentHash(): Promise<string | undefined> {
    if (activeLanguage.value !== 'en' && dirtyBlockIds.value.size > 0) return undefined
    return hashBlocks(getCanonicalBlocks())
  }

  function applyRemoteTitle(remoteTitle: string) {
    if (titleConflict.value) {
      titleConflict.value = { ...titleConflict.value, remote: remoteTitle }
      return
    }
    const localTitle = title.value
    const baseTitle = base.value?.title ?? localTitle
    if (localTitle !== baseTitle && localTitle !== remoteTitle) {
      titleConflict.value = { local: localTitle, remote: remoteTitle }
      return
    }
    title.value = remoteTitle
    if (base.value && (localTitle === baseTitle || localTitle === remoteTitle)) {
      base.value = { ...base.value, title: remoteTitle }
    }
  }

  function initCanonicalBlocks(next: Block[]) {
    for (const b of next) {
      if (b && b.id) {
        canonicalEnglishMap.value.set(b.id, b.text)
      }
    }
  }

  function setLanguage(lang: SupportedLanguage) {
    activeLanguage.value = lang
    if (lang === 'en') {
      // Instantly restore canonical English with zero API latency and zero drift
      for (const b of blocks.value) {
        if (canonicalEnglishMap.value.has(b.id)) {
          b.text = canonicalEnglishMap.value.get(b.id)!
        }
      }
      dirtyBlockIds.value.clear()
    }
  }

  function getCanonicalText(id: string): string {
    return canonicalEnglishMap.value.get(id) ?? blocks.value.find((b) => b.id === id)?.text ?? ''
  }

  function setCanonicalText(id: string, text: string) {
    canonicalEnglishMap.value.set(id, text)
  }

  function markBlockDirty(id: string) {
    dirtyBlockIds.value.add(id)
  }

  function clearBlockDirty(id: string) {
    dirtyBlockIds.value.delete(id)
  }

  function isBlockDirty(id: string): boolean {
    return dirtyBlockIds.value.has(id)
  }

  function applyTranslations(translated: { id: string; text: string }[]) {
    const tMap = new Map(translated.map((t) => [t.id, t.text]))
    for (const block of blocks.value) {
      if (tMap.has(block.id)) {
        block.text = tMap.get(block.id)!
      }
    }
  }

  function applyRemoteText(id: string, text: string) {
    const index = blocks.value.findIndex((item) => item.id === id)
    const current = blocks.value[index]
    if (index !== -1 && current) {
      blocks.value[index] = { ...current, text }
    }
  }

  function startTranslationProgress(total: number) {
    translationProgress.value = { done: 0, total }
  }

  function setTranslationProgress(done: number) {
    if (!translationProgress.value) return
    translationProgress.value = {
      done: Math.min(Math.max(0, done), translationProgress.value.total),
      total: translationProgress.value.total,
    }
  }

  function finishTranslationProgress() {
    translationProgress.value = null
  }

  function setBlocks(next: Block[]) {
    blocks.value = next
    if (activeLanguage.value === 'en' || canonicalEnglishMap.value.size === 0) {
      initCanonicalBlocks(next)
    }
    if (!next.some((block) => block.id === activeBlockId.value)) {
      const firstAvailable = next.find((b) => !isLockedByOther(b)) ?? next[0]
      activeBlockId.value = firstAvailable?.id ?? null
    }
  }

  function setActive(id: string) {
    activeBlockId.value = id
  }

  function addBlock(type: BlockType, text = ''): Block {
    const block = createBlock(type, text)
    const index = activeIndex.value
    const at = index === -1 ? blocks.value.length : index + 1
    blocks.value.splice(at, 0, block)
    activeBlockId.value = block.id
    if (activeLanguage.value === 'en') {
      setCanonicalText(block.id, text)
    } else {
      markBlockDirty(block.id)
    }
    return block
  }

  function insertBlock(block: Block, afterBlockId?: string | null) {
    if (blocks.value.some((b) => b.id === block.id)) {
      // Already present, ignore duplicate insert
      return
    }
    if (activeLanguage.value === 'en' || !canonicalEnglishMap.value.has(block.id)) {
      setCanonicalText(block.id, block.text)
    }
    if (!afterBlockId) {
      blocks.value.push(block)
      return
    }
    const index = blocks.value.findIndex((b) => b.id === afterBlockId)
    if (index === -1) {
      blocks.value.push(block)
    } else {
      blocks.value.splice(index + 1, 0, block)
    }
  }

  function removeBlock(blockId: string) {
    const index = blocks.value.findIndex((b) => b.id === blockId)
    if (index === -1) return
    blocks.value.splice(index, 1)
    canonicalEnglishMap.value.delete(blockId)
    dirtyBlockIds.value.delete(blockId)
    if (activeBlockId.value === blockId) {
      const next = blocks.value[index] ?? blocks.value[index - 1] ?? null
      activeBlockId.value = next?.id ?? null
    }
  }

  function deleteActiveBlock(): string | null {
    const id = activeBlockId.value
    if (id) {
      removeBlock(id)
    }
    return id
  }

  function updateBlockText(id: string, text: string) {
    const index = blocks.value.findIndex((item) => item.id === id)
    const current = blocks.value[index]
    if (index !== -1 && current) {
      blocks.value[index] = { ...current, text }
      if (activeLanguage.value === 'en') {
        setCanonicalText(id, text)
      } else {
        markBlockDirty(id)
      }
    }
  }

  function updateBlockDecorator(id: string, decorator: string) {
    const index = blocks.value.findIndex((item) => item.id === id)
    const current = blocks.value[index]
    if (index !== -1 && current) {
      blocks.value[index] = { ...current, decorator }
    }
  }

  function isLockedByOther(block: Block): boolean {
    if (!block.lockedBy) return false
    if (clientId.value) {
      return block.lockedBy !== clientId.value
    }
    if (authStore.userId) {
      return block.lockedBy !== authStore.userId
    }
    return true
  }

  function lock(id: string, lockHolder?: string) {
    const block = blocks.value.find((item) => item.id === id)
    if (!block) return
    const holder = lockHolder || clientId.value || authStore.userId || 'locked'
    block.lockedBy = holder
  }

  function unlock(id: string) {
    const block = blocks.value.find((item) => item.id === id)
    if (!block) return
    const myId = clientId.value || authStore.userId
    if (!block.lockedBy || !myId || block.lockedBy === myId) {
      block.lockedBy = null
    }
  }

  function unlockBlockById(id: string) {
    const block = blocks.value.find((item) => item.id === id)
    if (block) {
      block.lockedBy = null
    }
  }

  function clearLocks() {
    for (const block of blocks.value) block.lockedBy = null
  }

  return {
    blocks,
    activeBlockId,
    activeBlock,
    activeIndex,
    elaboratingBlockId,
    isElaborating,
    clientId,
    activeLanguage,
    canonicalEnglishMap,
    dirtyBlockIds,
    isTranslating,
    translationError,
    translationProgress,
    documentId,
    title,
    base,
    conflicts,
    titleConflict,
    connectionState,
    isSyncing,
    syncError,
    syncRequest,
    conflictCount,
    hasConflicts,
    setClientId,
    setDocumentId,
    startSession,
    setTitle,
    setConnectionState,
    setSyncing,
    setSyncError,
    requestSync,
    setBase,
    setBaseFromBlocks,
    setConflicts,
    setTitleConflict,
    getConflict,
    removeConflict,
    setConflict,
    updateConflictLocal,
    updateConflictRemote,
    recordBaseOperation,
    setBaseBlockFingerprint,
    removeBaseBlockFingerprint,
    restoreDraft,
    createDraft,
    getCanonicalBlocks,
    computeLocalContentHash,
    applyRemoteTitle,
    beginElaboration,
    endElaboration,
    previewBlockText,
    setBlocks,
    setActive,
    addBlock,
    insertBlock,
    removeBlock,
    deleteActiveBlock,
    updateText: updateBlockText,
    updateBlockText,
    updateBlockDecorator,
    isLockedByOther,
    lock,
    unlock,
    unlockBlockById,
    clearLocks,
    initCanonicalBlocks,
    setLanguage,
    getCanonicalText,
    setCanonicalText,
    markBlockDirty,
    clearBlockDirty,
    isBlockDirty,
    applyTranslations,
    applyRemoteText,
    startTranslationProgress,
    setTranslationProgress,
    finishTranslationProgress,
  }
})
