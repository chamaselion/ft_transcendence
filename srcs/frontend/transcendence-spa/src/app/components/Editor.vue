<template>
  <div class="editor w-full [margin:0_auto]" :class="layoutClass">
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
            <EditorBlock
              v-for="block in store.blocks"
              :key="block.id"
              data-pdf-split="avoid"
              :block="block"
              :active="block.id === store.activeBlockId && !store.isLockedByOther(block)"
              :locked="store.isLockedByOther(block)"
              :elaborating="block.id === store.elaboratingBlockId"
              :translating="store.isTranslating"
              :export-mode="isExporting"
              :editable="props.editable"
              @focus="onFocus(block)"
              @blur="onBlur(block)"
              @update:text="onUpdateText(block, $event)"
              @insert-blocks="onInsertBlocks(block, $event)"
              @update:decorator="onUpdateDecorator(block, parseDecorator($event))"
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
import EditorBlock from '@/app/components/EditorBlock.vue'
import EditorNav from '@/app/components/EditorNav.vue'
import { useEditorStore } from '@/stores/editor'
import {
  translateBlocks,
  backTranslateBlock,
  type SupportedLanguage,
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
  type EditorDataProvider,
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
}>()

const store = useEditorStore()
const { t, locale } = useI18n()

function isSupportedLanguage(value: string): value is SupportedLanguage {
  return value === 'en' || value === 'de' || value === 'hu'
}

let translationRequestId = 0

async function translateDocumentTo(targetLang: string) {
  if (!isSupportedLanguage(targetLang)) return
  if (targetLang === store.activeLanguage) return

  const requestId = ++translationRequestId
  store.isTranslating = true
  store.translationError = null
  try {
    const saved = await flushPendingEdit()
    if (!saved) return
    if (requestId !== translationRequestId) return

    if (targetLang === 'en') {
      store.setLanguage('en')
      return
    }

    const payload = store.blocks
      .filter((block) => !isCodeOrCitation(block.decorator))
      .map((block) => ({
        id: block.id,
        text: store.getCanonicalText(block.id) || block.text,
      }))
    const translated = await translateBlocks(payload, 'en', targetLang)
    if (requestId !== translationRequestId) return
    store.applyTranslations(translated)
    store.setLanguage(targetLang)
  } catch (err) {
    if (requestId !== translationRequestId) return
    logger.error('Document translation failed:', err)
    store.translationError = err instanceof Error ? err.message : t('editor.translationFailed')
    emit('error', store.translationError)
  } finally {
    if (requestId === translationRequestId) store.isTranslating = false
  }
}

const isDeleteDisabled = computed(() => {
  if (!props.editable || !store.activeBlock) return true
  return store.isLockedByOther(store.activeBlock) || store.isElaborating || store.isTranslating
})

const isElaborating = computed(() => store.isElaborating)
const filename = computed(() => props.filename)

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

