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
import ShareModal from '@/app/components/ShareModal.vue'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const editorStore = useEditorStore()

const provider = ref<EditorDataProvider | null>(null)
const documentTitle = ref<string>('Untitled Document')
const titleEl = ref<HTMLElement | null>(null)
const documentId = ref<string | null>(null)
const userPermission = ref<'owner' | 'editor' | 'viewer'>('viewer')
const isTitleEditable = computed(
  () => userPermission.value === 'owner' || userPermission.value === 'editor',
)
const showShareModal = ref(false)
const connectionStatus = ref<'connecting' | 'connected' | 'disconnected'>('connecting')
const errorMessage = ref<string | null>(null)
const isLoading = ref<boolean>(true)

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
        titleEl.value.innerText = e.title
      }
    }
    if (e.permission) userPermission.value = e.permission
    connectionStatus.value = 'connected'
  }

  wsProvider.onTitleUpdated = (e) => {
    if (e.title) {
      documentTitle.value = e.title
      if (titleEl.value && document.activeElement !== titleEl.value) {
        titleEl.value.innerText = e.title
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
    titleEl.value.innerText = newTitle
  }
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

function onTitleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    e.preventDefault()
    titleEl.value?.blur()
  } else if (e.key === 'Escape') {
    e.preventDefault()
    if (titleEl.value) {
      titleEl.value.innerText = documentTitle.value
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
    // Route /editor called -> create new document and open room automatically
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
    // Route /editor/:id called -> open document if known, else push to /
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
  <div class="page-container editor-view">
    <div class="editor-view__header">
      <div class="editor-view__meta">
        <h1
          ref="titleEl"
          class="editor-view__title"
          :class="{ 'editor-view__title--editable': isTitleEditable }"
          :contenteditable="isTitleEditable"
          spellcheck="false"
          :title="isTitleEditable ? 'Click to rename document' : undefined"
          @blur="onTitleBlur"
          @keydown="onTitleKeydown"
        >
          {{ documentTitle }}
        </h1>
        <div class="editor-view__badges">
          <span class="status-badge" :class="`status-badge--${connectionStatus}`">
            {{
              connectionStatus === 'connected'
                ? 'Multiuser Room Live'
                : connectionStatus === 'connecting'
                  ? 'Connecting to Room...'
                  : 'Disconnected'
            }}
          </span>
          <span
            v-if="documentId"
            class="doc-id-badge"
          >
            Room: {{ documentId.slice(0, 8) }}...
          </span>
          <span v-if="userPermission" class="permission-badge"> Role: {{ userPermission }} </span>
        </div>
      </div>
      <div class="editor-view__actions">
        <div class="lang-selector-group" title="AI Document Translation (EU AI Act Compliant)">
          <span v-if="editorStore.isTranslating" class="lang-translating-pill">
            AI Translating...
          </span>
          <div class="lang-selector-wrapper">
            <select
              class="lang-selector"
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
          Share
        </Button>
      </div>
    </div>

    <div
      v-if="errorMessage"
      class="editor-view__error"
    >
      {{ errorMessage }}
    </div>

    <div v-if="isLoading" class="editor-view__loading">Initializing document room...</div>

    <Editor
      v-else-if="provider"
      :provider="provider"
      :scrollable="false"
      nav-position="top"
      :filename="documentTitle"
      @error="errorMessage = $event"
    />

    <!-- Share Modal for inviting collaborators and managing access -->
    <ShareModal
      v-if="documentId"
      v-model="showShareModal"
      :document-id="documentId"
      :is-owner="userPermission === 'owner'"
    />
  </div>
</template>

<style scoped>
.editor-view {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
  max-width: 920px;
  margin: 0 auto;
  padding: 24px 16px;
}

.editor-view__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border-subtle);
}

.editor-view__meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.editor-view__title {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-base);
}

.editor-view__title--editable {
  outline: none;
  border-radius: 4px;
  padding: 2px 6px;
  margin-left: -6px;
  transition:
    background-color 0.2s,
    box-shadow 0.2s;
  cursor: text;
}

.editor-view__title--editable:hover {
  background-color: var(--bg-subtle, rgba(0, 0, 0, 0.05));
}

.editor-view__title--editable:focus {
  background-color: var(--bg-surface, #fff);
  box-shadow: 0 0 0 2px var(--color-primary, #3b82f6);
}

.editor-view__badges {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 600;
}

.status-badge--connected {
  background-color: color-mix(in srgb, var(--color-success, #22c55e) 15%, transparent);
  color: var(--color-success, #22c55e);
}

.status-badge--connecting {
  background-color: color-mix(in srgb, var(--color-warn, #eab308) 15%, transparent);
  color: var(--color-warn, #eab308);
}

.status-badge--disconnected {
  background-color: color-mix(in srgb, var(--color-alert, #ef4444) 15%, transparent);
  color: var(--color-alert, #ef4444);
}

.doc-id-badge {
  font-size: 0.75rem;
  color: var(--text-muted);
  font-family: monospace;
}

.permission-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 600;
  background-color: var(--bg-subtle);
  color: var(--text-secondary);
  text-transform: capitalize;
}

.editor-view__actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.lang-selector-group {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.lang-selector-wrapper {
  position: relative;
  display: inline-flex;
  align-items: center;
}

.lang-sparkle-icon {
  position: absolute;
  left: 8px;
  pointer-events: none;
  color: var(--color-primary, #3b82f6);
}

.lang-selector {
  background-color: var(--bg-surface);
  color: var(--text-primary);
  border: 1px solid var(--border-default);
  border-radius: 6px;
  padding: 5px 10px 5px 28px;
  font-size: 0.8125rem;
  font-weight: 500;
  outline: none;
  cursor: pointer;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.lang-selector option {
  background-color: var(--bg-surface);
  color: var(--text-primary);
}

.lang-selector:focus {
  border-color: var(--color-primary, #3b82f6);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-primary, #3b82f6) 20%, transparent);
}

.lang-selector:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.lang-translating-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.75rem;
  font-weight: 600;
  padding: 3px 9px;
  border-radius: 9999px;
  background-color: color-mix(in srgb, var(--color-primary, #3b82f6) 18%, transparent);
  color: var(--color-primary, #3b82f6);
}

.ai-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.7rem;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 9999px;
  background-color: color-mix(in srgb, var(--color-warn, #f59e0b) 15%, transparent);
  color: var(--color-warn, #f59e0b);
  border: 1px solid color-mix(in srgb, var(--color-warn, #f59e0b) 30%, transparent);
}

.sparkle-pulse {
  animation: spin-pulse 2s infinite linear;
}

@keyframes spin-pulse {
  0% { transform: scale(1) rotate(0deg); }
  50% { transform: scale(1.15) rotate(180deg); }
  100% { transform: scale(1) rotate(360deg); }
}

.editor-view__error {
  padding: 10px 14px;
  border-radius: 8px;
  background-color: color-mix(in srgb, var(--color-alert, #ef4444) 12%, transparent);
  border: 1px solid var(--color-alert, #ef4444);
  color: var(--color-alert, #ef4444);
  font-size: 0.875rem;
}

.editor-view__loading {
  padding: 48px 16px;
  text-align: center;
  color: var(--text-muted);
  font-style: italic;
}
</style>
