<template>
  <div class="editor" :class="[`editor--nav-${navPosition}`]">
    <!-- Nav toolbar (can be positioned on top, left or bottom) -->
    <EditorNav
      v-if="navPosition !== 'bottom'"
      :active-block-id="store.activeBlockId"
      :active-block="store.activeBlock"
      :delete-disabled="isDeleteDisabled"
      :position="navPosition"
      @add="onAdd"
      @delete="onDelete"
      @update:decorator="onUpdateDecorator(store.activeBlock, $event)"
    />

    <!-- Editor content: expands with the page by default, or scrollable if scrollable prop is true -->
    <div
      class="editor__content"
      :class="{ 'editor__content--scrollable': scrollable }"
    >
      <EditorBlock
        v-for="block in store.blocks"
        :key="block.id"
        :block="block"
        :active="block.id === store.activeBlockId && !store.isLockedByOther(block)"
        :locked="store.isLockedByOther(block)"
        @focus="onFocus(block)"
        @blur="onBlur(block)"
        @update:text="onUpdateText(block, $event)"
        @update:decorator="onUpdateDecorator(block, parseDecorator($event))"
      />

      <p v-if="store.blocks.length === 0" class="editor__empty">
        This document is empty. Add a block from the toolbar.
      </p>
    </div>

    <!-- Bottom Nav toolbar if navPosition is bottom -->
    <EditorNav
      v-if="navPosition === 'bottom'"
      :active-block-id="store.activeBlockId"
      :active-block="store.activeBlock"
      :delete-disabled="isDeleteDisabled"
      :position="navPosition"
      @add="onAdd"
      @delete="onDelete"
      @update:decorator="onUpdateDecorator(store.activeBlock, $event)"
    />
  </div>
</template>

<script lang="ts" setup>
import { computed, onBeforeUnmount, onMounted, watch } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import EditorBlock from '@/app/components/EditorBlock.vue'
import EditorNav from '@/app/components/EditorNav.vue'
import { useEditorStore } from '@/stores/editor'
import { isStandardText } from '@/app/editor/useEditable'
import { translateBlocks, backTranslateBlock } from '@/app/editor/translation.api'
import {
  createBlock,
  parseDecorator,
  serializeDecorator,
  type Block,
  type BlockDecorator,
  type BlockType,
  type EditorDataProvider,
} from '@/app/editor/types'

const props = withDefaults(
  defineProps<{
    provider: EditorDataProvider
    scrollable?: boolean
    navPosition?: 'top' | 'left' | 'bottom'
  }>(),
  {
    scrollable: false,
    navPosition: 'top',
  },
)

const emit = defineEmits<{
  error: [error: string]
}>()

const store = useEditorStore()

const isDeleteDisabled = computed(() => {
  if (!store.activeBlock) return true
  return store.isLockedByOther(store.activeBlock)
})

const EDIT_DEBOUNCE_MS = 2000
const LOCK_TIMEOUT_MS = 5000

let editDebounceTimer: ReturnType<typeof setTimeout> | null = null
let lockTimeoutTimer: ReturnType<typeof setTimeout> | null = null
let pendingEditBlockId: string | null = null
let pendingEditText: string | null = null
let pendingEditDecorator: string | null = null

function hasPendingData(): boolean {
  return Boolean(editDebounceTimer || (pendingEditBlockId !== null && pendingEditText !== null))
}

function getSurroundingContext(blockId: string): string {
  const index = store.blocks.findIndex((b) => b.id === blockId)
  if (index === -1) return ''
  const prev = store.blocks[index - 1]?.text ?? ''
  const next = store.blocks[index + 1]?.text ?? ''
  return [prev ? `Previous: ${prev}` : '', next ? `Next: ${next}` : ''].filter(Boolean).join('\n')
}

async function flushPendingEdit(): Promise<boolean> {
  if (editDebounceTimer) {
    clearTimeout(editDebounceTimer)
    editDebounceTimer = null
  }
  if (pendingEditBlockId && pendingEditText !== null) {
    const blockId = pendingEditBlockId
    let textToSend = pendingEditText
    const decorator = pendingEditDecorator ?? undefined
    pendingEditBlockId = null
    pendingEditText = null
    pendingEditDecorator = null

    // If edited in non-English mode, back-translate dirty block to English before saving to DB/WS
    if (store.activeLanguage !== 'en' && store.isBlockDirty(blockId)) {
      try {
        const surroundingContext = getSurroundingContext(blockId)
        const canonical = await backTranslateBlock(
          textToSend,
          store.activeLanguage,
          'en',
          surroundingContext,
        )
        store.setCanonicalText(blockId, canonical)
        store.clearBlockDirty(blockId)
        textToSend = canonical
      } catch (err) {
        console.error('Back-translation failed during save:', err)
      }
    }

    return await props.provider.sendEdit({
      blockId,
      text: textToSend,
      decorator,
    })
  }
  return true
}

