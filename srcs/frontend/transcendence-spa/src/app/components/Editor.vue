<!-- eslint-disable vue/multi-word-component-names -->
<template>
  <div
    class="editor w-full [margin:0_auto]"
    :class="layoutClass"
    @keydown.capture="blockInputDuringSync"
    @beforeinput.capture="blockInputDuringSync"
    @paste.capture="blockInputDuringSync"
  >
    <EditorNav
      v-if="props.editable && navPosition !== 'bottom'"
      :active-block-id="store.activeBlockId"
      :active-block="store.activeBlock"
      :delete-disabled="isDeleteDisabled"
      :is-elaborating="isElaborating"
      :is-translating="store.isTranslating"
      :position="navPosition"
      @add="onAdd"
      @delete="onDelete"
      @elaborate="onElaborate"
      @update:decorator="onUpdateDecorator(store.activeBlock, $event)"
    />

    <div
      class="editor__content box-border flex w-full min-w-0 flex-col gap-1 px-2 py-4"
      :class="{
        'editor__content--scrollable max-h-[calc(100vh_-_220px)] overflow-y-auto pr-3': scrollable,
      }"
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
          <div
            class="pdf-content box-border w-full bg-transparent px-6 py-3.5 [word-spacing:0.4em]"
          >
            <EditorBlockEntry
              v-for="block in store.blocks"
              :key="block.id"
              :block="block"
              :conflict="store.getConflict(block.id)"
              :editable="props.editable"
              :active="block.id === store.activeBlockId && !store.isLockedByOther(block)"
              :locked="store.isLockedByOther(block)"
              :elaborating="block.id === store.elaboratingBlockId"
              :translating="store.isTranslating"
              :export-mode="isExporting"
              @focus="onFocus(block)"
              @blur="onBlur(block)"
              @update:text="onUpdateText(block, $event)"
              @insert-blocks="onInsertBlocks(block, $event)"
              @update:decorator="onUpdateDecorator(block, parseDecorator($event))"
              @update-local="onConflictLocalInput(block.id, $event)"
              @resolve-local="onResolveConflict(block.id, 'local')"
              @resolve-remote="onResolveConflict(block.id, 'remote')"
            />
          </div>
        </template>
      </Html2Pdf>
      <p
        v-if="store.blocks.length === 0"
        class="editor__empty m-0 px-4 py-8 text-center text-muted italic"
      >
        {{ $t('editor.emptyDocument') }}
      </p>
    </div>

    <EditorNav
      v-if="props.editable && navPosition === 'bottom'"
      :active-block-id="store.activeBlockId"
      :active-block="store.activeBlock"
      :delete-disabled="isDeleteDisabled"
      :is-elaborating="isElaborating"
      :is-translating="store.isTranslating"
      :position="navPosition"
      @add="onAdd"
      @delete="onDelete"
      @elaborate="onElaborate"
      @update:decorator="onUpdateDecorator(store.activeBlock, $event)"
    />
  </div>
</template>

<script lang="ts" setup>
import { computed, onBeforeUnmount, ref, onMounted, watch, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { onBeforeRouteLeave } from 'vue-router'
import EditorBlockEntry from '@/app/components/EditorBlockEntry.vue'
import EditorNav from '@/app/components/EditorNav.vue'
import { useEditorStore } from '@/stores/editor'
import { SyncConflictError } from '@/app/editor/dataProvider'
import { buildLocalOnlyOps, mergeDocuments } from '@/app/editor/merge'
import { fingerprintBlock } from '@/app/editor/contentHash'
import {
  translateBlocks,
  backTranslateBlock,
  chunkBlocks,
  DEFAULT_TRANSLATE_TIMEOUT_MS,
  type SupportedLanguage,
  type TranslationBlockPayload,
} from '@/app/editor/translation.api'
import { elaborateBlock, type PersonaKey } from '@/app/editor/elaboration.api'
import { isStandardText, type EditableInsertEvent } from '@/app/editor/useEditable'
import { logger } from '@/utils/logger'
import {
  createBlock,
  defaultDecorator,
  isCodeOrCitation,
  parseDecorator,
  serializeDecorator,
  type Block,
  type BlockDecorator,
  type BlockType,
  type DocumentPermission,
  type EditorDataProvider,
  type EditorInitEvent,
  type SyncOperation,
  type SyncResult,
} from '@/app/editor/types'
import { Html2Pdf, type Html2PdfOptions, type PdfStylingOptions } from 'vue-pdf-export'
import 'vue-pdf-export/style.css'

const pdfRef = ref<InstanceType<typeof Html2Pdf> | null>(null)
const isExporting = ref(false)

const pdfPageMm = { width: 210, height: 297 }
const pdfMarginsMm = { top: 20, right: 20, bottom: 20, left: 20 }
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
    .pdf-content .editor-block__elaborating,
    .pdf-content .editor-block__translating,
    .pdf-content .canonical-preview,
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
      border-radius: 0 !important;
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

    .pdf-content .list--export {
      list-style: none !important;
      padding: 0 0 0 18pt !important;
    }

    .pdf-content .list--export .list__item {
      padding-left: 0 !important;
      text-indent: -18pt !important;
    }

    .pdf-content .list--export .list__marker {
      display: inline-block !important;
      width: 18pt !important;
      padding-right: 4pt !important;
      text-indent: 0 !important;
      text-align: right !important;
      font-weight: 700;
      color: #334e75;
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
  isExporting.value = true
  await nextTick()
  try {
    await pdfRef.value?.generatePdf()
  } finally {
    isExporting.value = false
  }
}

const props = withDefaults(
  defineProps<{
    provider: EditorDataProvider
    scrollable?: boolean
    navPosition?: 'top' | 'left' | 'bottom'
    filename?: string
    editable?: boolean
  }>(),
  {
    scrollable: false,
    navPosition: 'top',
    editable: true,
  },
)

const layoutClass = computed(() =>
  props.navPosition === 'left'
    ? 'grid grid-cols-[auto_minmax(0,1fr)] items-start gap-4'
    : 'flex flex-col items-stretch',
)

const emit = defineEmits<{
  error: [error: string]
  'readonly-enter': [hadPendingEdits: boolean]
  'permission-snapshot': [permission: DocumentPermission]
}>()

const store = useEditorStore()
const { t, locale } = useI18n()

function isSupportedLanguage(value: string): value is SupportedLanguage {
  return value === 'en' || value === 'de' || value === 'hu'
}

const TRANSLATE_CHUNK_RETRY_DELAY_MS = 1000

let translationRequestId = 0
let translationAbortController: AbortController | null = null

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

interface ChunkedTranslationOptions {
  requestId: number
  signal: AbortSignal
  applyChunk?: (blocks: TranslationBlockPayload[]) => void
}

async function translateBlocksInChunks(
  sourceBlocks: TranslationBlockPayload[],
  targetLang: SupportedLanguage,
  { requestId, signal, applyChunk }: ChunkedTranslationOptions,
): Promise<Map<string, string> | null> {
  const chunks = chunkBlocks(sourceBlocks)
  const results = new Map<string, string>()
  let completed = 0

  if (requestId === translationRequestId) {
    store.startTranslationProgress(sourceBlocks.length)
  }
  try {
    for (const chunk of chunks) {
      if (signal.aborted || requestId !== translationRequestId) return null

      const sourceById = new Map(chunk.map((block) => [block.id, block.text]))
      let translated: TranslationBlockPayload[] | null = null
      let lastError: unknown = null

      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          translated = await translateBlocks(chunk, 'en', targetLang, {
            signal,
            timeoutMs: DEFAULT_TRANSLATE_TIMEOUT_MS,
          })
          break
        } catch (err) {
          lastError = err
          if (signal.aborted) return null
          if (attempt === 0) await delay(TRANSLATE_CHUNK_RETRY_DELAY_MS)
        }
      }

      if (!translated) {
        throw lastError instanceof Error ? lastError : new Error(t('editor.translationFailed'))
      }
      if (signal.aborted || requestId !== translationRequestId) return null

      const applied: TranslationBlockPayload[] = []
      for (const block of translated) {
        const sourceText = sourceById.get(block.id)
        if (sourceText === undefined) continue
        if (store.getCanonicalText(block.id) !== sourceText) continue
        results.set(block.id, block.text)
        applied.push(block)
      }
      if (applied.length > 0) {
        applyChunk?.(applied)
      }

      completed += chunk.length
      store.setTranslationProgress(completed)
    }

    store.setTranslationProgress(sourceBlocks.length)
    return results
  } finally {
    if (requestId === translationRequestId) {
      store.finishTranslationProgress()
    }
  }
}

