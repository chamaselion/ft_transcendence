<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Editor from '@/app/components/Editor.vue'
import Button from '@/app/components/Button.vue'
import Icon from '@/app/components/Icon.vue'
import { WebSocketEditorDataProvider } from '@/app/editor/dataProvider'
import { createBlock, isCodeOrCitation, type EditorDataProvider } from '@/app/editor/types'
import { useAuthStore } from '@/stores/auth'
import { useEditorStore } from '@/stores/editor'
import { translateBlocks, type SupportedLanguage } from '@/app/editor/translation.api'
import { createDocument, getDocument, updateDocumentTitle } from '@/app/editor/document.api'
import { insertPlainText } from '@/app/editor/plainTextPaste'
import { DOCUMENT_TITLE_MAX_LENGTH } from '@/utils/validation'
import { truncateTitle } from '@/utils/title'
import ShareModal from '@/app/components/ShareModal.vue'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const editorStore = useEditorStore()

const provider = ref<EditorDataProvider | null>(null)
const documentTitle = ref<string>('Untitled Document')
const displayTitle = computed(() => truncateTitle(documentTitle.value))
const titleEl = ref<HTMLElement | null>(null)
const documentId = ref<string | null>(null)
const userPermission = ref<'owner' | 'editor' | 'viewer'>('viewer')
const isTitleEditable = computed(
  () => userPermission.value === 'owner' || userPermission.value === 'editor',
)
const showShareModal = ref(false)
const connectionStatus = ref<'connecting' | 'connected' | 'disconnected'>('connecting')
const errorMessage = ref<string | null>(null)
const titleError = ref('')
const isLoading = ref<boolean>(true)
const editorElement = ref<typeof Editor | null>(null);

const statusClass = computed(
  () =>
    ({
      connected: 'bg-success/15 text-success',
      connecting: 'bg-warning/15 text-warning',
      disconnected: 'bg-danger/15 text-danger',
    })[connectionStatus.value],
)

function openRoom(docId: string, initialTitle?: string) {
  if (initialTitle) documentTitle.value = initialTitle
  documentId.value = docId
  connectionStatus.value = 'connecting'
  errorMessage.value = null

  if (provider.value) {
    provider.value.destroy?.()
    provider.value = null
  }

  const wsProvider = new WebSocketEditorDataProvider({
    documentId: docId,
    onOpen: () => {
      connectionStatus.value = 'connected'
    },
    onClose: () => {
      if (connectionStatus.value === 'connected') {
        connectionStatus.value = 'disconnected'
      }
    },
  })

  wsProvider.onInit = (e) => {
    if (e.title) {
      documentTitle.value = e.title
      if (titleEl.value && document.activeElement !== titleEl.value) {
        titleEl.value.innerText = truncateTitle(e.title)
      }
    }
    if (e.permission) userPermission.value = e.permission
    connectionStatus.value = 'connected'
  }

  wsProvider.onTitleUpdated = (e) => {
    if (e.title) {
      documentTitle.value = e.title
      if (titleEl.value && document.activeElement !== titleEl.value) {
        titleEl.value.innerText = truncateTitle(e.title)
      }
    }
  }

  wsProvider.onError = (e) => {
    errorMessage.value = e.error
    if (e.error === 'Document not found' || e.error === 'Access to document was revoked') {
      router.push('/')
    }
  }

  provider.value = wsProvider
}

async function onLanguageChange(targetLang: SupportedLanguage) {
  if (targetLang === editorStore.activeLanguage) return
  if (targetLang === 'en') {
    editorStore.setLanguage('en')
    return
  }

  editorStore.isTranslating = true
  editorStore.translationError = null
  try {
    // remove code and citation blocks from translation, as they are not translatable
    const filteredBlocks = editorStore.blocks.filter((b) => !isCodeOrCitation(b.decorator))
    const payload = filteredBlocks.map((b) => ({
      id: b.id,
      text: editorStore.getCanonicalText(b.id) || b.text,
    }))
    const translated = await translateBlocks(payload, 'en', targetLang)
    editorStore.applyTranslations(translated)
    editorStore.setLanguage(targetLang)
  } catch (err) {
    console.error('Document translation failed:', err)
    errorMessage.value = err instanceof Error ? err.message : 'Translation failed'
  } finally {
    editorStore.isTranslating = false
  }
}

