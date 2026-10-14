<template>
  <Button @click="onGeneratePdf">Generate PDF</Button>
  <div
    class="editor"
    :class="[`editor--nav-${navPosition}`]"
  >
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
      <Html2Pdf
        ref="pdfRef"
        :filename="filename"
        render-mode="text"
        style="width: 100%"
        pdf-format="a4"
        pdf-orientation="portrait"
        :pdf-content-width="pdfContentWidth"
        :html-to-pdf-options="pdfOptions"
        :styling="pdfStyling"
        :manual-pagination="false"
        :paginate-elements-by-height="usablePageHeightPx"
      >
        <template #pdf-content>
          <div class="pdf-content">
            <EditorBlock
              v-for="block in store.blocks"
              :key="block.id"
              data-pdf-split="avoid"
              :block="block"
              :active="block.id === store.activeBlockId && !store.isLockedByOther(block)"
              :locked="store.isLockedByOther(block)"
              @focus="onFocus(block)"
              @blur="onBlur(block)"
              @update:text="onUpdateText(block, $event)"
              @update:decorator="onUpdateDecorator(block, parseDecorator($event))"
            />
          </div>
        </template>
      </Html2Pdf>
      <p
        v-if="store.blocks.length === 0"
        class="editor__empty"
      >
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
import { computed, onBeforeUnmount, ref, onMounted, watch, nextTick } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import EditorBlock from '@/app/components/EditorBlock.vue'
import EditorNav from '@/app/components/EditorNav.vue'
import Button from '@/app/components/Button.vue'
import { useEditorStore } from '@/stores/editor'
import { isStandardText } from '@/app/editor/useEditable'
import {
  createBlock,
  parseDecorator,
  serializeDecorator,
  type Block,
  type BlockDecorator,
  type BlockType,
  type EditorDataProvider,
} from '@/app/editor/types'
import { Html2Pdf, type Html2PdfOptions, type PdfStylingOptions } from 'vue-pdf-export'
import 'vue-pdf-export/style.css'

const pdfRef = ref<InstanceType<typeof Html2Pdf> | null>(null)

const pdfPageMm = { width: 210, height: 297 }
const pdfMarginsMm = { top: 20, right: 20, bottom: 20, left: 25 }
const cssPixelsPerMm = 96 / 25.4
// Match the measured content width to the PDF body so pagination uses a 1:1 CSS scale.
const pdfContentWidth = `${(pdfPageMm.width - pdfMarginsMm.left - pdfMarginsMm.right) * cssPixelsPerMm}px`
const usablePageHeightPx =
  (pdfPageMm.height - pdfMarginsMm.top - pdfMarginsMm.bottom) * cssPixelsPerMm
const pdfOptions: Html2PdfOptions = {
  margin: [pdfMarginsMm.top, pdfMarginsMm.left, pdfMarginsMm.bottom, pdfMarginsMm.right],
  jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
}