async function translateDocumentTo(targetLang: string) {
  if (!isSupportedLanguage(targetLang)) return
  if (store.isSyncing) return
  if (targetLang === store.activeLanguage) return

  const requestId = ++translationRequestId
  translationAbortController?.abort()
  const abortController = new AbortController()
  translationAbortController = abortController

  store.isTranslating = true
  store.translationError = null
  try {
    if (hasPendingData()) {
      const saved = await flushPendingEdit()
      if (!saved) return
    }
    if (requestId !== translationRequestId) return

    if (targetLang === 'en') {
      store.finishTranslationProgress()
      store.setLanguage('en')
      return
    }

    const payload = store.blocks
      .filter((block) => !isCodeOrCitation(block.decorator))
      .map((block) => ({
        id: block.id,
        text: store.getCanonicalText(block.id) || block.text,
      }))

    const results = await translateBlocksInChunks(payload, targetLang, {
      requestId,
      signal: abortController.signal,
    })
    if (!results || requestId !== translationRequestId) return

    const translated = payload.map((block) => {
      const current = store.getCanonicalText(block.id) || block.text
      const translatedText = current === block.text ? results.get(block.id) : undefined
      return {
        id: block.id,
        text: translatedText ?? current,
      }
    })
    store.applyTranslations(translated)
    store.setLanguage(targetLang)
  } catch (err) {
    if (requestId !== translationRequestId || abortController.signal.aborted) return
    logger.error('Document translation failed:', err)
    store.translationError = err instanceof Error ? err.message : t('editor.translationFailed')
    emit('error', store.translationError)
  } finally {
    if (requestId === translationRequestId) store.isTranslating = false
    if (translationAbortController === abortController) translationAbortController = null
  }
}

const isDeleteDisabled = computed(() => {
  if (!props.editable || !store.activeBlock) return true
  return (
    store.isLockedByOther(store.activeBlock) ||
    store.isElaborating ||
    store.isTranslating ||
    store.isSyncing ||
    Boolean(store.getConflict(store.activeBlock.id))
  )
})

const isElaborating = computed(() => store.isElaborating)
const filename = computed(() => props.filename)
const isOnline = computed(() => store.connectionState === 'connected')

function blockInputDuringSync(event: Event) {
  if (!store.isSyncing) return
  event.preventDefault()
  event.stopPropagation()
}

async function acquireBlockLock(blockId: string): Promise<boolean> {
  const block = store.blocks.find((item) => item.id === blockId)
  if (block?.lockedBy === store.clientId) return true
  if (!isOnline.value) {
    store.lock(blockId)
    return true
  }
  const success = await props.provider.sendBlockLock?.(blockId)
  if (success === false) return false
  if (!props.editable) return false
  store.lock(blockId)
  return true
}

const EDIT_DEBOUNCE_MS = 2000
const LOCK_TIMEOUT_MS = 5000
const LOCK_REFRESH_MS = 3000

let editDebounceTimer: ReturnType<typeof setTimeout> | null = null
let lockTimeoutTimer: ReturnType<typeof setTimeout> | null = null
let elaborationLockInterval: ReturnType<typeof setInterval> | null = null
let flushLockInterval: ReturnType<typeof setInterval> | null = null
let elaborationAbortController: AbortController | null = null
let pendingEditBlockId: string | null = null
let pendingEditText: string | null = null
let pendingEditDecorator: string | null = null
let flushPromise: Promise<boolean> | null = null
let syncEpoch = 0
const pendingRemoteEvents: Array<() => void> = []

function flushPendingRemoteEvents() {
  while (pendingRemoteEvents.length > 0) {
    const apply = pendingRemoteEvents.shift()
    apply?.()
  }
}

function hasPendingData(): boolean {
  return Boolean(
    flushPromise ||
    editDebounceTimer ||
    (pendingEditBlockId !== null && pendingEditText !== null) ||
    store.hasConflicts,
  )
}

function discardPendingEdit() {
  pendingEditBlockId = null
  pendingEditText = null
  pendingEditDecorator = null
  stopFlushLockHeartbeat()
}

function startFlushLockHeartbeat(blockId: string) {
  stopFlushLockHeartbeat()
  const refreshLock = () => {
    if (!props.editable || !isOnline.value) return
    void props.provider.sendBlockLock?.(blockId)
  }
  refreshLock()
  flushLockInterval = setInterval(refreshLock, LOCK_REFRESH_MS)
}

function stopFlushLockHeartbeat() {
  if (flushLockInterval) {
    clearInterval(flushLockInterval)
    flushLockInterval = null
  }
}

function getSurroundingContext(blockId: string): string {
  const index = store.blocks.findIndex((b) => b.id === blockId)
  if (index === -1) return ''
  const prev = store.blocks[index - 1]?.text ?? ''
  const next = store.blocks[index + 1]?.text ?? ''
  return [prev ? `Previous: ${prev}` : '', next ? `Next: ${next}` : ''].filter(Boolean).join('\n')
}

function flushPendingEdit(): Promise<boolean> {
  if (!flushPromise) {
    flushPromise = doFlushPendingEdit().finally(() => {
      flushPromise = null
    })
  }
  return flushPromise
}