function handleBeforeUnload(event: BeforeUnloadEvent) {
  if (hasPendingData()) {
    flushPendingEdit()
    event.preventDefault()
    event.returnValue = ''
  }
}

function resetLockTimeout(blockId: string) {
  if (lockTimeoutTimer) {
    clearTimeout(lockTimeoutTimer)
    lockTimeoutTimer = null
  }

  lockTimeoutTimer = setTimeout(async () => {
    // 5 seconds elapsed without any new edit -> lock timeout expires!
    flushPendingEdit()
    store.unlock(blockId)
    await props.provider.sendBlockUnlock?.(blockId)
    lockTimeoutTimer = null
  }, LOCK_TIMEOUT_MS)
}

function clearLockTimers() {
  if (editDebounceTimer) {
    clearTimeout(editDebounceTimer)
    editDebounceTimer = null
  }
  if (lockTimeoutTimer) {
    clearTimeout(lockTimeoutTimer)
    lockTimeoutTimer = null
  }
  pendingEditBlockId = null
  pendingEditText = null
  pendingEditDecorator = null
}

function wireProvider(provider: EditorDataProvider) {
  if ('clientId' in provider && typeof (provider as { clientId?: unknown }).clientId === 'string') {
    store.setClientId((provider as { clientId: string }).clientId)
  }

  provider.onInit = (e) => {
    store.initCanonicalBlocks(e.blocks)
    store.setBlocks(e.blocks)
    if (store.activeLanguage !== 'en') {
      const payload = e.blocks.map((b) => ({ id: b.id, text: b.text }))
      translateBlocks(payload, 'en', store.activeLanguage)
        .then((res) => {
          store.applyTranslations(res)
        })
        .catch((err) => console.error('Failed to translate initial blocks:', err))
    }
  }

  provider.onCreated = (e) => {
    store.insertBlock(e.block, e.afterBlockId)
    if (store.activeLanguage !== 'en') {
      translateBlocks([{ id: e.block.id, text: e.block.text }], 'en', store.activeLanguage)
        .then((res) => {
          if (res.length > 0) {
            store.applyTranslations(res)
          }
        })
        .catch((err) => console.error('Failed to translate newly created block:', err))
    }
  }

  provider.onUpdated = (e) => {
    if (e.text !== undefined) {
      store.setCanonicalText(e.blockId, e.text)
      if (store.activeLanguage === 'en') {
        store.updateBlockText(e.blockId, e.text)
      } else {
        // If local user is not actively editing this block, translate it to activeLanguage
        if (store.activeBlockId !== e.blockId) {
          translateBlocks([{ id: e.blockId, text: e.text }], 'en', store.activeLanguage)
            .then((res) => {
              const first = res[0]
              if (first && store.activeLanguage !== 'en') {
                store.updateBlockText(e.blockId, first.text)
              }
            })
            .catch((err) => console.error('Failed to translate updated block:', err))
        }
      }
    }
    if (e.decorator !== undefined) {
      store.updateBlockDecorator(e.blockId, e.decorator)
    }
  }

  provider.onDeleted = (e) => {
    store.removeBlock(e.blockId)
  }

  provider.onLocked = (e) => {
    if (e.clientId && e.clientId !== store.clientId) {
      if (store.activeBlockId === e.blockId) {
        // Race condition: another client acquired the lock first! Drop uncommitted local edits
        clearLockTimers()
      }
    }
    store.lock(e.blockId, e.clientId || e.userId || 'remote')
  }

  provider.onUnlocked = (e) => {
    store.unlockBlockById(e.blockId)
  }

  provider.onError = (e) => {
    emit('error', e.error)
  }
}

onMounted(() => {
  wireProvider(props.provider)
  window.addEventListener('beforeunload', handleBeforeUnload)
})

onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', handleBeforeUnload)
  flushPendingEdit()
  clearLockTimers()
  if (store.activeBlockId && !store.isLockedByOther({ id: store.activeBlockId } as Block)) {
    props.provider.sendBlockUnlock?.(store.activeBlockId)
  }
})

onBeforeRouteLeave(async () => {
  if (hasPendingData()) {
    const success = await flushPendingEdit()
    if (!success) {
      const confirmLeave = window.confirm(
        'Pending changes could not be saved to the server. Are you sure you want to leave?',
      )
      if (!confirmLeave) {
        return false
      }
    }
  }
  if (store.activeBlockId && !store.isLockedByOther({ id: store.activeBlockId } as Block)) {
    const activeId = store.activeBlockId
    clearLockTimers()
    store.unlock(activeId)
    store.setActive('')
    await props.provider.sendBlockUnlock?.(activeId)
  }
})

watch(
  () => props.provider,
  (newProvider) => {
    wireProvider(newProvider)
  },
)