async function onTitleBlur() {
  if (!isTitleEditable.value || !titleEl.value) return
  let newTitle = (titleEl.value.innerText || '').trim()
  if (!newTitle) {
    newTitle = documentTitle.value || 'Untitled Document'
  }
  if (newTitle.length > DOCUMENT_TITLE_MAX_LENGTH) {
    newTitle = newTitle.slice(0, DOCUMENT_TITLE_MAX_LENGTH)
    titleError.value = `Title must be at most ${DOCUMENT_TITLE_MAX_LENGTH} characters long.`
  } else {
    titleError.value = ''
  }
  titleEl.value.innerText = truncateTitle(newTitle)
  if (newTitle !== documentTitle.value) {
    documentTitle.value = newTitle
    if (provider.value?.sendTitleUpdate) {
      await provider.value.sendTitleUpdate(newTitle)
    }
    if (documentId.value) {
      try {
        await updateDocumentTitle(documentId.value, newTitle)
      } catch (err) {
        console.error('Failed to update title via REST API:', err)
      }
    }
  }
}

function onTitleFocus() {
  if (!isTitleEditable.value || !titleEl.value) return
  titleEl.value.innerText = documentTitle.value
  titleError.value = ''
}

function onTitlePaste(e: ClipboardEvent) {
  if (!isTitleEditable.value || !titleEl.value) {
    e.preventDefault()
    return
  }

  e.preventDefault()
  const currentLength = titleEl.value.innerText.length
  const remaining = Math.max(0, DOCUMENT_TITLE_MAX_LENGTH - currentLength)
  const text = e.clipboardData?.getData('text/plain') ?? ''
  if (text.length > remaining) {
    titleError.value = `Title must be at most ${DOCUMENT_TITLE_MAX_LENGTH} characters long.`
  } else {
    titleError.value = ''
  }
  insertPlainText(titleEl.value, text.slice(0, remaining), false)
}

function onTitleKeydown(e: KeyboardEvent) {
  if (
    e.key.length === 1 &&
    !e.ctrlKey &&
    !e.metaKey &&
    !e.altKey &&
    (titleEl.value?.innerText.length ?? 0) >= DOCUMENT_TITLE_MAX_LENGTH
  ) {
    e.preventDefault()
    titleError.value = `Title must be at most ${DOCUMENT_TITLE_MAX_LENGTH} characters long.`
    return
  }

  if (e.key === 'Enter') {
    e.preventDefault()
    titleEl.value?.blur()
  } else if (e.key === 'Escape') {
    e.preventDefault()
    if (titleEl.value) {
      titleEl.value.innerText = truncateTitle(documentTitle.value)
    }
    titleEl.value?.blur()
  }
}

async function loadEditor(idParam?: string) {
  isLoading.value = true
  errorMessage.value = null

  await authStore.checkForAuthentication()

  const id = idParam || (route.params.id as string | undefined)

  if (!id) {
    try {
      const defaultBlocks = [createBlock('h', 'Untitled document'), createBlock('p', '')]
      const newDoc = await createDocument('Untitled document', defaultBlocks)
      if (newDoc && newDoc.id) {
        if (newDoc.permission) userPermission.value = newDoc.permission
        await router.replace(`/editor/${newDoc.id}`)
        openRoom(newDoc.id, newDoc.title)
      } else {
        router.push('/')
      }
    } catch (err) {
      console.error('Failed to create new document room:', err)
      router.push('/')
    } finally {
      isLoading.value = false
    }
  } else {
    try {
      const doc = await getDocument(id)
      if (!doc || !doc.id) {
        router.push('/')
        return
      }
      if (doc.permission) userPermission.value = doc.permission
      openRoom(doc.id, doc.title)
    } catch (err) {
      console.error('Unknown document id or access denied:', err)
      router.push('/')
      return
    } finally {
      isLoading.value = false
    }
  }
}

function handleCreateNew() {
  router.push('/editor')
}

onMounted(() => {
  loadEditor()
})

watch(
  () => route.params.id,
  (newId) => {
    if (newId !== documentId.value) {
      loadEditor(newId as string | undefined)
    }
  },
)

onBeforeUnmount(() => {
  provider.value?.destroy?.()
  provider.value = null
})
</script>