async function doFlushPendingEdit(): Promise<boolean> {
  if (!props.editable) {
    // The server has already downgraded this socket; never send queued edits.
    discardPendingEdit()
    if (editDebounceTimer) {
      clearTimeout(editDebounceTimer)
      editDebounceTimer = null
    }
    return false
  }
  if (!isOnline.value || store.isSyncing) {
    // The store already holds the latest text; reconnect sync derives the
    // operations from the local snapshot.
    if (editDebounceTimer) {
      clearTimeout(editDebounceTimer)
      editDebounceTimer = null
    }
    discardPendingEdit()
    return true
  }

  while (pendingEditBlockId && pendingEditText !== null) {
    if (editDebounceTimer) {
      clearTimeout(editDebounceTimer)
      editDebounceTimer = null
    }

    const blockId = pendingEditBlockId
    const snapshotText = pendingEditText
    const snapshotDecorator = pendingEditDecorator
    const decorator = snapshotDecorator ?? undefined
    let textToSend = snapshotText
    let canonical: string | null = null
    let lockMayHaveExpired = false

    try {
      // If edited in non-English mode, back-translate dirty block to English before saving to DB/WS
      if (store.activeLanguage !== 'en' && store.isBlockDirty(blockId)) {
        const currentBlock = store.blocks.find((b) => b.id === blockId)
        if (currentBlock && isCodeOrCitation(currentBlock.decorator)) {
          canonical = textToSend
        } else {
          startFlushLockHeartbeat(blockId)
          lockMayHaveExpired = true
          try {
            const surroundingContext = getSurroundingContext(blockId)
            canonical = await backTranslateBlock(
              textToSend,
              store.activeLanguage,
              'en',
              surroundingContext,
            )
          } catch (err) {
            emit('error', t('editor.translationFailed'))
            logger.error('Back-translation failed during save:', err)
            return false
          }
          if (!props.editable) return false
          if (
            pendingEditBlockId !== blockId ||
            pendingEditText !== snapshotText ||
            pendingEditDecorator !== snapshotDecorator
          ) {
            // A newer edit arrived while translating; loop again with the latest snapshot.
            continue
          }
          textToSend = canonical
        }
      }

      const currentBlock = store.blocks.find((b) => b.id === blockId)
      if (lockMayHaveExpired || (currentBlock && currentBlock.lockedBy !== store.clientId)) {
        const lockSuccess = await acquireBlockLock(blockId)
        if (!lockSuccess) return false
        if (!props.editable) return false
      }

      const sent = await props.provider.sendEdit({
        blockId,
        text: textToSend,
        decorator,
      })
      if (!sent) return false

      const isCurrentText = pendingEditBlockId === blockId && pendingEditText === snapshotText
      if (isCurrentText && canonical !== null) {
        store.setCanonicalText(blockId, canonical)
        store.clearBlockDirty(blockId)
      }
      if (isCurrentText && pendingEditDecorator === snapshotDecorator) {
        discardPendingEdit()
      }
    } finally {
      stopFlushLockHeartbeat()
    }
  }

  return true
}

function handleBeforeUnload(event: BeforeUnloadEvent) {
  if (isOnline.value && hasPendingData()) {
    flushPendingEdit()
    event.preventDefault()
    event.returnValue = ''
  }
}

function clearLockTimeout() {
  if (lockTimeoutTimer) {
    clearTimeout(lockTimeoutTimer)
    lockTimeoutTimer = null
  }
}

function resetLockTimeout(blockId: string) {
  clearLockTimeout()

  const timer = setTimeout(async () => {
    // 5 seconds elapsed without any new edit -> lock timeout expires!
    const success = await flushPendingEdit()
    if (lockTimeoutTimer !== timer) return
    lockTimeoutTimer = null
    if (!success || hasPendingData()) return

    store.unlock(blockId)
    if (props.editable) {
      await props.provider.sendBlockUnlock?.(blockId)
    }
  }, LOCK_TIMEOUT_MS)
  lockTimeoutTimer = timer
}

function clearLockTimers() {
  if (editDebounceTimer) {
    clearTimeout(editDebounceTimer)
    editDebounceTimer = null
  }
  clearLockTimeout()
}

function startElaborationLockHeartbeat(blockId: string) {
  stopElaborationLockHeartbeat()
  void props.provider.sendBlockLock?.(blockId)
  elaborationLockInterval = setInterval(() => {
    const currentBlock = store.blocks.find((item) => item.id === blockId)
    if (store.activeBlockId !== blockId || !currentBlock || store.isLockedByOther(currentBlock)) {
      return
    }
    void props.provider.sendBlockLock?.(blockId)
  }, 3000)
}

function stopElaborationLockHeartbeat() {
  if (elaborationLockInterval) {
    clearInterval(elaborationLockInterval)
    elaborationLockInterval = null
  }
}

function abortElaboration() {
  elaborationAbortController?.abort()
  elaborationAbortController = null
  stopElaborationLockHeartbeat()
}

function enterReadOnlyMode() {
  const hadPendingEdits = hasPendingData() || Boolean(store.elaboratingBlockId)
  abortElaboration()
  clearLockTimers()
  discardPendingEdit()

  const activeBlockId = store.activeBlockId
  if (activeBlockId) {
    store.unlock(activeBlockId)
    store.setActive('')
  }

  // The server rejects block_unlock from a viewer; its 5.5s lock timer
  // releases the lock for the other clients.
  emit('readonly-enter', hadPendingEdits)
}

function startDocumentTranslation(blocks: Block[], epoch = syncEpoch) {
  void nextTick(() => {
    if (epoch !== syncEpoch) return
    translationAbortController?.abort()
    translationAbortController = null
    const requestId = ++translationRequestId

    if (isSupportedLanguage(locale.value)) {
      store.setLanguage(locale.value)
    }

    const requestedLang = store.activeLanguage
    const payload =
      requestedLang === 'en'
        ? []
        : blocks
            .filter((b) => !isCodeOrCitation(b.decorator))
            .map((b) => ({ id: b.id, text: b.text }))

    if (payload.length === 0) {
      store.isTranslating = false
      store.finishTranslationProgress()
      return
    }

    const abortController = new AbortController()
    translationAbortController = abortController
    store.isTranslating = true
    store.translationError = null
    void translateBlocksInChunks(payload, requestedLang, {
      requestId,
      signal: abortController.signal,
      applyChunk: (translated) => {
        if (requestId !== translationRequestId || store.activeLanguage !== requestedLang) return
        store.applyTranslations(translated)
      },
    })
      .catch((err) => {
        if (abortController.signal.aborted || requestId !== translationRequestId) return
        logger.error('Failed to translate initial blocks:', err)
        store.translationError = err instanceof Error ? err.message : t('editor.translationFailed')
        emit('error', store.translationError)
      })
      .finally(() => {
        if (requestId === translationRequestId) store.isTranslating = false
        if (translationAbortController === abortController) {
          translationAbortController = null
        }
      })
  })
}

async function backTranslateDirtyBlocks(): Promise<void> {
  if (store.activeLanguage === 'en') return
  for (const blockId of [...store.dirtyBlockIds]) {
    const block = store.blocks.find((item) => item.id === blockId)
    if (!block) {
      store.clearBlockDirty(blockId)
      continue
    }
    if (isCodeOrCitation(block.decorator)) {
      store.setCanonicalText(blockId, block.text)
      store.clearBlockDirty(blockId)
      continue
    }
    const canonical = await backTranslateBlock(
      block.text,
      store.activeLanguage,
      'en',
      getSurroundingContext(blockId),
    )
    store.setCanonicalText(blockId, canonical)
    store.clearBlockDirty(blockId)
  }
}

function mergeTitleSnapshot(remoteTitle: string): Extract<SyncOperation, { kind: 'title' }> | null {
  const localTitle = store.title
  const baseTitle = store.base?.title ?? localTitle
  const localChanged = localTitle !== baseTitle
  const remoteChanged = remoteTitle !== baseTitle

  if (localChanged && remoteChanged && localTitle !== remoteTitle) {
    store.setTitleConflict({ local: localTitle, remote: remoteTitle })
    return null
  }

  if (localChanged && !remoteChanged) {
    store.setTitle(localTitle)
    store.setTitleConflict(null)
    return { kind: 'title', title: localTitle, expectedTitle: remoteTitle }
  }

  store.setTitle(remoteTitle)
  store.setTitleConflict(null)
  return null
}

