<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import Editor from '@/app/components/Editor.vue'
import Button from '@/app/components/Button.vue'
import Icon from '@/app/components/Icon.vue'
import { SyncConflictError, WebSocketEditorDataProvider } from '@/app/editor/dataProvider'
import { createBlock, type EditorDataProvider, type SyncOperation } from '@/app/editor/types'
import { useAuthStore } from '@/stores/auth'
import { useEditorStore } from '@/stores/editor'
import { createDocument, getDocument, updateDocumentTitle } from '@/app/editor/document.api'
import { insertPlainText } from '@/app/editor/plainTextPaste'
import { clearDraft, loadDraft, saveDraft } from '@/app/editor/draftStorage'
import { DOCUMENT_TITLE_MAX_LENGTH } from '@/utils/validation'
import { truncateTitle } from '@/utils/title'
import { logger } from '@/utils/logger'
import ShareModal from '@/app/components/ShareModal.vue'
import Toast from '@/app/components/Toast.vue'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const store = useEditorStore()
const { t } = useI18n()

const provider = ref<EditorDataProvider | null>(null)
const documentTitle = computed({
  get: () => store.title || 'Untitled Document',
  set: (value: string) => store.setTitle(value),
})

const displayTitle = computed(() => truncateTitle(documentTitle.value))
const titleEl = ref<HTMLElement | null>(null)
const documentId = ref<string | null>(null)
const userPermission = ref<'owner' | 'editor' | 'viewer'>('viewer')
const isTitleEditable = computed(
  () => !store.isSyncing && (userPermission.value === 'owner' || userPermission.value === 'editor'),
)
const isDocumentEditable = computed(() => userPermission.value !== 'viewer')
const showShareModal = ref(false)
const showPermissionToast = ref(false)
const permissionToastMessage = ref('')
const connectionStatus = computed(() => store.connectionState)
const errorMessage = ref<string | null>(null)
const ERROR_BANNER_TIMEOUT_MS = 3000
let errorBannerTimer: ReturnType<typeof setTimeout> | null = null

function clearErrorBanner() {
  if (errorBannerTimer !== null) {
    clearTimeout(errorBannerTimer)
    errorBannerTimer = null
  }
  errorMessage.value = null
}

function showErrorBanner(message: string) {
  errorMessage.value = message
  if (errorBannerTimer !== null) {
    clearTimeout(errorBannerTimer)
  }
  errorBannerTimer = setTimeout(() => {
    errorMessage.value = null
    errorBannerTimer = null
  }, ERROR_BANNER_TIMEOUT_MS)
}

function onEditorError(message: string) {
  showErrorBanner(message)
}

const titleError = ref('')
const isLoading = ref<boolean>(true)
const editorElement = ref<typeof Editor | null>(null)

const statusClass = computed(
  () =>
    ({
      connected: 'bg-success/15 text-success',
      connecting: 'bg-warning/15 text-warning',
      syncing: 'bg-warning/15 text-warning',
      reconnecting: 'bg-warning/15 text-warning',
      offline: 'bg-danger/15 text-danger',
    })[connectionStatus.value],
)

const connectionLabel = computed(() => {
  if (store.isSyncing) return t('editor.statusSyncing')
  return {
    connected: t('editor.statusConnected'),
    connecting: t('editor.statusConnecting'),
    syncing: t('editor.statusSyncing'),
    reconnecting: t('editor.statusReconnecting'),
    offline: t('editor.statusDisconnected'),
  }[connectionStatus.value]
})

const isOnline = computed(() => store.connectionState === 'connected')
let draftTimer: ReturnType<typeof setTimeout> | null = null

function persistDraftNow() {
  const userId = authStore.userId
  if (!userId || !store.documentId) return
  const draft = store.createDraft(userId)
  if (draft) saveDraft(draft)
}

async function persistDraftSettled() {
  const userId = authStore.userId
  if (!userId || !store.documentId) return
  try {
    const localHash = await store.computeLocalContentHash()
    if (store.base && localHash === store.base.contentHash && !store.hasConflicts) {
      clearDraft(userId, store.documentId)
      return
    }
  } catch {
    // Fall through and persist the draft without the clean-state check.
  }
  persistDraftNow()
}

