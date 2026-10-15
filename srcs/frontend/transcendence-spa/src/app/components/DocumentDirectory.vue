<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import Button from '@/app/components/Button.vue'
import Icon from '@/app/components/Icon.vue'
import Modal from '@/app/components/Modal.vue'
import Toast from '@/app/components/Toast.vue'
import ShareModal from '@/app/components/ShareModal.vue'
import { listDocuments, deleteDocument, type DocumentData } from '@/app/editor/document.api'

const router = useRouter()
const { t, locale } = useI18n()

// Document list & pagination state
const documents = ref<DocumentData[]>([])
const loading = ref(false)
const errorMessage = ref<string | null>(null)
const searchQuery = ref('')
const selectedScope = ref<'all' | 'own' | 'shared'>('all')

const pageSize = ref<number>(10)
const currentPage = ref<number>(1)
const totalDocuments = ref<number>(0)
const totalPages = computed(() => Math.max(1, Math.ceil(totalDocuments.value / pageSize.value)))

// Range of documents currently shown
const fromItem = computed(() =>
  totalDocuments.value === 0 ? 0 : (currentPage.value - 1) * pageSize.value + 1,
)
const toItem = computed(() => Math.min(currentPage.value * pageSize.value, totalDocuments.value))

const showShareModal = ref(false)
const selectedShareDoc = ref<DocumentData | null>(null)

// Delete modal state
const showDeleteModal = ref(false)
const selectedDeleteDoc = ref<DocumentData | null>(null)
const isDeleting = ref(false)

// Toast feedback state
const showToast = ref(false)
const toastMessage = ref('')
const toastType = ref<'good' | 'alert' | 'info' | 'warn'>('good')

// Debounced search timer
let debounceTimer: ReturnType<typeof setTimeout> | undefined

async function fetchDocuments() {
  loading.value = true
  errorMessage.value = null
  try {
    const offset = (currentPage.value - 1) * pageSize.value
    const res = await listDocuments({
      scope: selectedScope.value,
      sort: 'updatedAt',
      order: 'DESC',
      limit: pageSize.value,
      offset,
      q: searchQuery.value.trim() || undefined,
    })
    documents.value = res.documents
    totalDocuments.value = res.pagination?.total ?? res.documents.length
  } catch (err) {
    console.error('Failed to load documents:', err)
    errorMessage.value = err instanceof Error ? err.message : t('documents.fetchFailed')
  } finally {
    loading.value = false
  }
}

function onSearchInput() {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    currentPage.value = 1
    fetchDocuments()
  }, 300)
}

function clearSearch() {
  searchQuery.value = ''
  currentPage.value = 1
  fetchDocuments()
}

function setScope(scope: 'all' | 'own' | 'shared') {
  if (selectedScope.value === scope) return
  selectedScope.value = scope
  currentPage.value = 1
  fetchDocuments()
}

function handlePageSizeChange(newSize: number) {
  if (pageSize.value === newSize) return
  pageSize.value = newSize
  currentPage.value = 1
  fetchDocuments()
}

function goToPage(page: number) {
  if (page < 1 || page > totalPages.value || page === currentPage.value) return
  currentPage.value = page
  fetchDocuments()
}

const visiblePages = computed(() => {
  const current = currentPage.value
  const total = totalPages.value
  const pages: (number | string)[] = []

  if (total <= 7) {
    for (let i = 1; i <= total; i++) pages.push(i)
    return pages
  }

  pages.push(1)

  if (current > 3) {
    pages.push('...')
  }

  const start = Math.max(2, current - 1)
  const end = Math.min(total - 1, current + 1)

  for (let i = start; i <= end; i++) {
    pages.push(i)
  }

  if (current < total - 2) {
    pages.push('...')
  }

  pages.push(total)
  return pages
})

function handleOpenDocument(docId: string) {
  router.push(`/editor/${docId}`)
}

function handleCreateNew() {
  router.push('/editor')
}

function openShareDialog(doc: DocumentData) {
  selectedShareDoc.value = doc
  showShareModal.value = true
}

function openDeleteDialog(doc: DocumentData) {
  selectedDeleteDoc.value = doc
  showDeleteModal.value = true
}

