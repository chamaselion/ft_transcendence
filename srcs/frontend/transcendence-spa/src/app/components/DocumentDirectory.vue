<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import Button from '@/app/components/Button.vue'
import Icon from '@/app/components/Icon.vue'
import Toast from '@/app/components/Toast.vue'
import ShareModal from '@/app/components/ShareModal.vue'
import DocumentToolbar from '@/app/components/documents/DocumentToolbar.vue'
import DocumentTable from '@/app/components/documents/DocumentTable.vue'
import DocumentPagination from '@/app/components/documents/DocumentPagination.vue'
import DeleteDocumentModal from '@/app/components/documents/DeleteDocumentModal.vue'
import {
  useDocumentDirectory,
  type DocumentScope,
} from '@/app/composables/useDocumentDirectory'
import type { DocumentData } from '@/app/editor/document.api'

const router = useRouter()
const { t, locale } = useI18n()

const {
  documents,
  loading,
  errorMessage,
  searchQuery,
  searchError,
  activeQuery,
  selectedScope,
  pageSize,
  currentPage,
  totalDocuments,
  showDeleteModal,
  selectedDeleteDoc,
  isDeleting,
  showToast,
  toastMessage,
  toastType,
  fetchDocuments,
  onSearchInput,
  clearSearch,
  setScope,
  handlePageSizeChange,
  goToPage,
  openDeleteDialog,
  confirmDelete,
} = useDocumentDirectory()

const showShareModal = ref(false)
const selectedShareDoc = ref<DocumentData | null>(null)

function handleOpenDocument(docId: string) {
  router.push(`/editor/${docId}`)
}

function handleCreateNew() {
  router.push('/editor')
}

function handleSearchInput(value: string) {
  searchQuery.value = value
  onSearchInput()
}

function handleScopeChange(scope: DocumentScope) {
  setScope(scope)
}

function openShareDialog(doc: DocumentData) {
  selectedShareDoc.value = doc
  showShareModal.value = true
}
</script>

<template>
  <div class="mx-auto flex w-full max-w-[1080px] flex-col gap-4">
    <!-- Top toolbar / header -->
    <div class="flex flex-wrap items-center justify-between gap-4">
      <div class="flex items-center gap-2.5">
        <h2 class="m-0 text-[1.6rem] leading-tight font-bold text-ink">{{ $t('documents.title') }}</h2>
        <span
          class="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-subtle px-2 text-[0.8rem] font-semibold text-ink-secondary"
          >{{ $n(totalDocuments) }}</span
        >
      </div>

      <div class="flex items-center gap-2">
        <Button variant="elevated" color="primary" size="small" @click="handleCreateNew">
          <template #prepend>
            <Icon name="Plus" :size="16" />
          </template>
          {{ $t('documents.newDocument') }}
        </Button>
      </div>
    </div>

    <!-- Filters and Search Bar -->
    <DocumentToolbar
      :search-query="searchQuery"
      :search-error="searchError"
      :scope="selectedScope"
      :loading="loading"
      @search-input="handleSearchInput"
      @clear="clearSearch"
      @update:scope="handleScopeChange"
      @refresh="fetchDocuments"
    />

    <!-- Documents list with states -->
    <DocumentTable
      :documents="documents"
      :loading="loading"
      :error-message="errorMessage"
      :active-query="activeQuery"
      @retry="fetchDocuments"
      @create="handleCreateNew"
      @open="handleOpenDocument"
      @share="openShareDialog"
      @delete="openDeleteDialog"
    >
      <template #footer>
        <DocumentPagination
          :total="totalDocuments"
          :limit="pageSize"
          :offset="(currentPage - 1) * pageSize"
          :loading="loading"
          @page-change="goToPage"
          @limit-change="handlePageSizeChange"
        />
      </template>
    </DocumentTable>

    <!-- Share Modal -->
    <ShareModal
      v-if="selectedShareDoc"
      v-model="showShareModal"
      :document-id="selectedShareDoc.id"
      :is-owner="true"
    />

    <!-- Delete Confirmation Modal -->
    <DeleteDocumentModal
      v-model="showDeleteModal"
      :document="selectedDeleteDoc"
      :deleting="isDeleting"
      @confirm="confirmDelete"
    />

    <!-- Notification Toast -->
    <div class="pointer-events-auto fixed right-6 bottom-6 z-[1001]">
      <Toast v-model="showToast" :type="toastType" :message="toastMessage" :duration="4000" />
    </div>
  </div>
</template>