// Improved one consistend styling for PDF export, overriding the default styles of the editor and
// its components.
const pdfStyling: PdfStylingOptions = {
  theme: 'light',
  pageBackground: '#ffffff',
  bodyBackground: '#fff',
  cssText: `
    [data-vue-pdf-export-staging] {
      width: ${pdfContentWidth} !important;
    }

    .pdf-content {
      font-family: Helvetica, Arial, sans-serif;
      font-size: 11pt;
      line-height: 1.45;
      color: #202833;
      background: #fff !important;
      padding: 0 !important;
      word-spacing: normal !important;
      text-align: left;
    }

    .pdf-content,
    .pdf-content * {
      box-sizing: border-box;
      text-shadow: none !important;
      box-shadow: none !important;
    }

    .pdf-content .editor-block {
      padding: 0 !important;
      margin: 0 0 10pt !important;
      border: 0 !important;
      border-radius: 0 !important;
      background: transparent !important;
    }

    .pdf-content [contenteditable] {
      outline: none !important;
      opacity: 1 !important;
      min-height: 0 !important;
    }

    .pdf-content [data-placeholder]::before {
      content: none !important;
    }

    .pdf-content .editor-block__lock,
    .pdf-content .code__language-select {
      display: none !important;
    }

    .pdf-content .paragraph,
    .pdf-content .heading,
    .pdf-content .list,
    .pdf-content .citation {
      font-family: Helvetica, Arial, sans-serif !important;
      color: #202833 !important;
      background: transparent !important;
      opacity: 1 !important;
    }

    .pdf-content .paragraph,
    .pdf-content .list,
    .pdf-content .citation {
      font-size: 11pt !important;
      line-height: 1.45 !important;
    }

    .pdf-content .paragraph {
      margin: 0 !important;
    }

    .pdf-content .paragraph,
    .pdf-content li,
    .pdf-content .citation__text {
      word-spacing: normal !important;
      white-space: pre-wrap !important;
      overflow-wrap: anywhere;
      orphans: 3;
      widows: 3;
    }

    .pdf-content .heading {
      font-weight: 700 !important;
      line-height: 1.2 !important;
      margin: 16pt 0 0 !important;
      letter-spacing: normal !important;
      text-transform: none !important;
      break-after: avoid;
      page-break-after: avoid;
      overflow-wrap: anywhere;
    }

    .pdf-content .editor-block:first-child .heading { margin-top: 0 !important; }
    .pdf-content h1.heading {
      font-size: 24pt !important;
      color: #172b4d !important;
      padding-bottom: 10pt;
      border-bottom: 2pt solid #334e75;
    }
    .pdf-content h2.heading {
      font-size: 17pt !important;
      color: #243e63 !important;
      padding-bottom: 6pt;
      border-bottom: 0.5pt solid #cbd5e1;
    }
    .pdf-content h3.heading { font-size: 13pt !important; }
    .pdf-content h4.heading { font-size: 12pt !important; }
    .pdf-content h5.heading,
    .pdf-content h6.heading { font-size: 11pt !important; }
    .pdf-content h6.heading { font-style: italic; }

    .pdf-content .list {
      margin: 0 !important;
      padding: 0 0 0 18pt !important;
    }

    .pdf-content .list li {
      line-height: 1.45 !important;
      margin: 0 0 4pt !important;
      padding-left: 3pt;
    }

    .pdf-content .list li::marker {
      color: #334e75;
      font-weight: 700;
    }

    .pdf-content .citation {
      display: block !important;
      margin: 4pt 0 !important;
      padding: 12pt 14pt !important;
      background: #fff !important;
      border-left: 3pt solid #64748b;
      border-radius: 0 !important;
      font-family: Times, 'Times New Roman', serif !important;
      font-size: 12pt !important;
      font-style: italic;
    }

    .pdf-content .citation__stripe { display: none !important; }
    .pdf-content .citation__source {
      margin-top: 6pt !important;
      font-size: 9pt !important;
      color: #526071 !important;
      font-family: Helvetica, Arial, sans-serif !important;
      font-style: normal;
    }

    .pdf-content .code {
      margin: 4pt 0 !important;
      padding: 10pt 12pt !important;
      background: #fff !important;
      color: #202833 !important;
      border: 0.5pt solid #cbd5e1 !important;
      border-radius: 0 !important;
      overflow: visible !important;
    }

    .pdf-content .code__header {
      display: block !important;
      margin: 0 0 8pt !important;
      padding: 0 0 6pt !important;
      background: transparent !important;
      border: 0 !important;
      border-bottom: 0.5pt solid #cbd5e1 !important;
      font-family: Helvetica, Arial, sans-serif !important;
      font-size: 8pt !important;
      font-weight: 700;
      line-height: 1.2 !important;
      color: #526071 !important;
      text-transform: uppercase;
      letter-spacing: 0.5pt;
    }

    .pdf-content .code__export-language,
    .pdf-content .code__language {
      display: inline !important;
      color: #526071 !important;
    }
    .pdf-content .code__pre,
    .pdf-content .code__content {
      font-family: Courier, 'Courier New', monospace !important;
      font-size: 9pt !important;
      line-height: 1.4 !important;
      color: #202833 !important;
      background: transparent !important;
      margin: 0 !important;
      padding: 0 !important;
      white-space: pre-wrap !important;
      overflow-wrap: anywhere !important;
      overflow: visible !important;
      tab-size: 4;
    }
  `,
}

const onGeneratePdf = async () => {
  store.setActive('')
  await nextTick()
  await pdfRef.value?.generatePdf()
}

const props = withDefaults(
  defineProps<{
    provider: EditorDataProvider
    scrollable?: boolean
    navPosition?: 'top' | 'left' | 'bottom'
    filename?: string
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

const filename = computed(() => props.filename)

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

async function flushPendingEdit(): Promise<boolean> {
  if (editDebounceTimer) {
    clearTimeout(editDebounceTimer)
    editDebounceTimer = null
  }
  if (pendingEditBlockId && pendingEditText !== null) {
    const blockId = pendingEditBlockId
    const text = pendingEditText
    const decorator = pendingEditDecorator ?? undefined
    pendingEditBlockId = null
    pendingEditText = null
    pendingEditDecorator = null
    return await props.provider.sendEdit({
      blockId,
      text,
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
    store.setBlocks(e.blocks)
  }

  provider.onCreated = (e) => {
    store.insertBlock(e.block, e.afterBlockId)
  }

  provider.onUpdated = (e) => {
    if (e.text !== undefined) {
      store.updateBlockText(e.blockId, e.text)
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
  if (wasStandard && !isStandardText(text)) {
    flushPendingEdit()
    await props.provider.sendEdit({
      blockId: block.id,
      text,
      decorator: block.decorator,
    })
    return
  }

  pendingEditBlockId = block.id
  pendingEditText = text
  pendingEditDecorator = block.decorator

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
    if (editDebounceTimer) {
      clearTimeout(editDebounceTimer)
      editDebounceTimer = null
    }
    const textToSend = pendingEditText ?? block.text
    pendingEditBlockId = null
    pendingEditText = null
    pendingEditDecorator = null
    await props.provider.sendEdit({
      blockId: block.id,
      text: textToSend,
      decorator: serialized,
    })
  } else {
    await props.provider.sendEdit({
      blockId: block.id,
      text: block.text,
      decorator: serialized,
    })
  }
}

const onFocus = async (block: Block) => {
  if (store.isLockedByOther(block)) {
    return
  }

  const previousId = store.activeBlockId
  if (
    previousId &&
    previousId !== block.id &&
    !store.isLockedByOther({ id: previousId } as Block)
  ) {
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
.pdf-content {
  width: 100%;
  box-sizing: border-box;
  padding: 14px 24px;
  background-color: var(--bg-app);
  word-spacing: 0.4em;
}

.editor {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  width: 100%;
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
  box-sizing: border-box;
}

/* Widen only the live editor; export clones retain the fixed PDF body width. */
.editor__content
  :deep(
    .content-wrapper:not([data-vue-pdf-export-staging]):not([data-vue-pdf-export-text-snapshot])
  ) {
  width: 100% !important;
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