async function confirmDelete() {
  if (!selectedDeleteDoc.value) return
  const docId = selectedDeleteDoc.value.id
  const docTitle = selectedDeleteDoc.value.title || t('common.untitledDocument')

  isDeleting.value = true
  try {
    await deleteDocument(docId)
    showDeleteModal.value = false
    selectedDeleteDoc.value = null

    toastType.value = 'good'
    toastMessage.value = t('documents.deletedToast', { title: docTitle })
    showToast.value = true

    // If deleting last document on page > 1, step back one page
    if (documents.value.length === 1 && currentPage.value > 1) {
      currentPage.value--
    }
    await fetchDocuments()
  } catch (err) {
    console.error('Failed to delete document:', err)
    toastType.value = 'alert'
    toastMessage.value = err instanceof Error ? err.message : t('documents.deleteFailed')
    showToast.value = true
  } finally {
    isDeleting.value = false
  }
}

function formatRelativeTime(dateString: string): string {
  if (!dateString) return t('documents.timeUnknown')
  const date = new Date(dateString)
  if (isNaN(date.getTime())) return dateString

  const now = new Date()
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (diffSec < 45) return t('documents.timeJustNow')

  const relative = new Intl.RelativeTimeFormat(locale.value, { numeric: 'auto' })

  if (diffSec < 3600) {
    return relative.format(-Math.round(diffSec / 60), 'minute')
  }
  if (diffSec < 86400) {
    return relative.format(-Math.round(diffSec / 3600), 'hour')
  }
  if (diffSec < 604800) {
    return relative.format(-Math.round(diffSec / 86400), 'day')
  }

  return date.toLocaleDateString(locale.value, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function formatFullDate(dateString: string): string {
  if (!dateString) return ''
  const date = new Date(dateString)
  if (isNaN(date.getTime())) return dateString
  return date.toLocaleString(locale.value, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

onMounted(() => {
  fetchDocuments()
})

onBeforeUnmount(() => {
  clearTimeout(debounceTimer)
})
</script>

<template>
  <div class="directory">
    <!-- Top toolbar / header -->
    <div class="directory__header">
      <div class="directory__title-group">
        <h2 class="directory__title">{{ $t('documents.title') }}</h2>
        <span class="directory__count">{{ $n(totalDocuments) }}</span>
      </div>

      <div class="directory__header-actions">
        <Button variant="elevated" color="primary" size="small" @click="handleCreateNew">
          <template #prepend>
            <Icon name="Plus" :size="16" />
          </template>
          {{ $t('documents.newDocument') }}
        </Button>
      </div>
    </div>

    <!-- Filters and Search Bar -->
    <div class="directory__toolbar">
      <div class="directory__search-wrapper">
        <Icon name="Search" :size="16" class="directory__search-icon" />
        <input
          v-model="searchQuery"
          type="text"
          class="directory__search-input"
          :placeholder="$t('documents.searchPlaceholder')"
          @input="onSearchInput"
        />
        <button
          v-if="searchQuery"
          type="button"
          class="directory__search-clear"
          :title="$t('documents.clearSearch')"
          @click="clearSearch"
        >
          ×
        </button>
      </div>

      <div class="directory__filters">
        <button
          type="button"
          class="directory__filter-tab"
          :class="{ 'directory__filter-tab--active': selectedScope === 'all' }"
          @click="setScope('all')"
        >
          {{ $t('documents.filterAll') }}
        </button>
        <button
          type="button"
          class="directory__filter-tab"
          :class="{ 'directory__filter-tab--active': selectedScope === 'own' }"
          @click="setScope('own')"
        >
          {{ $t('documents.filterOwned') }}
        </button>
        <button
          type="button"
          class="directory__filter-tab"
          :class="{ 'directory__filter-tab--active': selectedScope === 'shared' }"
          @click="setScope('shared')"
        >
          {{ $t('documents.filterShared') }}
        </button>

        <button
          type="button"
          class="directory__refresh-btn"
          :title="$t('documents.refresh')"
          :disabled="loading"
          @click="fetchDocuments"
        >
          <Icon name="Refresh" :size="16" :class="{ 'directory__refresh-spinner': loading }" />
        </button>
      </div>
    </div>

    <!-- Error message banner -->
    <div v-if="errorMessage" class="directory__error">
      <span>{{ errorMessage }}</span>
      <Button variant="outlined" size="x-small" @click="fetchDocuments">{{ $t('documents.retry') }}</Button>
    </div>

    <!-- Loading skeleton / state -->
    <div v-if="loading && documents.length === 0" class="directory__loading">
      <div class="directory__loader-spinner" />
      <span>{{ $t('documents.loading') }}</span>
    </div>

    <!-- Empty states -->
    <div v-else-if="!loading && documents.length === 0" class="directory__empty">
      <div class="directory__empty-icon">
        <Icon name="FileText" :size="48" />
      </div>
      <h3 class="directory__empty-title">
        {{ searchQuery ? $t('documents.emptyNoMatchTitle') : $t('documents.emptyTitle') }}
      </h3>
      <p class="directory__empty-desc">
        {{
          searchQuery
            ? $t('documents.emptyNoMatchDesc')
            : $t('documents.emptyDesc')
        }}
      </p>
      <Button
        v-if="!searchQuery"
        variant="elevated"
        color="primary"
        size="small"
        @click="handleCreateNew"
      >
        <template #prepend>
          <Icon name="Plus" :size="16" />
        </template>
        {{ $t('documents.createDocument') }}
      </Button>
    </div>

    <!-- Documents List Table and Pagination Container -->
    <div v-else class="directory__table-wrapper">
      <table class="directory__table">
        <thead>
          <tr>
            <th class="directory__th directory__th--name">{{ $t('documents.columnName') }}</th>
            <th class="directory__th directory__th--status">{{ $t('documents.columnOwnership') }}</th>
            <th class="directory__th directory__th--changed">{{ $t('documents.columnChanged') }}</th>
            <th class="directory__th directory__th--actions">{{ $t('documents.columnActions') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="doc in documents"
            :key="doc.id"
            class="directory__row"
            @click="handleOpenDocument(doc.id)"
          >
            <!-- Document Name -->
            <td class="directory__td directory__td--name">
              <div class="directory__doc-info">
                <div class="directory__doc-icon">
                  <Icon name="FileText" :size="20" />
                </div>
                <div class="directory__doc-text">
                  <span class="directory__doc-title" :title="doc.title || $t('common.untitledDocument')">
                    {{ doc.title || $t('common.untitledDocument') }}
                  </span>
                  <span class="directory__doc-id">ID: {{ doc.id.slice(0, 8) }}...</span>
                </div>
              </div>
            </td>

            <!-- Owned / Shared -->
            <td class="directory__td directory__td--status">
              <div class="directory__ownership">
                <span
                  v-if="doc.permission === 'owner'"
                  class="directory__badge directory__badge--owned"
                >
                  {{ $t('documents.badgeOwned') }}
                </span>
                <span
                  v-else
                  class="directory__badge directory__badge--shared"
                  :title="doc.owner ? $t('documents.sharedBy', { login: doc.owner.login }) : $t('documents.sharedDocument')"
                >
                  {{ $t('documents.badgeShared') }}
                </span>

                <span
                  v-if="doc.permission !== 'owner' && doc.owner"
                  class="directory__owner-note"
                  :title="$t('documents.createdBy', { login: doc.owner.login })"
                >
                  {{ $t('documents.by', { login: doc.owner.login }) }}
                </span>
              </div>
            </td>

            <!-- Last Changed -->
            <td class="directory__td directory__td--changed">
              <span class="directory__time" :title="formatFullDate(doc.updatedAt)">
                {{ formatRelativeTime(doc.updatedAt) }}
              </span>
            </td>

            <!-- Actions: if owner, icon buttons to share or delete -->
            <td class="directory__td directory__td--actions" @click.stop>
              <div v-if="doc.permission === 'owner'" class="directory__action-buttons">
                <Button
                  variant="outlined"
                  size="small"
                  square
                  :title="$t('documents.shareDocument')"
                  :aria-label="$t('documents.shareDocument')"
                  @click.stop="openShareDialog(doc)"
                >
                  <template #icon>
                    <Icon name="Share" :size="16" />
                  </template>
                </Button>
                <Button
                  variant="outlined"
                  color="alert"
                  size="small"
                  square
                  :title="$t('documents.deleteDocument')"
                  :aria-label="$t('documents.deleteDocument')"
                  @click.stop="openDeleteDialog(doc)"
                >
                  <template #icon>
                    <Icon name="Trash" :size="16" />
                  </template>
                </Button>
              </div>
              <div v-else class="directory__non-owner-placeholder">
                <span class="directory__role-pill" :title="$t('documents.roleTitle', { role: doc.permission })">
                  {{ doc.permission }}
                </span>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Pagination and Page Size Footer Bar -->
      <div class="directory__pagination">
        <!-- Range Information -->
        <i18n-t
          keypath="documents.paginationShowing"
          tag="div"
          scope="global"
          class="directory__pagination-info"
        >
          <template #from>
            <strong class="directory__pagination-strong">{{ fromItem }}</strong>
          </template>
          <template #to>
            <strong class="directory__pagination-strong">{{ toItem }}</strong>
          </template>
          <template #total>
            <strong class="directory__pagination-strong">{{ totalDocuments }}</strong>
          </template>
        </i18n-t>

        <!-- Page Navigation Buttons -->
        <div class="directory__pagination-nav">
          <button
            type="button"
            class="directory__page-btn directory__page-btn--arrow"
            :title="$t('documents.firstPage')"
            :aria-label="$t('documents.firstPage')"
            :disabled="currentPage === 1 || loading"
            @click="goToPage(1)"
          >
            <Icon name="ChevronsLeft" :size="16" />
          </button>
          <button
            type="button"
            class="directory__page-btn directory__page-btn--arrow"
            :title="$t('documents.previousPage')"
            :aria-label="$t('documents.previousPage')"
            :disabled="currentPage === 1 || loading"
            @click="goToPage(currentPage - 1)"
          >
            <Icon name="ChevronLeft" :size="16" />
          </button>

          <!-- Page numbers -->
          <div class="directory__page-numbers">
            <template v-for="(p, idx) in visiblePages" :key="idx">
              <span v-if="p === '...'" class="directory__page-ellipsis">…</span>
              <button
                v-else
                type="button"
                class="directory__page-btn directory__page-btn--number"
                :class="{ 'directory__page-btn--active': p === currentPage }"
                :aria-current="p === currentPage ? 'page' : undefined"
                :disabled="loading"
                @click="goToPage(Number(p))"
              >
                {{ p }}
              </button>
            </template>
          </div>

          <button
            type="button"
            class="directory__page-btn directory__page-btn--arrow"
            :title="$t('documents.nextPage')"
            :aria-label="$t('documents.nextPage')"
            :disabled="currentPage >= totalPages || loading"
            @click="goToPage(currentPage + 1)"
          >
            <Icon name="ChevronRight" :size="16" />
          </button>
          <button
            type="button"
            class="directory__page-btn directory__page-btn--arrow"
            :title="$t('documents.lastPage')"
            :aria-label="$t('documents.lastPage')"
            :disabled="currentPage >= totalPages || loading"
            @click="goToPage(totalPages)"
          >
            <Icon name="ChevronsRight" :size="16" />
          </button>
        </div>

        <!-- Rows per page selector: 5, 10, 20 (default 10) -->
        <div class="directory__page-size">
          <label for="page-size-select" class="directory__page-size-label">{{ $t('documents.rows') }}</label>
          <select
            id="page-size-select"
            :value="pageSize"
            class="directory__page-size-select"
            :disabled="loading"
            @change="handlePageSizeChange(Number(($event.target as HTMLSelectElement).value))"
          >
            <option :value="5">5</option>
            <option :value="10">10</option>
            <option :value="20">20</option>
          </select>
        </div>
      </div>
    </div>

    <!-- Share Modal -->
    <ShareModal
      v-if="selectedShareDoc"
      v-model="showShareModal"
      :document-id="selectedShareDoc.id"
      :is-owner="true"
    />

    <!-- Delete Confirmation Modal -->
    <Modal v-model="showDeleteModal" :title="$t('documents.deleteTitle')" size="small">
      <div class="directory__delete-modal-content">
        <i18n-t keypath="documents.deleteConfirm" tag="p" scope="global">
          <template #title>
            <strong>"{{ selectedDeleteDoc?.title || $t('common.untitledDocument') }}"</strong>
          </template>
        </i18n-t>
        <p class="directory__delete-warning">
          {{ $t('documents.deleteWarning') }}
        </p>
      </div>
      <template #footer>
        <Button
          variant="outlined"
          size="small"
          :disabled="isDeleting"
          @click="showDeleteModal = false"
        >
          {{ $t('common.cancel') }}
        </Button>
        <Button color="alert" size="small" :loading="isDeleting" @click="confirmDelete">
          {{ $t('documents.deleteSubmit') }}
        </Button>
      </template>
    </Modal>

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

/* Toolbar */
.directory__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.directory__search-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  flex: 1;
  min-width: 260px;
}

.directory__search-icon {
  position: absolute;
  left: 12px;
  color: var(--text-muted);
  pointer-events: none;
}

.directory__search-input {
  width: 100%;
  padding: 8px 34px 8px 36px;
  border: 1px solid var(--border-default);
  border-radius: 8px;
  background-color: var(--bg-surface);
  color: var(--text-primary);
  font-size: 0.9rem;
  transition:
    border-color 0.2s,
    box-shadow 0.2s;
}

.directory__search-input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 20%, transparent);
}

.directory__search-clear {
  position: absolute;
  right: 8px;
  width: 22px;
  height: 22px;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--text-muted);
  font-size: 18px;
  line-height: 1;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.directory__search-clear:hover {
  background-color: var(--bg-subtle);
  color: var(--text-primary);
}

.directory__filters {
  display: flex;
  align-items: center;
  gap: 4px;
  background-color: var(--bg-subtle);
  padding: 4px;
  border-radius: 8px;
}

.directory__filter-tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  margin: 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  transition:
    background-color 0.15s,
    color 0.15s;
}

.directory__filter-tab:hover {
  color: var(--text-primary);
  background-color: color-mix(in srgb, var(--text-primary) 6%, transparent);
}

.directory__filter-tab--active {
  background-color: var(--bg-surface);
  color: var(--text-primary);
  box-shadow: var(--shadow-sm);
  font-weight: 600;
}

.directory__refresh-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  margin: 0 0 0 4px;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition:
    background-color 0.15s,
    color 0.15s;
}

.directory__refresh-btn:hover:not(:disabled) {
  background-color: var(--bg-surface);
  color: var(--text-primary);
}

.directory__refresh-spinner {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

/* Error State */
.directory__error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-radius: 8px;
  background-color: color-mix(in srgb, var(--color-alert) 12%, transparent);
  border: 1px solid var(--color-alert);
  color: var(--color-alert);
  font-size: 0.9rem;
}

/* Loading State */
.directory__loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 64px 16px;
  color: var(--text-muted);
  font-size: 0.95rem;
}