async function applyRemoteSnapshot(
  e: EditorInitEvent,
  remoteBlocks: Block[],
  remoteTitle: string,
  allowSync = true,
  epoch = syncEpoch,
) {
  if (epoch !== syncEpoch) return
  clearLockTimers()
  discardPendingEdit()
  store.setConflicts({})
  store.setTitleConflict(null)
  store.initCanonicalBlocks(remoteBlocks)
  store.setBlocks(remoteBlocks.map((block) => ({ ...block, lockedBy: null })))
  const titleOp = allowSync ? mergeTitleSnapshot(remoteTitle) : null
  const remoteHash = e.contentHash ?? ''
  if (!allowSync) store.setTitle(remoteTitle)

  if (titleOp) {
    const result = await sendSyncOperations([titleOp])
    if (epoch !== syncEpoch) return
    if (result) {
      await store.setBaseFromBlocks(remoteBlocks, titleOp.title, result.contentHash)
    } else {
      await store.setBaseFromBlocks(remoteBlocks, remoteTitle, remoteHash)
      store.setTitleConflict({ local: store.title, remote: remoteTitle })
    }
  } else {
    await store.setBaseFromBlocks(remoteBlocks, remoteTitle, remoteHash)
  }

  startDocumentTranslation(remoteBlocks, epoch)
}

async function recordBaseOperations(ops: SyncOperation[], contentHash: string, title: string) {
  if (ops.length === 0) {
    const current = store.base
    if (current) store.setBase({ ...current, contentHash, title: current.title })
    return
  }
  for (const op of ops) {
    const block =
      op.kind === 'create'
        ? op.block
        : op.kind === 'title'
          ? null
          : (store.blocks.find((item) => item.id === op.blockId) ?? null)
    await store.recordBaseOperation(op, block, contentHash, title)
  }
}

async function updateConflictsFromSync(
  conflicts: NonNullable<SyncConflictError['conflicts']>,
): Promise<void> {
  for (const conflict of conflicts) {
    if (conflict.reason === 'locked') {
      continue
    }
    if (conflict.kind === 'title' || conflict.remoteTitle !== undefined) {
      const remoteTitle = conflict.remoteTitle ?? ''
      if (remoteTitle === store.title) {
        store.setTitleConflict(null)
        if (store.base) store.setBase({ ...store.base, title: remoteTitle })
      } else {
        store.setTitleConflict({ local: store.title, remote: remoteTitle })
      }
      continue
    }
    if (!conflict.blockId) continue
    const remoteBlock = conflict.block ?? null
    let remoteFingerprint = conflict.fingerprint ?? null
    if (remoteBlock && !remoteFingerprint) {
      remoteFingerprint = await fingerprintBlock(remoteBlock)
    }
    const existing = store.getConflict(conflict.blockId)
    const local = store.blocks.find((block) => block.id === conflict.blockId) ?? null

    if (existing?.kind === 'local-deleted') {
      if (!remoteBlock) {
        store.removeBlock(conflict.blockId)
        store.removeConflict(conflict.blockId)
        store.removeBaseBlockFingerprint(conflict.blockId)
      } else {
        store.updateConflictRemote(conflict.blockId, remoteBlock, remoteFingerprint)
      }
      continue
    }

    if (!remoteBlock && !local) {
      store.removeConflict(conflict.blockId)
      store.removeBaseBlockFingerprint(conflict.blockId)
      continue
    }

    if (remoteBlock && local) {
      const comparableLocal =
        store.activeLanguage === 'en' ? local : { ...local, text: store.getCanonicalText(local.id) }
      const localFingerprint = await fingerprintBlock(comparableLocal)
      if (remoteFingerprint && localFingerprint === remoteFingerprint) {
        store.removeConflict(conflict.blockId)
        await store.setBaseBlockFingerprint(conflict.blockId, remoteBlock)
        continue
      }
    }

    if (existing) {
      store.updateConflictRemote(
        conflict.blockId,
        remoteBlock ? { text: remoteBlock.text, decorator: remoteBlock.decorator } : null,
        remoteFingerprint,
      )
      continue
    }

    store.setConflict({
      blockId: conflict.blockId,
      kind: !remoteBlock ? 'remote-deleted' : !local ? 'local-deleted' : 'diff',
      local: local
        ? {
            text: store.activeLanguage === 'en' ? local.text : store.getCanonicalText(local.id),
            decorator: local.decorator,
          }
        : null,
      remote: remoteBlock ? { text: remoteBlock.text, decorator: remoteBlock.decorator } : null,
      remoteFingerprint,
    })
  }
}

async function sendSyncOperations(ops: SyncOperation[]): Promise<SyncResult | null> {
  if (ops.length === 0) return null
  if (!props.provider.sendSync) {
    store.setSyncError(t('editor.conflict.syncUnavailable'))
    return null
  }
  let attemptOps = ops
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const result = await props.provider.sendSync(attemptOps)
      store.setSyncError(null)
      return result
    } catch (err) {
      if (err instanceof SyncConflictError) {
        await updateConflictsFromSync(err.conflicts)
        const onlyLocked = err.conflicts.every((conflict) => conflict.reason === 'locked')
        if (onlyLocked && attempt < 2) {
          await delay(700 * (attempt + 1))
          continue
        }
        const unresolved = err.conflicts.some((conflict) => {
          if (conflict.kind === 'title' || conflict.remoteTitle !== undefined) {
            return Boolean(store.titleConflict)
          }
          return conflict.blockId ? Boolean(store.getConflict(conflict.blockId)) : false
        })
        if (!unresolved && attempt < 2) {
          attemptOps = attemptOps.map((op) => {
            if (op.kind === 'set' || op.kind === 'delete') {
              const current = err.conflicts.find(
                (conflict) => conflict.blockId === op.blockId && conflict.fingerprint,
              )
              if (current?.fingerprint) return { ...op, expected: current.fingerprint }
            }
            if (op.kind === 'title') {
              const current = err.conflicts.find(
                (conflict) => conflict.kind === 'title' || conflict.remoteTitle !== undefined,
              )
              if (current?.remoteTitle !== undefined) {
                return { ...op, expectedTitle: current.remoteTitle }
              }
            }
            return op
          })
          continue
        }
        store.setSyncError(t('editor.conflict.syncConflict'))
        return null
      }
      store.setSyncError(t('editor.conflict.syncFailed'))
      return null
    }
  }
  return null
}

async function syncPendingLocalChanges(): Promise<void> {
  if (!store.base || !isOnline.value) return
  const epoch = syncEpoch
  try {
    await backTranslateDirtyBlocks()
  } catch (err) {
    logger.error('Back-translation failed before retrying pending changes:', err)
    return
  }
  const { ops } = await buildLocalOnlyOps(store.getCanonicalBlocks(), store.title, store.base, {
    excludedBlockIds: new Set(Object.keys(store.conflicts)),
    includeTitle: !store.titleConflict,
  })
  if (ops.length === 0) {
    if (!store.hasConflicts) store.setSyncError(null)
    return
  }
  if (epoch !== syncEpoch) return
  const result = await sendSyncOperations(ops)
  if (epoch !== syncEpoch) return
  if (result) await recordBaseOperations(ops, result.contentHash, store.title)
}