<template>
  <div
    class="box-border mx-auto flex min-h-[calc(100vh_-_61px)] w-full max-w-[920px] flex-col gap-4 px-4 py-6"
  >
    <div class="flex items-center justify-between border-b border-line-subtle pb-3">
      <div class="flex flex-col gap-1">
        <h1
          ref="titleEl"
          class="m-0 text-2xl font-bold text-ink"
          :class="{
            'cursor-text rounded p-0.5 px-1.5 -ml-1.5 outline-none transition-[background-color,box-shadow] hover:bg-subtle focus:bg-surface focus:shadow-[0_0_0_2px_var(--color-primary)]':
              isTitleEditable,
          }"
          :contenteditable="isTitleEditable"
          spellcheck="false"
          :title="isTitleEditable ? 'Click to rename document' : undefined"
          @focus="onTitleFocus"
          @blur="onTitleBlur"
          @paste="onTitlePaste"
          @keydown="onTitleKeydown"
        >
          {{ displayTitle }}
        </h1>
        <span v-if="titleError" class="text-sm text-alert">{{ titleError }}</span>
        <div class="flex items-center gap-2">
          <span
            class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold"
            :class="statusClass"
          >
            {{
              connectionStatus === 'connected'
                ? '🟢'
                : connectionStatus === 'connecting'
                  ? '🟡'
                  : '🔴'
            }}
          </span>
          <span v-if="userPermission" class="inline-flex items-center rounded-full bg-subtle px-2 py-0.5 text-xs font-semibold text-ink-secondary capitalize" title="Your Role">
            {{ userPermission }}
          </span>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <div class="flex items-center gap-2" title="AI Document Translation (EU AI Act Compliant)">
          <span
            v-if="editorStore.isTranslating"
            class="flex items-center gap-1 rounded-full bg-brand/15 px-2 py-0.5 text-xs font-semibold whitespace-nowrap text-brand"
          >
            AI Translating...
          </span>
          <div class="relative flex items-center">
            <select
              class="cursor-pointer rounded-md border border-line bg-surface px-2 py-1 text-sm font-medium text-ink outline-none transition-colors focus:border-brand focus:ring-1 focus:ring-brand disabled:cursor-not-allowed disabled:opacity-60"
              :value="editorStore.activeLanguage"
              :disabled="editorStore.isTranslating"
              title="Select document display language"
              @change="onLanguageChange(($event.target as HTMLSelectElement).value as SupportedLanguage)"
            >
              <option value="en">🇬🇧 English</option>
              <option value="de">🇩🇪 Deutsch (AI)</option>
              <option value="hu">🇭🇺 Magyar (AI)</option>
            </select>
          </div>
        </div>
        <Button v-if="documentId" variant="outlined" size="small" @click="showShareModal = true">
          <template #icon>
            <Icon name="Share" :size="16" />
          </template>
          <span class="btn--lable">Share</span>
        </Button>
        <Button variant="outlined" size="small" @click="handleCreateNew">
          <template #icon>
            <Icon name="Plus" />
          </template>
          <span class="btn--lable">New Document</span>
        </Button>
        <Button variant="outlined" size="small" @click="editorElement?.onGeneratePdf()">
          <template #icon>
            <Icon name="FilePDF" />
          </template>
          <span class="btn--lable">Generate PDF</span>
        </Button>
        <Button v-if="documentId" variant="outlined" size="small" @click="handleCreateNew">
          <template #icon>
            <Icon name="Plus" :size="16" />
          </template>
          New Document
        </Button>
      </div>
    </div>

    <div
      v-if="errorMessage"
      class="rounded-lg border border-danger bg-danger/12 px-3.5 py-2.5 text-sm text-danger"
    >
      {{ errorMessage }}
    </div>

    <div v-if="isLoading" class="px-4 py-12 text-center text-muted italic">
      Initializing document room...
    </div>

    <Editor
      v-else-if="provider"
      :provider="provider"
      :scrollable="false"
      nav-position="top"
      :filename="documentTitle"
      @error="errorMessage = $event"
      ref="editorElement"
    />

    <ShareModal
      v-if="documentId"
      v-model="showShareModal"
      :document-id="documentId"
      :is-owner="userPermission === 'owner'"
    />
  </div>
</template>