.directory__loader-spinner {
  width: 28px;
  height: 28px;
  border: 3px solid var(--border-default);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

/* Empty State */
.directory__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 64px 24px;
  border: 1px dashed var(--border-default);
  border-radius: 12px;
  background-color: color-mix(in srgb, var(--bg-surface) 60%, transparent);
}

.directory__empty-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background-color: var(--bg-subtle);
  color: var(--text-muted);
  margin-bottom: 16px;
}

.directory__empty-title {
  margin: 0 0 8px;
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text-primary);
}

.directory__empty-desc {
  margin: 0 0 20px;
  font-size: 0.9rem;
  color: var(--text-secondary);
  max-width: 420px;
}

/* Table Wrapper */
.directory__table-wrapper {
  background-color: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: 10px;
  overflow: hidden;
  box-shadow: var(--shadow-sm);
}

.directory__table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
}

.directory__th {
  padding: 12px 16px;
  background-color: var(--bg-subtle);
  color: var(--text-secondary);
  font-size: 0.8rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-bottom: 1px solid var(--border-subtle);
}

.directory__th--name {
  width: 46%;
}

.directory__th--status {
  width: 18%;
}

.directory__th--changed {
  width: 20%;
}

.directory__th--actions {
  width: 16%;
  text-align: right;
}