function scheduleDraftSave() {
  if (draftTimer) clearTimeout(draftTimer)
  draftTimer = setTimeout(() => {
    draftTimer = null
    void persistDraftSettled()
  }, 300)
}

function updateTitleElement(title: string) {
  if (titleEl.value && document.activeElement !== titleEl.value) {
    titleEl.value.innerText = truncateTitle(title)
  }
}

function openRoom(docId: string, initialTitle?: string) {
  persistDraftNow()
  store.startSession(docId, initialTitle || 'Untitled Document')
  documentId.value = docId
  clearErrorBanner()

  const userId = authStore.userId
  const draft = userId ? loadDraft(userId, docId) : null
  if (draft) {
    store.restoreDraft(draft)
    updateTitleElement(draft.title)
  }

  if (provider.value) {
    provider.value.destroy?.()
    provider.value = null
  }

  const wsProvider = new WebSocketEditorDataProvider({
    documentId: docId,
    getHashes: async () => ({
      baseHash: store.base?.contentHash,
      localHash: await store.computeLocalContentHash(),
    }),
    onConnectionState: (state) => store.setConnectionState(state),
    onFatal: (reason) => {
      persistDraftNow()
      if (reason === 'session-expired') {
        authStore.invalidate()
        void router.push('/login')
      } else {
        void router.push('/')
      }
    },
  })

  wsProvider.onPermission = (permission) => {
    userPermission.value = permission
    if (permission === 'viewer' && titleEl.value) {
      // Drop any in-progress title draft; it will not be saved anymore.
      titleEl.value.blur()
      titleEl.value.innerText = truncateTitle(documentTitle.value)
    }
  }

  wsProvider.onTitleUpdated = (e) => {
    if (e.title) store.applyRemoteTitle(e.title)
  }

  wsProvider.onError = (e) => {
    showErrorBanner(e.error)
  }

  provider.value = wsProvider
}

async function resolveTitleConflict(choice: 'local' | 'remote') {
  const conflict = store.titleConflict
  if (!conflict) return
  store.setSyncError(null)

  if (choice === 'remote') {
    store.setTitle(conflict.remote)
    store.setTitleConflict(null)
    if (store.base) store.setBase({ ...store.base, title: conflict.remote })
    updateTitleElement(conflict.remote)
    store.requestSync()
    return
  }

  if (!isOnline.value) {
    showErrorBanner(t('editor.conflict.syncUnavailable'))
    return
  }
  const wsProvider = provider.value
  if (!wsProvider?.sendSync) {
    showErrorBanner(t('editor.conflict.syncUnavailable'))
    return
  }
  const operation: SyncOperation = {
    kind: 'title',
    title: conflict.local,
    expectedTitle: conflict.remote,
  }
  store.setSyncing(true)
  try {
    const result = await wsProvider.sendSync([operation])
    store.setTitle(conflict.local)
    store.setTitleConflict(null)
    updateTitleElement(conflict.local)
    await store.recordBaseOperation(operation, null, result.contentHash, conflict.local)
    store.requestSync()
  } catch (err) {
    if (err instanceof SyncConflictError) {
      const remote = err.conflicts.find(
        (item) => item.kind === 'title' || item.remoteTitle !== undefined,
      )?.remoteTitle
      if (remote) {
        store.setTitleConflict({ local: conflict.local, remote })
      }
      showErrorBanner(t('editor.conflict.titleConflictChanged'))
      return
    }
    showErrorBanner(t('editor.conflict.syncFailed'))
  } finally {
    store.setSyncing(false)
  }
}

function onPermissionSnapshot(permission: 'owner' | 'editor' | 'viewer') {
  userPermission.value = permission
  if (permission === 'viewer' && titleEl.value) {
    titleEl.value.blur()
    titleEl.value.innerText = truncateTitle(documentTitle.value)
  }
}

