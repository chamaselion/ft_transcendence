<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRoute } from 'vue-router'
import Editor from '@/app/components/Editor.vue'
import Button from '@/app/components/Button.vue'
import {
  WebSocketEditorDataProvider,
  LocalEditorDataProvider,
} from '@/app/editor/dataProvider'
import type { EditorDataProvider } from '@/app/editor/types'
import { createBlock } from '@/app/editor/types'
import { useUserStore } from '@/stores/user'
import { httpClient } from '@/auth/auth.api'

const route = useRoute()
const userStore = useUserStore()

const provider = ref<EditorDataProvider | null>(null)
const documentTitle = ref<string>('Untitled Document')
const documentId = ref<string | null>(null)
const connectionStatus = ref<'connecting' | 'connected' | 'disconnected' | 'local'>('local')
const errorMessage = ref<string | null>(null)

const sampleBlocks = [
  createBlock('h', 'Collaborative Block Editor'),
  createBlock(
    'p',
    'Welcome! This editor uses a block-based architecture with fine-grained real-time sync.',
  ),
  createBlock('li', 'Focus any block to start typing\nUse the toolbar on top to add or delete blocks\nMultiuser presence locks are resolved automatically'),
  createBlock('cit', 'Simplicity is prerequisite for reliability. — Edsger W. Dijkstra'),
  createBlock('c', 'console.log("Real-time editing ready!");'),
]

async function initializeProvider() {
  await userStore.fetchCurrentUser()

  const idFromQuery = (route.query.id as string) || (route.query.documentId as string)

  if (idFromQuery) {
    documentId.value = idFromQuery
    connectionStatus.value = 'connecting'

    const wsProvider = new WebSocketEditorDataProvider({
      documentId: idFromQuery,
      onOpen: () => {
        connectionStatus.value = 'connected'
      },
      onClose: () => {
        if (connectionStatus.value === 'connected') {
          connectionStatus.value = 'disconnected'
        }
      },
    })

    const prevInit = wsProvider.onInit
    wsProvider.onInit = (e) => {
      prevInit(e)
      if (e.title) documentTitle.value = e.title
      connectionStatus.value = 'connected'
    }

    const prevError = wsProvider.onError
    wsProvider.onError = (e) => {
      prevError(e)
      errorMessage.value = e.error
    }

    provider.value = wsProvider
  } else {
    // Local / Offline fallback mode
    connectionStatus.value = 'local'
    documentTitle.value = 'Local Workspace'
    provider.value = new LocalEditorDataProvider(sampleBlocks)
  }
}

async function createNewRemoteDocument() {
  try {
    const res = await httpClient.post<{ document: { id: string; title: string } }>('/api/documents', {
      title: 'New Document',
      content: JSON.stringify(sampleBlocks),
    })
    if (res?.document?.id) {
      window.location.search = `?id=${res.document.id}`
    }
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Failed to create document'
  }
}

onMounted(() => {
  initializeProvider()
})

onBeforeUnmount(() => {
  provider.value?.destroy?.()
})
</script>

<template>
  <div class="page-container editor-view">
    <div class="editor-view__header">
      <div class="editor-view__meta">
        <h1 class="editor-view__title">{{ documentTitle }}</h1>
        <div class="editor-view__badges">
          <span
            class="status-badge"
            :class="`status-badge--${connectionStatus}`"
          >
            {{
              connectionStatus === 'connected'
                ? 'Connected (Room Live)'
                : connectionStatus === 'connecting'
                  ? 'Connecting...'
                  : connectionStatus === 'local'
                    ? 'Local Sandbox'
                    : 'Disconnected'
            }}
          </span>
          <span v-if="documentId" class="doc-id-badge">
            Room: {{ documentId.slice(0, 8) }}...
          </span>
        </div>
      </div>

      <div class="editor-view__actions">
        <Button
          v-if="connectionStatus === 'local'"
          variant="elevated"
          size="small"
          @click="createNewRemoteDocument"
        >
          Create Multiuser Room
        </Button>
      </div>
    </div>

    <div v-if="errorMessage" class="editor-view__error">
      {{ errorMessage }}
    </div>

    <Editor
      v-if="provider"
      :provider="provider"
      :scrollable="false"
      nav-position="top"
      @error="errorMessage = $event"
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

.status-badge--local {
  background-color: var(--bg-subtle);
  color: var(--text-muted);
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

.editor-view__error {
  padding: 10px 14px;
  border-radius: 8px;
  background-color: color-mix(in srgb, var(--color-alert, #ef4444) 12%, transparent);
  border: 1px solid var(--color-alert, #ef4444);
  color: var(--color-alert, #ef4444);
  font-size: 0.875rem;
}
</style>