.directory__row {
  cursor: pointer;
  transition: background-color 0.15s ease;
  border-bottom: 1px solid var(--border-subtle);
}

.directory__row:last-child {
  border-bottom: none;
}

.directory__row:hover {
  background-color: color-mix(in srgb, var(--text-primary) 4%, var(--bg-surface));
}

.directory__td {
  padding: 14px 16px;
  vertical-align: middle;
}

.directory__td--name {
  min-width: 0;
}

.directory__doc-info {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.directory__doc-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background-color: color-mix(in srgb, var(--color-primary) 12%, transparent);
  color: var(--color-primary);
  flex-shrink: 0;
}

.directory__doc-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  overflow: hidden;
}

.directory__doc-title {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.directory__row:hover .directory__doc-title {
  color: var(--color-primary);
}

.directory__doc-id {
  font-size: 0.75rem;
  color: var(--text-muted);
  font-family: monospace;
}

/* Ownership badges */
.directory__ownership {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
}

.directory__badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: capitalize;
}

.directory__badge--owned {
  background-color: color-mix(in srgb, var(--color-good) 15%, transparent);
  color: var(--color-good);
}

.directory__badge--shared {
  background-color: color-mix(in srgb, var(--color-warn) 15%, transparent);
  color: var(--color-warn);
}