function onReadonlyEnter(hadPendingEdits: boolean) {
  permissionToastMessage.value = hadPendingEdits
    ? t('editor.permissionChangedDiscarded')
    : t('editor.permissionChanged')
  showPermissionToast.value = true
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
    if (store.titleConflict) {
      store.setTitleConflict({ ...store.titleConflict, local: newTitle })
    }
    if (isOnline.value && !store.titleConflict && provider.value?.sendTitleUpdate) {
      await provider.value.sendTitleUpdate(newTitle)
    }
    if (isOnline.value && !store.titleConflict && documentId.value) {
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
  clearErrorBanner()

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
  window.addEventListener('pagehide', persistDraftNow)
  void loadEditor()
})

watch(
  () => route.params.id,
  (newId) => {
    if (newId !== documentId.value) {
      loadEditor(newId as string | undefined)
    }
  },
)

watch(
  () => store.title,
  (nextTitle) => {
    if (nextTitle) updateTitleElement(nextTitle)
  },
)

watch(
  () => store.connectionState,
  (state) => {
    if (state === 'reconnecting' || state === 'offline') store.clearLocks()
  },
)

watch(
  [
    () => store.blocks,
    () => store.title,
    () => store.activeLanguage,
    () => store.conflicts,
    () => store.titleConflict,
    () => store.base,
  ],
  scheduleDraftSave,
  { deep: true },
)

onBeforeUnmount(() => {
  if (errorBannerTimer !== null) {
    clearTimeout(errorBannerTimer)
    errorBannerTimer = null
  }
  if (draftTimer) {
    clearTimeout(draftTimer)
    draftTimer = null
  }
  persistDraftNow()
  window.removeEventListener('pagehide', persistDraftNow)
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
        <div
          v-if="store.titleConflict"
          class="mt-1 rounded-lg border-2 border-danger bg-danger/[0.12] p-2"
        >
          <div class="grid gap-2 md:grid-cols-2">
            <div class="rounded border border-danger/40 bg-surface/80 p-2">
              <span class="block text-[0.7rem] font-semibold text-ink-secondary">
                {{ $t('editor.conflict.localLabel') }}
              </span>
              <strong class="text-sm text-ink">{{ store.titleConflict.local }}</strong>
            </div>
            <div class="rounded border border-line-subtle bg-subtle/80 p-2">
              <span class="block text-[0.7rem] font-semibold text-ink-secondary">
                {{ $t('editor.conflict.remoteLabel') }}
              </span>
              <strong class="text-sm text-ink">{{ store.titleConflict.remote }}</strong>
            </div>
          </div>
          <div class="mt-2 flex flex-wrap justify-end gap-2">
            <Button
              variant="outlined"
              size="small"
              :disabled="!isTitleEditable"
              @click="resolveTitleConflict('local')"
            >
              {{ $t('editor.conflict.keepLocal') }}
            </Button>
            <Button
              variant="flat"
              size="small"
              color="danger"
              :disabled="!isTitleEditable"
              @click="resolveTitleConflict('remote')"
            >
              {{ $t('editor.conflict.useRemote') }}
            </Button>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <span
            class="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold"
            :class="statusClass"
          >
            <span class="h-2 w-2 rounded-full bg-current" />
            {{ connectionLabel }}
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
    <div
      v-if="store.hasConflicts"
      class="shrink-0 rounded-lg border border-danger bg-danger/12 px-3.5 py-2.5 text-sm text-danger"
    >
      {{
        $t('editor.conflict.pending', {
          count: store.conflictCount + (store.titleConflict ? 1 : 0),
        })
      }}
    </div>
    <div
      v-if="store.syncError"
      class="flex shrink-0 flex-wrap items-center justify-between gap-2 rounded-lg border border-warning bg-warning/12 px-3.5 py-2.5 text-sm text-warning"
    >
      <span>{{ store.syncError }}</span>
      <Button variant="outlined" size="small" :disabled="!isOnline" @click="store.requestSync()">
        {{ $t('editor.conflict.retrySync') }}
      </Button>
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
      :editable="isDocumentEditable"
      @error="onEditorError"
      @readonly-enter="onReadonlyEnter"
      @permission-snapshot="onPermissionSnapshot"
      ref="editorElement"
    />

    <div class="pointer-events-auto fixed right-6 bottom-6 z-[1001]">
      <Toast
        v-model="showPermissionToast"
        type="info"
        :message="permissionToastMessage"
        :duration="5000"
      />
    </div>

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
