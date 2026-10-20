<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import Button from '@/app/components/Button.vue'
import Icon from '@/app/components/Icon.vue'
import Modal from '@/app/components/Modal.vue'
import Toast from '@/app/components/Toast.vue'
import ShareModal from '@/app/components/ShareModal.vue'
import { listDocuments, deleteDocument, type DocumentData } from '@/app/editor/document.api'

const router = useRouter()

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
    errorMessage.value = err instanceof Error ? err.message : 'Failed to fetch documents'
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
  const docTitle = selectedDeleteDoc.value.title || 'Untitled Document'

  isDeleting.value = true
  try {
    await deleteDocument(docId)
    showDeleteModal.value = false
    selectedDeleteDoc.value = null

    toastType.value = 'good'
    toastMessage.value = `"${docTitle}" has been deleted.`
    showToast.value = true

    // If deleting last document on page > 1, step back one page
    if (documents.value.length === 1 && currentPage.value > 1) {
      currentPage.value--
    }
    await fetchDocuments()
  } catch (err) {
    console.error('Failed to delete document:', err)
    toastType.value = 'alert'
    toastMessage.value = err instanceof Error ? err.message : 'Failed to delete document.'
    showToast.value = true
  } finally {
    isDeleting.value = false
  }
}

function formatRelativeTime(dateString: string): string {
  if (!dateString) return 'Unknown'
  const date = new Date(dateString)
  if (isNaN(date.getTime())) return dateString

  const now = new Date()
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (diffSec < 45) return 'Just now'
  if (diffSec < 90) return '1 minute ago'
  if (diffSec < 3600) {
    const mins = Math.floor(diffSec / 60)
    return `${mins} minutes ago`
  }
  if (diffSec < 7200) return '1 hour ago'
  if (diffSec < 86400) {
    const hours = Math.floor(diffSec / 3600)
    return `${hours} hours ago`
  }
  if (diffSec < 172800) return 'Yesterday'
  if (diffSec < 604800) {
    const days = Math.floor(diffSec / 86400)
    return `${days} days ago`
  }

  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function formatFullDate(dateString: string): string {
  if (!dateString) return ''
  const date = new Date(dateString)
  if (isNaN(date.getTime())) return dateString
  return date.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

const pageButtonClass = (active: boolean) =>
  active
    ? 'border-brand bg-brand font-semibold text-brand-contrast hover:enabled:bg-brand-hover hover:enabled:text-brand-contrast'
    : 'border-transparent bg-transparent font-medium text-ink-secondary hover:enabled:border-line-subtle hover:enabled:bg-surface hover:enabled:text-ink'

onMounted(() => {
  fetchDocuments()
})

onBeforeUnmount(() => {
  clearTimeout(debounceTimer)
})
</script>

<template>
  <div class="mx-auto flex w-full max-w-[1080px] flex-col gap-4">
    <!-- Top toolbar / header -->
    <div class="flex flex-wrap items-center justify-between gap-4">
      <div class="flex items-center gap-2.5">
        <h2 class="m-0 text-[1.6rem] leading-tight font-bold text-ink">Documents</h2>
        <span
          class="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-subtle px-2 text-[0.8rem] font-semibold text-ink-secondary"
          >{{ totalDocuments }}</span
        >
      </div>

      <div class="flex items-center gap-2">
        <Button variant="elevated" color="primary" size="small" @click="handleCreateNew">
          <template #prepend>
            <Icon name="Plus" :size="16" />
          </template>
          New Document
        </Button>
      </div>
    </div>

    <!-- Filters and Search Bar -->
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="relative flex min-w-[260px] flex-1 items-center">
        <Icon name="Search" :size="16" class="pointer-events-none absolute left-3 text-muted" />
        <input
          v-model="searchQuery"
          type="text"
          class="w-full rounded-lg border border-line bg-surface py-2 pr-[34px] pl-9 text-[0.9rem] text-ink transition-[border-color,box-shadow] outline-none placeholder:text-muted focus:border-brand focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-primary)_20%,transparent)]"
          placeholder="Search documents by title..."
          @input="onSearchInput"
        />
        <button
          v-if="searchQuery"
          type="button"
          class="absolute right-2 flex h-[22px] w-[22px] cursor-pointer items-center justify-center rounded-full border-none bg-transparent p-0 text-lg leading-none text-muted hover:bg-subtle hover:text-ink"
          title="Clear search"
          @click="clearSearch"
        >
          ×
        </button>
      </div>

      <div class="flex items-center gap-1 rounded-lg bg-subtle p-1">
        <button
          type="button"
          class="inline-flex cursor-pointer items-center gap-1.5 rounded-md border-none px-3 py-1.5 text-[0.85rem] transition-[background-color,color] duration-150"
          :class="
            selectedScope === 'all'
              ? 'bg-surface font-semibold text-ink shadow-[var(--shadow-sm)]'
              : 'bg-transparent font-medium text-ink-secondary hover:bg-[color-mix(in_srgb,var(--text-primary)_6%,transparent)] hover:text-ink'
          "
          @click="setScope('all')"
        >
          All
        </button>
        <button
          type="button"
          class="inline-flex cursor-pointer items-center gap-1.5 rounded-md border-none px-3 py-1.5 text-[0.85rem] transition-[background-color,color] duration-150"
          :class="
            selectedScope === 'own'
              ? 'bg-surface font-semibold text-ink shadow-[var(--shadow-sm)]'
              : 'bg-transparent font-medium text-ink-secondary hover:bg-[color-mix(in_srgb,var(--text-primary)_6%,transparent)] hover:text-ink'
          "
          @click="setScope('own')"
        >
          Owned
        </button>
        <button
          type="button"
          class="inline-flex cursor-pointer items-center gap-1.5 rounded-md border-none px-3 py-1.5 text-[0.85rem] transition-[background-color,color] duration-150"
          :class="
            selectedScope === 'shared'
              ? 'bg-surface font-semibold text-ink shadow-[var(--shadow-sm)]'
              : 'bg-transparent font-medium text-ink-secondary hover:bg-[color-mix(in_srgb,var(--text-primary)_6%,transparent)] hover:text-ink'
          "
          @click="setScope('shared')"
        >
          Shared
        </button>

        <button
          type="button"
          class="ml-1 inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border-none bg-transparent p-0 text-ink-secondary transition-[background-color,color] duration-150 hover:bg-surface hover:text-ink"
          title="Refresh documents"
          :disabled="loading"
          @click="fetchDocuments"
        >
          <Icon name="Refresh" :size="16" :class="{ 'animate-spin': loading }" />
        </button>
      </div>
    </div>

    <!-- Error message banner -->
    <div
      v-if="errorMessage"
      class="flex items-center justify-between rounded-lg border border-danger bg-danger/12 px-4 py-3 text-[0.9rem] text-danger"
    >
      <span>{{ errorMessage }}</span>
      <Button variant="outlined" size="x-small" @click="fetchDocuments">Retry</Button>
    </div>

    <!-- Loading skeleton / state -->
    <div
      v-if="loading && documents.length === 0"
      class="flex flex-col items-center justify-center gap-3 px-4 py-16 text-[0.95rem] text-muted"
    >
      <div class="h-7 w-7 animate-spin rounded-full border-[3px] border-line border-t-brand" />
      <span>Loading available documents...</span>
    </div>

    <!-- Empty states -->
    <div
      v-else-if="!loading && documents.length === 0"
      class="flex flex-col items-center justify-center rounded-xl border border-dashed border-line bg-surface/60 px-6 py-16 text-center"
    >
      <div
        class="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-subtle text-muted"
      >
        <Icon name="FileText" :size="48" />
      </div>
      <h3 class="m-0 mb-2 text-xl font-semibold text-ink">
        {{ searchQuery ? 'No matching documents' : 'No documents yet' }}
      </h3>
      <p class="m-0 mb-5 max-w-[420px] text-[0.9rem] text-ink-secondary">
        {{
          searchQuery
            ? 'Try adjusting your search terms or filter scope.'
            : 'Get started by creating your first document to edit and collaborate in real-time.'
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
        Create Document
      </Button>
    </div>

    <!-- Documents List Table and Pagination Container -->
    <div
      v-else
      class="overflow-hidden rounded-[10px] border border-line-subtle bg-surface shadow-[var(--shadow-sm)]"
    >
      <table class="w-full border-collapse text-left">
        <thead>
          <tr>
            <th
              class="w-[46%] border-b border-line-subtle bg-subtle px-4 py-3 text-[0.8rem] font-semibold tracking-[0.05em] text-ink-secondary uppercase max-md:w-[55%]"
            >
              Document Name
            </th>
            <th
              class="w-[18%] border-b border-line-subtle bg-subtle px-4 py-3 text-[0.8rem] font-semibold tracking-[0.05em] text-ink-secondary uppercase max-md:w-[25%]"
            >
              Ownership
            </th>
            <th
              class="w-[20%] border-b border-line-subtle bg-subtle px-4 py-3 text-[0.8rem] font-semibold tracking-[0.05em] text-ink-secondary uppercase max-md:hidden"
            >
              Last Changed
            </th>
            <th
              class="w-[16%] border-b border-line-subtle bg-subtle px-4 py-3 text-right text-[0.8rem] font-semibold tracking-[0.05em] text-ink-secondary uppercase max-md:w-[20%]"
            >
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="doc in documents"
            :key="doc.id"
            class="group cursor-pointer border-b border-line-subtle transition-colors duration-150 last:border-0 hover:bg-[color-mix(in_srgb,var(--text-primary)_4%,var(--bg-surface))]"
            @click="handleOpenDocument(doc.id)"
          >
            <!-- Document Name -->
            <td class="min-w-0 px-4 py-3.5 align-middle">
              <div class="flex min-w-0 items-center gap-3">
                <div
                  class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand/12 text-brand"
                >
                  <Icon name="FileText" :size="20" />
                </div>
                <div class="flex min-w-0 flex-col gap-0.5 overflow-hidden">
                  <span
                    class="truncate text-[0.95rem] font-semibold text-ink group-hover:text-brand"
                    :title="doc.title || 'Untitled Document'"
                  >
                    {{ doc.title || 'Untitled Document' }}
                  </span>
                  <span class="font-mono text-xs text-muted">ID: {{ doc.id.slice(0, 8) }}...</span>
                </div>
              </div>
            </td>

            <!-- Owned / Shared -->
            <td class="px-4 py-3.5 align-middle">
              <div class="flex flex-col items-start gap-0.5">
                <span
                  v-if="doc.permission === 'owner'"
                  class="inline-flex items-center rounded-full bg-success/15 px-2 py-0.5 text-xs font-semibold text-success capitalize"
                >
                  Owned
                </span>
                <span
                  v-else
                  class="inline-flex items-center rounded-full bg-warning/15 px-2 py-0.5 text-xs font-semibold text-warning capitalize"
                  :title="doc.owner ? `Shared by ${doc.owner.login}` : 'Shared document'"
                >
                  Shared
                </span>

                <span
                  v-if="doc.permission !== 'owner' && doc.owner"
                  class="text-xs text-muted"
                  :title="`Document created by ${doc.owner.login}`"
                >
                  by {{ doc.owner.login }}
                </span>
              </div>
            </td>

            <!-- Last Changed -->
            <td class="px-4 py-3.5 align-middle max-md:hidden">
              <span class="text-sm text-ink-secondary" :title="formatFullDate(doc.updatedAt)">
                {{ formatRelativeTime(doc.updatedAt) }}
              </span>
            </td>

            <!-- Actions: if owner, icon buttons to share or delete -->
            <td class="px-4 py-3.5 text-right align-middle" @click.stop>
              <div
                v-if="doc.permission === 'owner'"
                class="inline-flex items-center justify-end gap-1.5"
              >
                <Button
                  variant="outlined"
                  size="small"
                  square
                  title="Share document"
                  aria-label="Share document"
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
                  title="Delete document"
                  aria-label="Delete document"
                  @click.stop="openDeleteDialog(doc)"
                >
                  <template #icon>
                    <Icon name="Trash" :size="16" />
                  </template>
                </Button>
              </div>
              <div v-else class="inline-flex items-center justify-end">
                <span
                  class="rounded bg-subtle px-1.5 py-0.5 text-xs text-muted capitalize"
                  :title="`Your role: ${doc.permission}`"
                >
                  {{ doc.permission }}
                </span>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Pagination and Page Size Footer Bar -->
      <div
        class="flex flex-wrap items-center justify-between gap-4 border-t border-line-subtle bg-subtle px-4 py-3 max-md:flex-col max-md:items-center max-md:gap-2.5"
      >
        <!-- Range Information -->
        <div class="text-sm text-ink-secondary">
          Showing
          <strong class="font-semibold text-ink">{{ fromItem }}</strong>
          –
          <strong class="font-semibold text-ink">{{ toItem }}</strong>
          of
          <strong class="font-semibold text-ink">{{ totalDocuments }}</strong>
        </div>

        <!-- Page Navigation Buttons -->
        <div class="flex items-center gap-1">
          <button
            type="button"
            class="inline-flex h-[30px] min-w-[30px] cursor-pointer items-center justify-center rounded-md border px-1 text-[0.85rem] transition-[background-color,color,border-color] duration-150 disabled:cursor-not-allowed disabled:opacity-40"
            :class="pageButtonClass(false)"
            title="First page"
            aria-label="First page"
            :disabled="currentPage === 1 || loading"
            @click="goToPage(1)"
          >
            <Icon name="ChevronsLeft" :size="16" />
          </button>
          <button
            type="button"
            class="inline-flex h-[30px] min-w-[30px] cursor-pointer items-center justify-center rounded-md border px-1 text-[0.85rem] transition-[background-color,color,border-color] duration-150 disabled:cursor-not-allowed disabled:opacity-40"
            :class="pageButtonClass(false)"
            title="Previous page"
            aria-label="Previous page"
            :disabled="currentPage === 1 || loading"
            @click="goToPage(currentPage - 1)"
          >
            <Icon name="ChevronLeft" :size="16" />
          </button>

          <!-- Page numbers -->
          <div class="flex items-center gap-0.5">
            <template v-for="(p, idx) in visiblePages" :key="idx">
              <span
                v-if="p === '...'"
                class="inline-flex h-[30px] w-6 items-center justify-center text-[0.85rem] text-muted"
              >
                …
              </span>
              <button
                v-else
                type="button"
                class="inline-flex h-[30px] min-w-[30px] cursor-pointer items-center justify-center rounded-md border px-1.5 text-[0.85rem] transition-[background-color,color,border-color] duration-150 disabled:cursor-not-allowed disabled:opacity-40"
                :class="pageButtonClass(Number(p) === currentPage)"
                :aria-current="Number(p) === currentPage ? 'page' : undefined"
                :disabled="loading"
                @click="goToPage(Number(p))"
              >
                {{ p }}
              </button>
            </template>
          </div>

          <button
            type="button"
            class="inline-flex h-[30px] min-w-[30px] cursor-pointer items-center justify-center rounded-md border px-1 text-[0.85rem] transition-[background-color,color,border-color] duration-150 disabled:cursor-not-allowed disabled:opacity-40"
            :class="pageButtonClass(false)"
            title="Next page"
            aria-label="Next page"
            :disabled="currentPage >= totalPages || loading"
            @click="goToPage(currentPage + 1)"
          >
            <Icon name="ChevronRight" :size="16" />
          </button>
          <button
            type="button"
            class="inline-flex h-[30px] min-w-[30px] cursor-pointer items-center justify-center rounded-md border px-1 text-[0.85rem] transition-[background-color,color,border-color] duration-150 disabled:cursor-not-allowed disabled:opacity-40"
            :class="pageButtonClass(false)"
            title="Last page"
            aria-label="Last page"
            :disabled="currentPage >= totalPages || loading"
            @click="goToPage(totalPages)"
          >
            <Icon name="ChevronsRight" :size="16" />
          </button>
        </div>

        <!-- Rows per page selector: 5, 10, 20 (default 10) -->
        <div class="flex items-center gap-2">
          <label for="page-size-select" class="text-[0.85rem] whitespace-nowrap text-ink-secondary"
            >Rows:</label
          >
          <select
            id="page-size-select"
            :value="pageSize"
            class="cursor-pointer rounded-md border border-line bg-surface px-2 py-1 text-[0.85rem] text-ink outline-none transition-colors duration-150 focus:border-brand"
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
    <Modal v-model="showDeleteModal" title="Delete Document" size="small">
      <div class="flex flex-col gap-3 text-[0.95rem] text-ink">
        <p>
          Are you sure you want to delete
          <strong>"{{ selectedDeleteDoc?.title || 'Untitled Document' }}"</strong>?
        </p>
        <p class="m-0 text-[0.85rem] text-ink-secondary">
          This document and all its contents will be permanently deleted. This action cannot be
          undone.
        </p>
      </div>
      <template #footer>
        <Button
          variant="outlined"
          size="small"
          :disabled="isDeleting"
          @click="showDeleteModal = false"
        >
          Cancel
        </Button>
        <Button color="alert" size="small" :loading="isDeleting" @click="confirmDelete">
          Delete Document
        </Button>
      </template>
    </Modal>

    <!-- Notification Toast -->
    <div class="pointer-events-auto fixed right-6 bottom-6 z-[1001]">
      <Toast v-model="showToast" :type="toastType" :message="toastMessage" :duration="4000" />
    </div>
  </div>
</template>
