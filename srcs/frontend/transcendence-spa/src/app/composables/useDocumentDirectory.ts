import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { deleteDocument, listDocuments, type DocumentData } from '@/app/editor/document.api'
import { validateSearchQuery } from '@/utils/validation'
import { logger } from '@/utils/logger'

export type DocumentScope = 'all' | 'own' | 'shared'
export type DocumentSortField = 'updatedAt' | 'createdAt' | 'title'
export type DocumentSortOrder = 'ASC' | 'DESC'
export type ToastType = 'good' | 'alert' | 'info' | 'warn'

const DEFAULT_PAGE_SIZE = 10
const SEARCH_DEBOUNCE_MS = 300

export function useDocumentDirectory() {
  const { t } = useI18n()
  const documents = ref<DocumentData[]>([])
  const loading = ref(false)
  const errorMessage = ref<string | null>(null)
  const searchQuery = ref('')
  const searchError = ref('')
  const activeQuery = ref('')
  const selectedScope = ref<DocumentScope>('all')
  const sortField = ref<DocumentSortField>('updatedAt')
  const sortOrder = ref<DocumentSortOrder>('DESC')

  const pageSize = ref<number>(DEFAULT_PAGE_SIZE)
  const currentPage = ref<number>(1)
  const totalDocuments = ref<number>(0)

  const totalPages = computed(() => Math.max(1, Math.ceil(totalDocuments.value / pageSize.value)))
  const fromItem = computed(() =>
    totalDocuments.value === 0 ? 0 : (currentPage.value - 1) * pageSize.value + 1,
  )
  const toItem = computed(() => Math.min(currentPage.value * pageSize.value, totalDocuments.value))

  const showDeleteModal = ref(false)
  const selectedDeleteDoc = ref<DocumentData | null>(null)
  const isDeleting = ref(false)

  const showToast = ref(false)
  const toastMessage = ref('')
  const toastType = ref<ToastType>('good')

  let debounceTimer: ReturnType<typeof setTimeout> | undefined
  let lastRequestId = 0

  async function fetchDocuments() {
    const requestId = ++lastRequestId
    const query = searchQuery.value.trim()

    loading.value = true
    errorMessage.value = null

    try {
      const offset = (currentPage.value - 1) * pageSize.value
      const res = await listDocuments({
        scope: selectedScope.value,
        sort: sortField.value,
        order: sortOrder.value,
        limit: pageSize.value,
        offset,
        q: query || undefined,
      })

      if (requestId !== lastRequestId) return

      documents.value = res.documents
      totalDocuments.value = res.pagination?.total ?? res.documents.length
      activeQuery.value = query
    } catch (err) {
      if (requestId !== lastRequestId) return

      logger.error('Failed to load documents:', err)
      errorMessage.value = err instanceof Error ? err.message : t('documents.fetchFailed')
    } finally {
      if (requestId === lastRequestId) {
        loading.value = false
      }
    }
  }

  function onSearchInput() {
    const result = validateSearchQuery(searchQuery.value)
    searchError.value = result.error ?? ''
    clearTimeout(debounceTimer)

    if (result.error) return

    debounceTimer = setTimeout(() => {
      currentPage.value = 1
      void fetchDocuments()
    }, SEARCH_DEBOUNCE_MS)
  }

  function clearSearch() {
    clearTimeout(debounceTimer)
    searchQuery.value = ''
    searchError.value = ''
    currentPage.value = 1
    void fetchDocuments()
  }

  function setScope(scope: DocumentScope) {
    if (selectedScope.value === scope) return
    selectedScope.value = scope
    currentPage.value = 1
    void fetchDocuments()
  }

  function setSortField(field: DocumentSortField) {
    if (sortField.value === field) return
    sortField.value = field
    currentPage.value = 1
    void fetchDocuments()
  }

  function toggleSortOrder() {
    sortOrder.value = sortOrder.value === 'DESC' ? 'ASC' : 'DESC'
    currentPage.value = 1
    void fetchDocuments()
  }

  function handlePageSizeChange(newSize: number) {
    if (pageSize.value === newSize) return
    pageSize.value = newSize
    currentPage.value = 1
    void fetchDocuments()
  }

  function goToPage(page: number) {
    if (page < 1 || page > totalPages.value || page === currentPage.value) return
    currentPage.value = page
    void fetchDocuments()
  }

  function openDeleteDialog(doc: DocumentData) {
    selectedDeleteDoc.value = doc
    showDeleteModal.value = true
  }

  async function confirmDelete() {
    const doc = selectedDeleteDoc.value
    if (!doc) return

    const docTitle = doc.title || t('common.untitledDocument')
    isDeleting.value = true

    try {
      await deleteDocument(doc.id)
      showDeleteModal.value = false
      selectedDeleteDoc.value = null

      toastType.value = 'good'
      toastMessage.value = t('documents.deletedToast', { title: docTitle })
      showToast.value = true

      if (documents.value.length === 1 && currentPage.value > 1) {
        currentPage.value--
      }
      await fetchDocuments()
    } catch (err) {
      logger.error('Failed to delete document:', err)
      toastType.value = 'alert'
      toastMessage.value = err instanceof Error ? err.message : t('documents.deleteFailed')
      showToast.value = true
    } finally {
      isDeleting.value = false
    }
  }

  onMounted(() => {
    void fetchDocuments()
  })

  onBeforeUnmount(() => {
    clearTimeout(debounceTimer)
  })

  return {
    documents,
    loading,
    errorMessage,
    searchQuery,
    searchError,
    activeQuery,
    selectedScope,
    sortField,
    sortOrder,
    pageSize,
    currentPage,
    totalDocuments,
    totalPages,
    fromItem,
    toItem,
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
    setSortField,
    toggleSortOrder,
    handlePageSizeChange,
    goToPage,
    openDeleteDialog,
    confirmDelete,
  }
}
