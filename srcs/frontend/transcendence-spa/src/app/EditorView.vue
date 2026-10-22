<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import Editor from '@/app/components/Editor.vue'
import Button from '@/app/components/Button.vue'
import Icon from '@/app/components/Icon.vue'
import { WebSocketEditorDataProvider } from '@/app/editor/dataProvider'
import { createBlock, type EditorDataProvider } from '@/app/editor/types'
import { useAuthStore } from '@/stores/auth'
import { createDocument, getDocument, updateDocumentTitle } from '@/app/editor/document.api'
import { insertPlainText } from '@/app/editor/plainTextPaste'
import { DOCUMENT_TITLE_MAX_LENGTH } from '@/utils/validation'
import { truncateTitle } from '@/utils/title'
import { logger } from '@/utils/logger'
import ShareModal from '@/app/components/ShareModal.vue'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const { t } = useI18n()

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
const editorElement = ref<typeof Editor | null>(null)

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

async function onTitleBlur() {
  if (!isTitleEditable.value || !titleEl.value) return
  let newTitle = (titleEl.value.innerText || '').trim()
  if (!newTitle) {
    newTitle = documentTitle.value || 'Untitled Document' // Title has to remain english
    titleEl.value.innerText = newTitle
  }
  if (newTitle.length > DOCUMENT_TITLE_MAX_LENGTH) {
    newTitle = newTitle.slice(0, DOCUMENT_TITLE_MAX_LENGTH)
    titleError.value = t('editor.titleTooLong', { max: DOCUMENT_TITLE_MAX_LENGTH })
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
        logger.error('Failed to update title via REST API:', err)
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
    titleError.value = t('editor.titleTooLong', { max: DOCUMENT_TITLE_MAX_LENGTH })
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
    titleError.value = t('editor.titleTooLong', { max: DOCUMENT_TITLE_MAX_LENGTH })
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

  const user = await authStore.checkForAuthentication()
  if (!user) {
    isLoading.value = false
    await router.replace('/login')
    return
  }

  const id = idParam || (route.params.id as string | undefined)

  if (!id) {
    try {
      // Document content is stored in English and translated per viewer at display time.
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
      logger.error('Failed to create new document room:', err)
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
      logger.error('Unknown document id or access denied:', err)
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
    class="box-border mx-auto flex h-[calc(100dvh_-_var(--header-height))] w-full max-w-[920px] flex-col gap-4 overflow-x-hidden overflow-y-auto px-4 pb-6"
  >
    <div
      class="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-line-subtle pt-6 pb-3"
    >
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
          :title="isTitleEditable ? $t('editor.clickToRename') : undefined"
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
          <span
            v-if="userPermission"
            class="inline-flex items-center rounded-full bg-subtle px-2 py-0.5 text-xs font-semibold text-ink-secondary capitalize"
            :title="$t('editor.yourRole')"
          >
            {{ $t(`editor.roles.${userPermission}`) }}
          </span>
        </div>
      </div>
      <div class="flex flex-wrap items-center justify-end gap-2">
        <Button v-if="documentId" variant="outlined" size="small" @click="showShareModal = true">
          <template #icon>
            <Icon name="Share" :size="16" />
          </template>
          <span class="btn--lable max-sm:hidden">{{ $t('editor.share') }}</span>
        </Button>
        <Button variant="outlined" size="small" @click="handleCreateNew">
          <template #icon>
            <Icon name="Plus" />
          </template>
          <span class="btn--lable max-sm:hidden">{{ $t('editor.newDocument') }}</span>
        </Button>
        <Button variant="outlined" size="small" @click="editorElement?.onGeneratePdf()">
          <template #icon>
            <Icon name="FilePDF" />
          </template>
          <span class="btn--lable max-sm:hidden">{{ $t('editor.generatePdf') }}</span>
        </Button>
      </div>
    </div>

    <div
      v-if="errorMessage"
      class="shrink-0 rounded-lg border border-danger bg-danger/12 px-3.5 py-2.5 text-sm text-danger"
    >
      {{ errorMessage }}
    </div>
    <div v-if="isLoading" class="px-4 py-12 text-center text-muted italic">
      {{ $t('editor.initializing') }}
    </div>
    <Editor
      v-else-if="provider"
      class="shrink-0"
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

<style scoped>
.btn--lable {
  display: block;
}

@media (max-width: 768px) {
  .btn--lable {
    display: none;
  }
}
</style>