.directory__owner-note {
  font-size: 0.75rem;
  color: var(--text-muted);
}

/* Changed column */
.directory__time {
  font-size: 0.875rem;
  color: var(--text-secondary);
}

/* Actions column */
.directory__td--actions {
  text-align: right;
}

.directory__action-buttons {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
}

.directory__action-buttons :deep(.btn) {
  margin: 0;
}

.directory__non-owner-placeholder {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
}

.directory__role-pill {
  font-size: 0.75rem;
  padding: 2px 6px;
  border-radius: 4px;
  background-color: var(--bg-subtle);
  color: var(--text-muted);
  text-transform: capitalize;
}

/* Pagination Bar */
.directory__pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 16px;
  border-top: 1px solid var(--border-subtle);
  background-color: var(--bg-subtle);
  flex-wrap: wrap;
}

.directory__pagination-info {
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.directory__pagination-strong {
  color: var(--text-primary);
  font-weight: 600;
}

.directory__pagination-nav {
  display: flex;
  align-items: center;
  gap: 4px;
}

.directory__page-numbers {
  display: flex;
  align-items: center;
  gap: 2px;
}

.directory__page-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 30px;
  height: 30px;
  padding: 0 6px;
  margin: 0;
  border: 1px solid transparent;
  border-radius: 6px;
  background-color: transparent;
  color: var(--text-secondary);
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  transition:
    background-color 0.15s,
    color 0.15s,
    border-color 0.15s;
}