function hasPendingData(): boolean {
  return Boolean(
    flushPromise || editDebounceTimer || (pendingEditBlockId !== null && pendingEditText !== null),
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
    if (!props.editable) return
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
        const lockSuccess = await props.provider.sendBlockLock?.(blockId)
        if (lockSuccess === false) return false
        if (!props.editable) return false
        store.lock(blockId)
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
  if (hasPendingData()) {
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

function wireProvider(provider: EditorDataProvider) {
  if ('clientId' in provider && typeof (provider as { clientId?: unknown }).clientId === 'string') {
    store.setClientId((provider as { clientId: string }).clientId)
  }

  provider.onInit = (e) => {
    store.initCanonicalBlocks(e.blocks)
    store.setBlocks(e.blocks)
    if (isSupportedLanguage(locale.value)) {
      store.setLanguage(locale.value)
    }
    if (store.activeLanguage !== 'en') {
      const requestedLang = store.activeLanguage
      const requestId = translationRequestId
      const translatable = e.blocks.filter((b) => !isCodeOrCitation(b.decorator))
      const payload = translatable.map((b) => ({ id: b.id, text: b.text }))
      if (payload.length > 0) {
        store.isTranslating = true
        translateBlocks(payload, 'en', requestedLang)
          .then((res) => {
            if (requestId !== translationRequestId || store.activeLanguage !== requestedLang) return
            store.applyTranslations(res)
          })
          .catch((err) => logger.error('Failed to translate initial blocks:', err))
          .finally(() => {
            if (requestId === translationRequestId) store.isTranslating = false
          })
      }
    }
  }

  provider.onCreated = (e) => {
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

  provider.onUpdated = (e) => {
    if (e.text !== undefined) {
      store.setCanonicalText(e.blockId, e.text)
      if (store.activeLanguage === 'en') {
        store.updateBlockText(e.blockId, e.text)
      } else {
        // If local user is not actively editing this block, translate it to activeLanguage
        if (store.activeBlockId !== e.blockId) {
          const currentBlock = store.blocks.find((b) => b.id === e.blockId)
          if (!currentBlock || !isCodeOrCitation(currentBlock.decorator)) {
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
                  store.updateBlockText(e.blockId, first.text)
                }
              })
              .catch((err) => logger.error('Failed to translate updated block:', err))
          }
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
  window.removeEventListener('beforeunload', handleBeforeUnload)
  abortElaboration()
  flushPendingEdit()
  clearLockTimers()
  if (store.activeBlockId && !store.isLockedByOther({ id: store.activeBlockId } as Block)) {
    props.provider.sendBlockUnlock?.(store.activeBlockId)
  }
})

onBeforeRouteLeave(async () => {
  abortElaboration()
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
    await props.provider.sendBlockUnlock?.(activeId)
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
  () => locale.value,
  async (nextLocale) => {
    if (store.isElaborating) return
    await translateDocumentTo(nextLocale)
  },
)

const onAdd = async (type: BlockType) => {
  if (!props.editable || store.isElaborating || store.isTranslating) return
  const previousId = store.activeBlockId
  if (previousId && !store.isLockedByOther({ id: previousId } as Block)) {
    const saved = await flushPendingEdit()
    if (!saved) return
    clearLockTimers()
    store.unlock(previousId)
    await props.provider.sendBlockUnlock?.(previousId)
  }
  if (!props.editable) return

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
    store.isTranslating
  ) {
    return
  }

  if (block.lockedBy !== store.clientId) {
    const lockSuccess = await props.provider.sendBlockLock?.(block.id)
    if (lockSuccess === false) return
    if (!props.editable) return
    store.lock(block.id)
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
  await props.provider.sendEdit({
    blockId: block.id,
    text: event.currentText,
    decorator: block.decorator,
  })
  if (!props.editable) return

  clearLockTimers()
  store.unlock(block.id)
  await props.provider.sendBlockUnlock?.(block.id)

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
    await props.provider.sendBlockCreate({
      block: newBlock,
      afterBlockId,
      type: spec.type,
      text: newBlock.text,
      decorator: newBlock.decorator,
    })
    afterBlockId = newBlock.id
    if (!firstCreated) firstCreated = newBlock
  }

  if (!firstCreated) return

  store.setActive(firstCreated.id)
  store.lock(firstCreated.id)
  await props.provider.sendBlockLock?.(firstCreated.id)
  resetLockTimeout(firstCreated.id)
  focusBlock(firstCreated.id, 'start')
}

const onDelete = async () => {
  const blockId = store.activeBlockId
  if (!props.editable || !blockId || store.isElaborating || store.isTranslating) return
  const currentBlock = store.blocks.find((b) => b.id === blockId)
  if (currentBlock && store.isLockedByOther(currentBlock)) {
    return
  }

  // Ensure this client holds the lock before deleting (double to backend to avoid race conditions)
  if (currentBlock && currentBlock.lockedBy !== store.clientId) {
    const lockSuccess = await props.provider.sendBlockLock?.(blockId)
    if (lockSuccess === false) return
    if (!props.editable) return
    store.lock(blockId)
  }

  const saved = await flushPendingEdit()
  if (!saved) return
  if (!props.editable) return
  clearLockTimers()
  store.unlock(blockId)
  store.removeBlock(blockId)

  await props.provider.sendBlockDelete({
    blockId,
  })
}

const onUpdateText = async (block: Block, text: string) => {
  if (
    !props.editable ||
    store.isLockedByOther(block) ||
    store.elaboratingBlockId === block.id ||
    store.isTranslating
  ) {
    return
  }

  // If the lock timed out while we were still focused, re-acquire it before sending so the server-side lock check accepts the edit.
  if (block.lockedBy !== store.clientId) {
    const lockSuccess = await props.provider.sendBlockLock?.(block.id)
    if (lockSuccess === false) return
    if (!props.editable) return
    store.lock(block.id)
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
    store.isTranslating
  ) {
    return
  }

  // Re-acquire lock if needed
  if (block.lockedBy !== store.clientId) {
    const lockSuccess = await props.provider.sendBlockLock?.(block.id)
    if (lockSuccess === false) return
    if (!props.editable) return
    store.lock(block.id)
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
  } else {
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
  if (!props.editable || store.isLockedByOther(block) || store.isTranslating) {
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
      await props.provider.sendBlockUnlock?.(previousId)
    }
  }

  store.setActive(block.id)
  store.lock(block.id)

  const lockSuccess = await props.provider.sendBlockLock?.(block.id)
  if (lockSuccess === false) {
    // Another client acquired the lock first in a race
    store.unlock(block.id)
    return
  }
  if (!props.editable) return

  resetLockTimeout(block.id)
}

const onBlur = async (block: Block) => {
  if (!props.editable || store.elaboratingBlockId === block.id || store.isTranslating) return
  if (!store.isLockedByOther(block)) {
    const saved = await flushPendingEdit()
    if (!saved) return
    clearLockTimers()
    store.unlock(block.id)
    await props.provider.sendBlockUnlock?.(block.id)
  }
}

const onElaborate = async (personaKey: PersonaKey) => {
  const block = store.activeBlock
  if (
    !props.editable ||
    !block ||
    store.isLockedByOther(block) ||
    store.isElaborating ||
    store.isTranslating
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
      const lockSuccess = await props.provider.sendBlockLock?.(blockId)
      if (lockSuccess === false) return
      if (!props.editable) return
      store.lock(blockId)
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