const onAdd = async (type: BlockType) => {
  const previousId = store.activeBlockId
  if (previousId && !store.isLockedByOther({ id: previousId } as Block)) {
    flushPendingEdit()
    clearLockTimers()
    store.unlock(previousId)
    await props.provider.sendBlockUnlock?.(previousId)
  }

  const block = createBlock(type)
  const afterBlockId = previousId
  store.insertBlock(block, afterBlockId)
  store.setActive(block.id)
  store.lock(block.id)

  await props.provider.sendBlockCreate({
    block,
    afterBlockId,
    type,
    text: block.text,
    decorator: block.decorator,
  })
  await props.provider.sendBlockLock?.(block.id)
  resetLockTimeout(block.id)
}

const onDelete = async () => {
  const blockId = store.activeBlockId
  if (!blockId) return
  const currentBlock = store.blocks.find((b) => b.id === blockId)
  if (currentBlock && store.isLockedByOther(currentBlock)) {
    return
  }

  flushPendingEdit()
  clearLockTimers()
  await props.provider.sendBlockUnlock?.(blockId)
  store.removeBlock(blockId)

  await props.provider.sendBlockDelete({
    blockId,
  })
}

const onUpdateText = async (block: Block, text: string) => {
  if (store.isLockedByOther(block)) return

  // If the lock timed out while we were still focused, re-acquire it before sending so the server-side lock check accepts the edit.
  if (block.lockedBy !== store.clientId) {
    const lockSuccess = await props.provider.sendBlockLock?.(block.id)
    if (lockSuccess === false) return
    store.lock(block.id)
  }

  const oldText = block.text
  store.updateBlockText(block.id, text)
  resetLockTimeout(block.id)
  const wasStandard = isStandardText(oldText)
  pendingEditBlockId = block.id
  pendingEditText = text
  pendingEditDecorator = block.decorator

  if (wasStandard && !isStandardText(text)) {
    await flushPendingEdit()
    return
  }

  if (editDebounceTimer) {
    clearTimeout(editDebounceTimer)
  }

  editDebounceTimer = setTimeout(() => {
    flushPendingEdit()
  }, EDIT_DEBOUNCE_MS)
}

const onUpdateDecorator = async (block: Block | null, newDecorator: BlockDecorator) => {
  if (!block || store.isLockedByOther(block)) return

  // Re-acquire lock if needed
  if (block.lockedBy !== store.clientId) {
    const lockSuccess = await props.provider.sendBlockLock?.(block.id)
    if (lockSuccess === false) return
    store.lock(block.id)
  }

  const serialized = serializeDecorator(newDecorator)
  store.updateBlockDecorator(block.id, serialized)
  resetLockTimeout(block.id)

  // Flush any pending text edit along with the new decorator
  if (pendingEditBlockId === block.id) {
    pendingEditDecorator = serialized
    await flushPendingEdit()
  } else {
    const textToSend =
      store.activeLanguage === 'en'
        ? block.text
        : store.getCanonicalText(block.id) || block.text
    await props.provider.sendEdit({
      blockId: block.id,
      text: textToSend,
      decorator: serialized,
    })
  }
}

const onFocus = async (block: Block) => {
  if (store.isLockedByOther(block)) {
    return
  }

  const previousId = store.activeBlockId
  if (previousId && previousId !== block.id && !store.isLockedByOther({ id: previousId } as Block)) {
    flushPendingEdit()
    clearLockTimers()
    store.unlock(previousId)
    await props.provider.sendBlockUnlock?.(previousId)
  }

  store.setActive(block.id)
  store.lock(block.id)

  const lockSuccess = await props.provider.sendBlockLock?.(block.id)
  if (lockSuccess === false) {
    // Another client acquired the lock first in a race
    store.unlock(block.id)
    return
  }

  resetLockTimeout(block.id)
}

const onBlur = async (block: Block) => {
  if (!store.isLockedByOther(block)) {
    flushPendingEdit()
    clearLockTimers()
    store.unlock(block.id)
    await props.provider.sendBlockUnlock?.(block.id)
  }
}
</script>

<style lang="css" scoped>
.editor {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  width: 100%;
  max-width: 860px;
  margin: 0 auto;
}

.editor--nav-top {
  flex-direction: column;
}

.editor--nav-left {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 16px;
  align-items: start;
}

.editor--nav-bottom {
  flex-direction: column;
}

.editor__content {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  width: 100%;
  padding: 16px 8px;
}

/* Expands naturally with site by default, or scrollable when scrollable prop is active */
.editor__content--scrollable {
  max-height: calc(100vh - 220px);
  overflow-y: auto;
  padding-right: 12px;
}

.editor__empty {
  margin: 0;
  padding: 32px 16px;
  color: var(--text-muted);
  font-style: italic;
  text-align: center;
}
</style>