async function handleUnchangedInit(
  e: EditorInitEvent,
  permission?: DocumentPermission,
  epoch = syncEpoch,
) {
  if (epoch !== syncEpoch) return
  clearLockTimers()
  discardPendingEdit()
  store.clearLocks()
  const remoteTitle = e.title ?? store.title
  const contentHash = e.contentHash ?? ''

  if (!store.base) {
    store.setTitle(remoteTitle)
    await store.setBaseFromBlocks(store.getCanonicalBlocks(), remoteTitle, contentHash)
    return
  }

  if (permission === 'viewer') {
    store.setTitle(remoteTitle)
    store.setTitleConflict(null)
    const localHash = await store.computeLocalContentHash()
    if (epoch !== syncEpoch) return
    if (localHash && localHash === contentHash) {
      await store.setBaseFromBlocks(store.getCanonicalBlocks(), remoteTitle, contentHash)
    } else {
      const current = store.base
      if (current) store.setBase({ ...current, contentHash, title: remoteTitle })
    }
    return
  }

  const baseTitle = store.base.title
  const localTitleBefore = store.title
  const remoteTitleKnown = e.title !== undefined
  const titleOp = remoteTitleKnown ? mergeTitleSnapshot(remoteTitle) : null
  const titleNeedsSync =
    localTitleBefore !== baseTitle &&
    (!remoteTitleKnown || remoteTitle === baseTitle) &&
    !store.titleConflict

  try {
    await backTranslateDirtyBlocks()
  } catch (err) {
    logger.error('Back-translation failed during reconnect:', err)
    store.setSyncError(t('editor.translationFailed'))
    return
  }
  if (epoch !== syncEpoch) return

  const localBlocks = store.getCanonicalBlocks()
  const localHash = await store.computeLocalContentHash()
  if (epoch !== syncEpoch) return

  if (localHash === contentHash) {
    store.setConflicts({})
    if (store.titleConflict) {
      const current = store.base
      if (current) store.setBase({ ...current, contentHash })
    } else if (titleOp) {
      const result = await sendSyncOperations([titleOp])
      if (epoch !== syncEpoch) return
      if (result) {
        await store.setBaseFromBlocks(localBlocks, titleOp.title, result.contentHash)
      } else {
        await store.setBaseFromBlocks(localBlocks, remoteTitle, contentHash)
        store.setTitleConflict({ local: store.title, remote: remoteTitle })
      }
    } else {
      await store.setBaseFromBlocks(localBlocks, store.title, contentHash)
    }
    return
  }

  if (store.conflictCount > 0 || store.titleConflict) {
    store.setSyncError(t('editor.conflict.unresolved'))
    return
  }

  const { ops } = await buildLocalOnlyOps(localBlocks, store.title, store.base, {
    includeTitle: titleNeedsSync,
  })
  if (epoch !== syncEpoch) return
  const result = await sendSyncOperations(ops)
  if (epoch !== syncEpoch) return
  if (ops.length > 0 && !result) {
    if (store.conflictCount > 0 || store.titleConflict) {
      await syncPendingLocalChanges()
    }
    return
  }
  if (result) {
    await recordBaseOperations(ops, result.contentHash, store.title)
  } else {
    const current = store.base
    if (current) store.setBase({ ...current, contentHash })
  }
}

async function handleFullInit(
  e: EditorInitEvent,
  remoteBlocks: Block[],
  permission?: DocumentPermission,
  epoch = syncEpoch,
) {
  if (epoch !== syncEpoch) return
  const remoteTitle = e.title ?? store.title
  const remoteHash = e.contentHash ?? ''
  clearLockTimers()
  discardPendingEdit()
  store.clearLocks()

  if (!store.base) {
    await applyRemoteSnapshot(e, remoteBlocks, remoteTitle, permission !== 'viewer', epoch)
    return
  }

  if (permission === 'viewer') {
    await applyRemoteSnapshot(e, remoteBlocks, remoteTitle, false, epoch)
    return
  }

  try {
    await backTranslateDirtyBlocks()
  } catch (err) {
    logger.error('Back-translation failed during reconnect:', err)
    store.setSyncError(t('editor.translationFailed'))
    return
  }
  if (epoch !== syncEpoch) return

  const localBlocks = store.getCanonicalBlocks()
  const localHash = await store.computeLocalContentHash()
  if (epoch !== syncEpoch) return

  if (localHash === remoteHash || localHash === store.base.contentHash) {
    await applyRemoteSnapshot(e, remoteBlocks, remoteTitle, true, epoch)
    return
  }

  const merged = await mergeDocuments({
    base: store.base,
    localBlocks,
    localTitle: store.title,
    remoteBlocks,
    remoteTitle,
  })
  if (epoch !== syncEpoch) return

  store.initCanonicalBlocks(merged.blocks)
  store.setBlocks(merged.blocks.map((block) => ({ ...block, lockedBy: null })))
  store.setConflicts(merged.conflicts)
  store.setTitleConflict(merged.titleConflict)
  if (!merged.titleConflict) store.setTitle(merged.title)

  if (merged.ops.length === 0) {
    await store.setBaseFromBlocks(merged.baseBlocks, merged.baseTitle, remoteHash)
  } else {
    const result = await sendSyncOperations(merged.ops)
    if (epoch !== syncEpoch) return
    if (result) {
      await store.setBaseFromBlocks(merged.baseBlocks, merged.baseTitle, result.contentHash)
    } else {
      await store.setBaseFromBlocks(remoteBlocks, remoteTitle, remoteHash)
      if (store.conflictCount > 0 || store.titleConflict) {
        await syncPendingLocalChanges()
      }
    }
  }

  startDocumentTranslation(merged.blocks, epoch)
}