.directory__page-btn:hover:not(:disabled) {
  background-color: var(--bg-surface);
  color: var(--text-primary);
  border-color: var(--border-subtle);
}

.directory__page-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.directory__page-btn--active {
  background-color: var(--color-primary);
  color: var(--color-primary-contrast);
  font-weight: 600;
  border-color: var(--color-primary);
}

.directory__page-btn--active:hover:not(:disabled) {
  background-color: var(--color-primary-hover);
  color: var(--color-primary-contrast);
}

.directory__page-btn--arrow {
  padding: 0 4px;
}

.directory__page-ellipsis {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 30px;
  color: var(--text-muted);
  font-size: 0.85rem;
}

/* Page size selector */
.directory__page-size {
  display: flex;
  align-items: center;
  gap: 8px;
}

.directory__page-size-label {
  font-size: 0.85rem;
  color: var(--text-secondary);
  white-space: nowrap;
}

.directory__page-size-select {
  padding: 4px 8px;
  border: 1px solid var(--border-default);
  border-radius: 6px;
  background-color: var(--bg-surface);
  color: var(--text-primary);
  font-size: 0.85rem;
  cursor: pointer;
  outline: none;
  transition: border-color 0.15s;
}

.directory__page-size-select:focus {
  border-color: var(--color-primary);
}

/* Delete Modal Content */
.directory__delete-modal-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
  font-size: 0.95rem;
  color: var(--text-primary);
}

.directory__delete-warning {
  margin: 0;
  font-size: 0.85rem;
  color: var(--text-secondary);
}

/* Fixed Toast positioning */
.directory__toast-anchor {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 1001;
  pointer-events: auto;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .directory__th--changed,
  .directory__td--changed {
    display: none;
  }

  .directory__th--name {
    width: 55%;
  }

  .directory__th--status {
    width: 25%;
  }

  .directory__th--actions {
    width: 20%;
  }

  .directory__pagination {
    flex-direction: column;
    align-items: center;
    gap: 10px;
  }
}
</style>
