<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
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

const {
  documents,
  loading,
  errorMessage,
  searchQuery,
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
  <div class="directory">
    <!-- Top toolbar / header -->
    <div class="directory__header">
      <div class="directory__title-group">
        <h2 class="directory__title">Documents</h2>
        <span class="directory__count">{{ totalDocuments }}</span>
      </div>

      <div class="directory__header-actions">
        <Button variant="elevated" color="primary" size="small" @click="handleCreateNew">
          <template #prepend>
            <Icon name="Plus" :size="16" />
          </template>
          New Document
        </Button>
      </div>
    </div>

    <!-- Filters and Search Bar -->
    <DocumentToolbar
      :search-query="searchQuery"
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
    <div class="directory__toast-anchor">
      <Toast v-model="showToast" :type="toastType" :message="toastMessage" :duration="4000" />
    </div>
  </div>
</template>

<style scoped>
.directory {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
  max-width: 1080px;
  margin: 0 auto;
}

/* Header */
.directory__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.directory__title-group {
  display: flex;
  align-items: center;
  gap: 10px;
}

.directory__title {
  margin: 0;
  font-size: 1.6rem;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1.2;
}

.directory__count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  height: 24px;
  padding: 0 8px;
  border-radius: 9999px;
  background-color: var(--bg-subtle);
  color: var(--text-secondary);
  font-size: 0.8rem;
  font-weight: 600;
}

.directory__header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* Fixed Toast positioning */
.directory__toast-anchor {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 1001;
  pointer-events: auto;
}
</style>
