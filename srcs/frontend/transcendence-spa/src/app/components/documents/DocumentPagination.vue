<script setup lang="ts">
import { computed } from 'vue'
import Icon from '@/app/components/Icon.vue'
import { buildVisiblePages } from '@/app/utils/pagination'

const props = defineProps<{
  total: number
  limit: number
  offset: number
  loading: boolean
}>()

const emit = defineEmits<{
  'page-change': [page: number]
  'limit-change': [limit: number]
}>()

const currentPage = computed(() => Math.floor(props.offset / props.limit) + 1)
const totalPages = computed(() => Math.max(1, Math.ceil(props.total / props.limit)))
const fromItem = computed(() =>
  props.total === 0 ? 0 : props.offset + 1,
)
const toItem = computed(() => Math.min(props.offset + props.limit, props.total))
const visiblePages = computed(() => buildVisiblePages(currentPage.value, totalPages.value))

function goToPage(page: number) {
  if (page < 1 || page > totalPages.value || page === currentPage.value) return
  emit('page-change', page)
}

function onPageSizeChange(event: Event) {
  emit('limit-change', Number((event.target as HTMLSelectElement).value))
}
</script>

<template>
  <div class="directory__pagination">
    <!-- Range Information -->
    <div class="directory__pagination-info">
      Showing
      <strong class="directory__pagination-strong">{{ fromItem }}</strong>
      –
      <strong class="directory__pagination-strong">{{ toItem }}</strong>
      of
      <strong class="directory__pagination-strong">{{ props.total }}</strong>
    </div>

    <!-- Page Navigation Buttons -->
    <div class="directory__pagination-nav">
      <button
        type="button"
        class="directory__page-btn directory__page-btn--arrow"
        title="First page"
        aria-label="First page"
        :disabled="currentPage === 1 || props.loading"
        @click="goToPage(1)"
      >
        <Icon name="ChevronsLeft" :size="16" />
      </button>
      <button
        type="button"
        class="directory__page-btn directory__page-btn--arrow"
        title="Previous page"
        aria-label="Previous page"
        :disabled="currentPage === 1 || props.loading"
        @click="goToPage(currentPage - 1)"
      >
        <Icon name="ChevronLeft" :size="16" />
      </button>

      <!-- Page numbers -->
      <div class="directory__page-numbers">
        <template v-for="(page, index) in visiblePages" :key="index">
          <span v-if="page === '...'" class="directory__page-ellipsis">…</span>
          <button
            v-else
            type="button"
            class="directory__page-btn directory__page-btn--number"
            :class="{ 'directory__page-btn--active': page === currentPage }"
            :aria-current="page === currentPage ? 'page' : undefined"
            :disabled="props.loading"
            @click="goToPage(Number(page))"
          >
            {{ page }}
          </button>
        </template>
      </div>

      <button
        type="button"
        class="directory__page-btn directory__page-btn--arrow"
        title="Next page"
        aria-label="Next page"
        :disabled="currentPage >= totalPages || props.loading"
        @click="goToPage(currentPage + 1)"
      >
        <Icon name="ChevronRight" :size="16" />
      </button>
      <button
        type="button"
        class="directory__page-btn directory__page-btn--arrow"
        title="Last page"
        aria-label="Last page"
        :disabled="currentPage >= totalPages || props.loading"
        @click="goToPage(totalPages)"
      >
        <Icon name="ChevronsRight" :size="16" />
      </button>
    </div>

    <!-- Rows per page selector: 5, 10, 20 (default 10) -->
    <div class="directory__page-size">
      <label for="page-size-select" class="directory__page-size-label">Rows:</label>
      <select
        id="page-size-select"
        :value="props.limit"
        class="directory__page-size-select"
        :disabled="props.loading"
        @change="onPageSizeChange"
      >
        <option :value="5">5</option>
        <option :value="10">10</option>
        <option :value="20">20</option>
      </select>
    </div>
  </div>
</template>

<style scoped>
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

/* Responsive adjustments */
@media (max-width: 768px) {
  .directory__pagination {
    flex-direction: column;
    align-items: center;
    gap: 10px;
  }
}
</style>