function wireProvider(provider: EditorDataProvider) {
  pendingRemoteEvents.length = 0
  const providerEpoch = ++syncEpoch
  store.setSyncing(false)
  if ('clientId' in provider && typeof (provider as { clientId?: unknown }).clientId === 'string') {
    store.setClientId((provider as { clientId: string }).clientId)
  }

  provider.onInit = (e) => {
    if (e.permission) emit('permission-snapshot', e.permission)
    store.setSyncing(true)
    store.setSyncError(null)
    void (async () => {
      try {
        if (e.unchanged) {
          await handleUnchangedInit(e, e.permission, providerEpoch)
        } else {
          await handleFullInit(e, e.blocks, e.permission, providerEpoch)
        }
      } catch (err) {
        if (providerEpoch !== syncEpoch) return
        logger.error('Failed to reconcile document after reconnect:', err)
        store.setSyncError(err instanceof Error ? err.message : t('editor.conflict.syncFailed'))
      } finally {
        if (providerEpoch !== syncEpoch) return
        for (const lock of e.locks ?? []) {
          const holder = lock.clientId || lock.userId
          if (holder && holder !== store.clientId) {
            store.lock(lock.blockId, holder)
          }
        }
        store.setSyncing(false)
        flushPendingRemoteEvents()
      }
    })()
  }

  provider.onCreated = (e) => {
    const applyCreated = () => {
      const conflict = store.getConflict(e.block.id)
      if (conflict) {
        void fingerprintBlock(e.block).then((remoteFingerprint) => {
          store.updateConflictRemote(
            e.block.id,
            { text: e.block.text, decorator: e.block.decorator },
            remoteFingerprint,
          )
        })
        return
      }
      store.insertBlock(e.block, e.afterBlockId)
      if (store.activeLanguage !== 'en' && !isCodeOrCitation(e.block.decorator)) {
        const requestedLang = store.activeLanguage
        const requestId = translationRequestId
        translateBlocks([{ id: e.block.id, text: e.block.text }], 'en', requestedLang)
          .then((res) => {
            if (requestId !== translationRequestId || store.activeLanguage !== requestedLang) return
            if (res.length > 0) {
              store.applyTranslations(res)
            }
          })
          .catch((err) => logger.error('Failed to translate newly created block:', err))
      }
    }
    if (store.isSyncing) {
      pendingRemoteEvents.push(applyCreated)
      return
    }
    applyCreated()
  }

  provider.onUpdated = (e) => {
    const applyUpdated = () => {
      const conflict = store.getConflict(e.blockId)
      if (conflict) {
        const current = store.blocks.find((block) => block.id === e.blockId)
        const remote = {
          text: e.text ?? conflict.remote?.text ?? current?.text ?? '',
          decorator: e.decorator ?? conflict.remote?.decorator ?? current?.decorator ?? '',
        }
        void fingerprintBlock({ id: e.blockId, ...remote }).then((remoteFingerprint) => {
          store.updateConflictRemote(e.blockId, remote, remoteFingerprint)
        })
        return
      }
      if (e.text !== undefined) {
        store.setCanonicalText(e.blockId, e.text)
        if (store.activeLanguage === 'en') {
          store.updateBlockText(e.blockId, e.text)
        } else {
          const currentBlock = store.blocks.find((b) => b.id === e.blockId)
          const decorator = e.decorator ?? currentBlock?.decorator ?? ''
          if (isCodeOrCitation(decorator)) {
            // Code and citation blocks are never translated, so show the canonical text directly.
            store.applyRemoteText(e.blockId, e.text)
          } else if (store.activeBlockId !== e.blockId) {
            // If local user is not actively editing this block, translate it to activeLanguage
            const requestedLang = store.activeLanguage
            const requestId = translationRequestId
            translateBlocks([{ id: e.blockId, text: e.text }], 'en', requestedLang)
              .then((res) => {
                const first = res[0]
                if (
                  first &&
                  requestId === translationRequestId &&
                  store.activeLanguage === requestedLang
                ) {
                  store.applyRemoteText(e.blockId, first.text)
                }
              })
              .catch((err) => logger.error('Failed to translate updated block:', err))
          }
        }
      }
      if (e.decorator !== undefined) {
        store.updateBlockDecorator(e.blockId, e.decorator)
      }
    }
    if (store.isSyncing) {
      pendingRemoteEvents.push(applyUpdated)
      return
    }
    applyUpdated()
  }

  provider.onDeleted = (e) => {
    const applyDeleted = () => {
      const conflict = store.getConflict(e.blockId)
      if (conflict) {
        if (conflict.kind === 'local-deleted') {
          store.removeBlock(e.blockId)
          store.removeConflict(e.blockId)
        } else {
          store.updateConflictRemote(e.blockId, null, null)
        }
        return
      }
      store.removeBlock(e.blockId)
    }
    if (store.isSyncing) {
      pendingRemoteEvents.push(applyDeleted)
      return
    }
    applyDeleted()
  }

  provider.onLocked = (e) => {
    if (e.clientId && e.clientId !== store.clientId) {
      if (store.activeBlockId === e.blockId && !store.getConflict(e.blockId)) {
        clearLockTimers()
        discardPendingEdit()
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
  syncEpoch += 1
  store.setSyncing(false)
  window.removeEventListener('beforeunload', handleBeforeUnload)
  abortElaboration()
  translationAbortController?.abort()
  translationAbortController = null
  flushPendingEdit()
  clearLockTimers()
  if (
    isOnline.value &&
    store.activeBlockId &&
    !store.isLockedByOther({ id: store.activeBlockId } as Block)
  ) {
    props.provider.sendBlockUnlock?.(store.activeBlockId)
  }
})

onBeforeRouteLeave(async () => {
  abortElaboration()
  translationAbortController?.abort()
  translationAbortController = null
  if (hasPendingData()) {
    const success = await flushPendingEdit()
    if (!success) {
      const confirmLeave = window.confirm(t('editor.unsavedChanges'))
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
    if (isOnline.value) await props.provider.sendBlockUnlock?.(activeId)
  }
})

watch(
  () => props.provider,
  (newProvider) => {
    abortElaboration()
    wireProvider(newProvider)
  },
)

watch(
  () => props.editable,
  (editable) => {
    if (!editable) enterReadOnlyMode()
  },
)

watch(
  () => store.syncRequest,
  () => {
    setTimeout(() => {
      if (isOnline.value && !store.isSyncing) {
        void syncPendingLocalChanges()
      }
    }, 0)
  },
)

watch(
  () => locale.value,
  async (nextLocale) => {
    if (store.isElaborating) return
    await translateDocumentTo(nextLocale)
  },
)

const onAdd = async (type: BlockType) => {
  if (!props.editable || store.isElaborating || store.isTranslating || store.isSyncing) return
  const previousId = store.activeBlockId
  if (previousId && !store.isLockedByOther({ id: previousId } as Block)) {
    const saved = await flushPendingEdit()
    if (!saved) return
    clearLockTimers()
    store.unlock(previousId)
    if (isOnline.value) await props.provider.sendBlockUnlock?.(previousId)
  }
  if (!props.editable) return

  const block = createBlock(type)
  const afterBlockId = previousId
  store.insertBlock(block, afterBlockId)
  store.setActive(block.id)
  store.lock(block.id)

  if (isOnline.value) {
    await props.provider.sendBlockCreate({
      block,
      afterBlockId,
      type,
      text: block.text,
      decorator: block.decorator,
    })
    await props.provider.sendBlockLock?.(block.id)
  }
  resetLockTimeout(block.id)
}

function focusBlock(blockId: string, position: 'start' | 'end' = 'start') {
  nextTick(() => {
    const root = document.querySelector<HTMLElement>(`[data-block-id="${blockId}"]`)
    const target = root?.querySelector<HTMLElement>('[contenteditable="true"]')
    if (!target) return

    target.focus()
    const range = document.createRange()
    range.selectNodeContents(target)
    range.collapse(position === 'start')
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
  })
}

const onInsertBlocks = async (block: Block, event: EditableInsertEvent) => {
  if (
    !props.editable ||
    store.isLockedByOther(block) ||
    store.elaboratingBlockId === block.id ||
    store.isTranslating ||
    store.isSyncing ||
    store.getConflict(block.id)
  ) {
    return
  }

  if (block.lockedBy !== store.clientId) {
    const lockSuccess = await acquireBlockLock(block.id)
    if (!lockSuccess) return
    if (!props.editable) return
  }

  // The split/paste payload is authoritative; drop any debounced edit.
  if (pendingEditBlockId === block.id) {
    if (editDebounceTimer) {
      clearTimeout(editDebounceTimer)
      editDebounceTimer = null
    }
    discardPendingEdit()
  }

  store.updateBlockText(block.id, event.currentText)
  if (isOnline.value) {
    await props.provider.sendEdit({
      blockId: block.id,
      text: event.currentText,
      decorator: block.decorator,
    })
  }
  if (!props.editable) return

  clearLockTimers()
  store.unlock(block.id)
  if (isOnline.value) await props.provider.sendBlockUnlock?.(block.id)

  let afterBlockId: string = block.id
  let firstCreated: Block | null = null

  for (const spec of event.blocks) {
    if (!props.editable) return
    const newBlock = createBlock(spec.type, spec.text)
    if (spec.type === 'li') {
      newBlock.decorator = serializeDecorator({
        ...defaultDecorator('li'),
        ordered: Boolean(spec.ordered),
      })
    }

    store.insertBlock(newBlock, afterBlockId)
    if (isOnline.value) {
      await props.provider.sendBlockCreate({
        block: newBlock,
        afterBlockId,
        type: spec.type,
        text: newBlock.text,
        decorator: newBlock.decorator,
      })
    }
    afterBlockId = newBlock.id
    if (!firstCreated) firstCreated = newBlock
  }

  if (!firstCreated) return

  store.setActive(firstCreated.id)
  store.lock(firstCreated.id)
  if (isOnline.value) await props.provider.sendBlockLock?.(firstCreated.id)
  resetLockTimeout(firstCreated.id)
  focusBlock(firstCreated.id, 'start')
}

const onDelete = async () => {
  const blockId = store.activeBlockId
  if (
    !props.editable ||
    !blockId ||
    store.isElaborating ||
    store.isTranslating ||
    store.isSyncing ||
    store.getConflict(blockId)
  ) {
    return
  }
  const currentBlock = store.blocks.find((b) => b.id === blockId)
  if (currentBlock && store.isLockedByOther(currentBlock)) {
    return
  }

  if (currentBlock && currentBlock.lockedBy !== store.clientId) {
    const lockSuccess = await acquireBlockLock(blockId)
    if (!lockSuccess) return
    if (!props.editable) return
  }

  const saved = await flushPendingEdit()
  if (!saved) return
  if (!props.editable) return
  clearLockTimers()
  store.unlock(blockId)
  store.removeBlock(blockId)

  if (isOnline.value) {
    await props.provider.sendBlockDelete({
      blockId,
    })
  }
}

const onUpdateText = async (block: Block, text: string) => {
  if (
    !props.editable ||
    store.isLockedByOther(block) ||
    store.elaboratingBlockId === block.id ||
    store.isTranslating ||
    store.isSyncing
  ) {
    return
  }

  // If the lock timed out while we were still focused, re-acquire it before
  // sending so the server-side lock check accepts the edit.
  if (block.lockedBy !== store.clientId) {
    const lockSuccess = await acquireBlockLock(block.id)
    if (!lockSuccess) return
    if (!props.editable) return
  }

  if (pendingEditBlockId && pendingEditBlockId !== block.id) {
    const saved = await flushPendingEdit()
    if (!saved) return
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
  if (
    !props.editable ||
    !block ||
    store.isLockedByOther(block) ||
    store.elaboratingBlockId === block.id ||
    store.isTranslating ||
    store.isSyncing ||
    store.getConflict(block.id)
  ) {
    return
  }

  if (block.lockedBy !== store.clientId) {
    const lockSuccess = await acquireBlockLock(block.id)
    if (!lockSuccess) return
    if (!props.editable) return
  }

  if (pendingEditBlockId && pendingEditBlockId !== block.id) {
    const saved = await flushPendingEdit()
    if (!saved) return
  }

  const serialized = serializeDecorator(newDecorator)
  store.updateBlockDecorator(block.id, serialized)
  resetLockTimeout(block.id)

  // Flush any pending text edit along with the new decorator
  if (pendingEditBlockId === block.id) {
    pendingEditDecorator = serialized
    await flushPendingEdit()
  } else if (isOnline.value) {
    const textToSend =
      store.activeLanguage === 'en' ? block.text : store.getCanonicalText(block.id) || block.text
    await props.provider.sendEdit({
      blockId: block.id,
      text: textToSend,
      decorator: serialized,
    })
  }
}

const onFocus = async (block: Block) => {
  if (!props.editable || store.isLockedByOther(block) || store.isTranslating || store.isSyncing) {
    return
  }

  const previousId = store.activeBlockId
  const previousIsElaborating = previousId === store.elaboratingBlockId
  if (
    previousId &&
    previousId !== block.id &&
    !store.isLockedByOther({ id: previousId } as Block)
  ) {
    if (!previousIsElaborating) {
      const saved = await flushPendingEdit()
      if (!saved) {
        focusBlock(previousId, 'end')
        return
      }
      if (!props.editable) return
      clearLockTimers()
      store.unlock(previousId)
      if (isOnline.value) await props.provider.sendBlockUnlock?.(previousId)
    }
  }

  store.setActive(block.id)
  const lockSuccess = await acquireBlockLock(block.id)
  if (!lockSuccess) {
    // Another client acquired the lock first in a race
    store.unlock(block.id)
    return
  }
  if (!props.editable) return

  resetLockTimeout(block.id)
}

const onBlur = async (block: Block) => {
  if (
    !props.editable ||
    store.elaboratingBlockId === block.id ||
    store.isTranslating ||
    store.isSyncing
  ) {
    return
  }
  if (!store.isLockedByOther(block)) {
    const saved = await flushPendingEdit()
    if (!saved) return
    clearLockTimers()
    store.unlock(block.id)
    if (isOnline.value) await props.provider.sendBlockUnlock?.(block.id)
  }
}

function onConflictLocalInput(blockId: string, patch: { text?: string; decorator?: string }) {
  const block = store.blocks.find((item) => item.id === blockId)
  if (!block) return
  if (patch.text !== undefined) store.updateBlockText(blockId, patch.text)
  if (patch.decorator !== undefined) store.updateBlockDecorator(blockId, patch.decorator)
  const conflict = store.getConflict(blockId)
  if (conflict) {
    store.updateConflictLocal(blockId, patch.text ?? block.text, patch.decorator ?? block.decorator)
  }
}

function findBasePredecessor(blockId: string): string | null {
  const index = store.blocks.findIndex((block) => block.id === blockId)
  if (index <= 0) return null
  const baseIds = new Set(store.base?.blocks.map((block) => block.id) ?? [])
  for (let previous = index - 1; previous >= 0; previous -= 1) {
    const candidate = store.blocks[previous]
    if (candidate && baseIds.has(candidate.id)) return candidate.id
  }
  return null
}

async function canonicalTextForConflict(block: Block): Promise<string> {
  if (store.activeLanguage === 'en' || !store.isBlockDirty(block.id)) {
    return store.activeLanguage === 'en' ? block.text : store.getCanonicalText(block.id)
  }
  if (isCodeOrCitation(block.decorator)) {
    store.setCanonicalText(block.id, block.text)
    store.clearBlockDirty(block.id)
    return block.text
  }
  const canonical = await backTranslateBlock(
    block.text,
    store.activeLanguage,
    'en',
    getSurroundingContext(block.id),
  )
  store.setCanonicalText(block.id, canonical)
  store.clearBlockDirty(block.id)
  return canonical
}

async function onResolveConflict(blockId: string, choice: 'local' | 'remote') {
  const epoch = syncEpoch
  const conflict = store.getConflict(blockId)
  const block = store.blocks.find((item) => item.id === blockId) ?? null
  if (!conflict) return
  store.setSyncError(null)

  if (choice === 'remote') {
    store.setSyncing(true)
    try {
      if (conflict.kind === 'remote-deleted') {
        store.removeBlock(blockId)
        store.removeBaseBlockFingerprint(blockId)
      } else if (conflict.remote) {
        store.initCanonicalBlocks([
          {
            id: blockId,
            text: conflict.remote.text,
            decorator: conflict.remote.decorator,
            lockedBy: null,
          },
        ])
        store.clearBlockDirty(blockId)
        if (store.activeLanguage === 'en') {
          store.updateBlockText(blockId, conflict.remote.text)
        }
        store.updateBlockDecorator(blockId, conflict.remote.decorator)
        if (store.activeLanguage !== 'en') {
          if (isCodeOrCitation(conflict.remote.decorator)) {
            store.applyRemoteText(blockId, conflict.remote.text)
          } else {
            void translateBlocks(
              [{ id: blockId, text: conflict.remote.text }],
              'en',
              store.activeLanguage,
            )
              .then((translated) => {
                const first = translated[0]
                if (first) store.applyRemoteText(blockId, first.text)
              })
              .catch((err) => logger.error('Failed to translate resolved remote block:', err))
          }
        }
        await store.setBaseBlockFingerprint(blockId, {
          id: blockId,
          text: conflict.remote.text,
          decorator: conflict.remote.decorator,
          lockedBy: null,
        })
        if (epoch !== syncEpoch) return
      } else {
        store.removeBaseBlockFingerprint(blockId)
      }
      store.removeConflict(blockId)
      await syncPendingLocalChanges()
    } catch (err) {
      logger.error('Failed to apply remote conflict version:', err)
      store.setSyncError(t('editor.conflict.syncFailed'))
    } finally {
      store.setSyncing(false)
    }
    return
  }

  if (!block) {
    store.removeConflict(blockId)
    return
  }

  if (!isOnline.value) {
    store.setSyncError(t('editor.conflict.syncUnavailable'))
    return
  }

  store.setSyncing(true)
  try {
    let operation: SyncOperation | null = null
    let baseBlock: Block | null = block

    if (conflict.kind === 'local-deleted') {
      if (!conflict.remoteFingerprint) {
        store.removeBlock(blockId)
        store.removeConflict(blockId)
        return
      }
      operation = {
        kind: 'delete',
        blockId,
        expected: conflict.remoteFingerprint,
      }
      baseBlock = null
    } else {
      const canonical = await canonicalTextForConflict(block)
      if (conflict.kind === 'remote-deleted') {
        baseBlock = { ...block, text: canonical }
        operation = {
          kind: 'create',
          block: baseBlock,
          afterBlockId: findBasePredecessor(blockId),
          expected: null,
        }
      } else {
        if (!conflict.remoteFingerprint) {
          store.setSyncError(t('editor.conflict.missingRemoteVersion'))
          return
        }
        baseBlock = { ...block, text: canonical }
        operation = {
          kind: 'set',
          blockId,
          text: canonical,
          decorator: block.decorator,
          expected: conflict.remoteFingerprint,
        }
      }
    }

    if (!operation) return
    const result = await sendSyncOperations([operation])
    if (epoch !== syncEpoch) return
    if (!result) return

    if (conflict.kind === 'local-deleted') store.removeBlock(blockId)
    store.removeConflict(blockId)
    await store.recordBaseOperation(operation, baseBlock, result.contentHash, store.title)
    await syncPendingLocalChanges()
  } catch (err) {
    logger.error('Failed to resolve conflict:', err)
    store.setSyncError(t('editor.conflict.syncFailed'))
  } finally {
    store.setSyncing(false)
  }
}

const onElaborate = async (personaKey: PersonaKey) => {
  const block = store.activeBlock
  if (
    !props.editable ||
    !block ||
    store.isLockedByOther(block) ||
    store.isElaborating ||
    store.isTranslating ||
    !isOnline.value ||
    store.isSyncing ||
    store.getConflict(block.id)
  ) {
    return
  }
  const decorator = parseDecorator(block.decorator)
  if (decorator.type !== 'p') return

  const blockId = block.id
  const previousText = block.text
  const abortController = new AbortController()
  let streamedEnglish = ''
  let sourceText: string | null = null
  let committed = false

  store.beginElaboration(blockId)
  clearLockTimeout()
  elaborationAbortController = abortController

  try {
    if (block.lockedBy !== store.clientId) {
      const lockSuccess = await acquireBlockLock(blockId)
      if (!lockSuccess) return
      if (!props.editable) return
    }

    startElaborationLockHeartbeat(blockId)
    const saved = await flushPendingEdit()
    if (!saved) return
    if (!props.editable) return

    let englishText = store.getCanonicalText(blockId)
    if (!englishText && store.activeLanguage === 'en') {
      englishText = block.text
    }

    if (store.activeLanguage !== 'en' && store.isBlockDirty(blockId)) {
      try {
        const surroundingContext = getSurroundingContext(blockId)
        englishText = await backTranslateBlock(
          block.text,
          store.activeLanguage,
          'en',
          surroundingContext,
        )
        if (!props.editable) return
        store.setCanonicalText(blockId, englishText)
        store.clearBlockDirty(blockId)
      } catch (err) {
        logger.error('Back-translation before elaboration failed:', err)
      }
    }

    if (!englishText.trim()) return

    sourceText = englishText
    const surroundingContext = getSurroundingContext(blockId)
    const elaboratedEnglish = await elaborateBlock(sourceText, personaKey, surroundingContext, {
      signal: abortController.signal,
      onDelta: (chunk) => {
        if (abortController.signal.aborted) return
        streamedEnglish += chunk
        store.previewBlockText(blockId, streamedEnglish)
      },
    })

    if (!elaboratedEnglish) return

    const currentBlock = store.blocks.find((item) => item.id === blockId)
    if (
      !currentBlock ||
      store.getCanonicalText(blockId) !== sourceText ||
      store.isLockedByOther(currentBlock)
    ) {
      logger.warn('Discarding stale AI elaboration result')
      return
    }
    if (!props.editable) return

    store.setCanonicalText(blockId, elaboratedEnglish)

    if (store.activeLanguage === 'en') {
      store.updateBlockText(blockId, elaboratedEnglish)
      store.clearBlockDirty(blockId)
      await props.provider.sendEdit({
        blockId,
        text: elaboratedEnglish,
        decorator: currentBlock.decorator,
      })
    } else {
      await props.provider.sendEdit({
        blockId,
        text: elaboratedEnglish,
        decorator: currentBlock.decorator,
      })

      const translated = await translateBlocks(
        [{ id: blockId, text: elaboratedEnglish }],
        'en',
        store.activeLanguage,
      )
      const targetText = translated[0]?.text ?? elaboratedEnglish
      store.updateBlockText(blockId, targetText)
      store.clearBlockDirty(blockId)
    }

    committed = true
  } catch (err) {
    if (!abortController.signal.aborted) {
      logger.error('AI elaboration failed:', err)
      emit('error', err instanceof Error ? err.message : t('editor.elaborate.failed'))
    }
  } finally {
    stopElaborationLockHeartbeat()
    if (elaborationAbortController === abortController) {
      elaborationAbortController = null
    }
    store.endElaboration()

    const currentBlock = store.blocks.find((item) => item.id === blockId)
    if (currentBlock) {
      if (!committed && (sourceText === null || store.getCanonicalText(blockId) === sourceText)) {
        store.previewBlockText(blockId, previousText)
      }

      if (store.activeBlockId === blockId && !store.isLockedByOther(currentBlock)) {
        resetLockTimeout(blockId)
      } else {
        store.unlock(blockId)
        if (props.editable) {
          await props.provider.sendBlockUnlock?.(blockId)
        }
      }
    }
  }
}

defineExpose({
  onGeneratePdf,
})
</script>

<style lang="css" scoped>
/* Widen only the live editor; export clones retain the fixed PDF body width. */
.editor__content
  :deep(
    .content-wrapper:not([data-vue-pdf-export-staging]):not([data-vue-pdf-export-text-snapshot])
  ) {
  width: 100% !important;
}
</style>
