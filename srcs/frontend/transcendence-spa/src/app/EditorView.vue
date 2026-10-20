<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Editor from '@/app/components/Editor.vue'
import Button from '@/app/components/Button.vue'
import Icon from '@/app/components/Icon.vue'
import { WebSocketEditorDataProvider } from '@/app/editor/dataProvider'
import type { EditorDataProvider } from '@/app/editor/types'
import { createBlock } from '@/app/editor/types'
import { useAuthStore } from '@/stores/auth'
import { createDocument, getDocument, updateDocumentTitle } from '@/app/editor/document.api'
import ShareModal from '@/app/components/ShareModal.vue'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

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
          @blur="onTitleBlur"
          @keydown="onTitleKeydown"
        >
          {{ documentTitle }}
        </h1>
        <div class="flex items-center gap-2">
          <span
            class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold"
            :class="statusClass"
          >
            {{
              connectionStatus === 'connected'
                ? 'Multiuser Room Live'
                : connectionStatus === 'connecting'
                  ? 'Connecting to Room...'
                  : 'Disconnected'
            }}
          </span>
          <span v-if="documentId" class="font-mono text-xs text-muted">
            Room: {{ documentId.slice(0, 8) }}...
          </span>
          <span
            v-if="userPermission"
            class="inline-flex items-center rounded-full bg-subtle px-2 py-0.5 text-xs font-semibold text-ink-secondary capitalize"
          >
            Role: {{ userPermission }}
          </span>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <Button v-if="documentId" variant="outlined" size="small" @click="showShareModal = true">
          <template #icon>
            <Icon name="Share" :size="16" />
          </template>
          Share
        </Button>
        <Button variant="outlined" size="small" @click="handleCreateNew"> + New Document </Button>
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
    />

    <ShareModal
      v-if="documentId"
      v-model="showShareModal"
      :document-id="documentId"
      :is-owner="userPermission === 'owner'"
    />
  </div>
</template>
