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
const fromItem = computed(() => (props.total === 0 ? 0 : props.offset + 1))
const toItem = computed(() => Math.min(props.offset + props.limit, props.total))
const visiblePages = computed(() => buildVisiblePages(currentPage.value, totalPages.value))

const pageButtonClass = (active: boolean) =>
  active
    ? 'border-brand bg-brand font-semibold text-brand-contrast hover:enabled:bg-brand-hover hover:enabled:text-brand-contrast'
    : 'border-transparent bg-transparent font-medium text-ink-secondary hover:enabled:border-line-subtle hover:enabled:bg-surface hover:enabled:text-ink'

const pageButtonBaseClass =
  'inline-flex h-[30px] min-w-[30px] cursor-pointer items-center justify-center rounded-md border text-[0.85rem] transition-[background-color,color,border-color] duration-150 disabled:cursor-not-allowed disabled:opacity-40'

function goToPage(page: number) {
  if (page < 1 || page > totalPages.value || page === currentPage.value) return
  emit('page-change', page)
}

function onPageSizeChange(event: Event) {
  emit('limit-change', Number((event.target as HTMLSelectElement).value))
}
</script>

<template>
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
      <strong class="font-semibold text-ink">{{ props.total }}</strong>
    </div>

    <!-- Page Navigation Buttons -->
    <div class="flex items-center gap-1">
      <button
        type="button"
        :class="[pageButtonBaseClass, pageButtonClass(false), 'px-1']"
        title="First page"
        aria-label="First page"
        :disabled="currentPage === 1 || props.loading"
        @click="goToPage(1)"
      >
        <Icon name="ChevronsLeft" :size="16" />
      </button>
      <button
        type="button"
        :class="[pageButtonBaseClass, pageButtonClass(false), 'px-1']"
        title="Previous page"
        aria-label="Previous page"
        :disabled="currentPage === 1 || props.loading"
        @click="goToPage(currentPage - 1)"
      >
        <Icon name="ChevronLeft" :size="16" />
      </button>

      <!-- Page numbers -->
      <div class="flex items-center gap-0.5">
        <template v-for="(page, index) in visiblePages" :key="index">
          <span
            v-if="page === '...'"
            class="inline-flex h-[30px] w-6 items-center justify-center text-[0.85rem] text-muted"
          >
            …
          </span>
          <button
            v-else
            type="button"
            :class="[pageButtonBaseClass, pageButtonClass(Number(page) === currentPage), 'px-1.5']"
            :aria-current="Number(page) === currentPage ? 'page' : undefined"
            :disabled="props.loading"
            @click="goToPage(Number(page))"
          >
            {{ page }}
          </button>
        </template>
      </div>

      <button
        type="button"
        :class="[pageButtonBaseClass, pageButtonClass(false), 'px-1']"
        title="Next page"
        aria-label="Next page"
        :disabled="currentPage >= totalPages || props.loading"
        @click="goToPage(currentPage + 1)"
      >
        <Icon name="ChevronRight" :size="16" />
      </button>
      <button
        type="button"
        :class="[pageButtonBaseClass, pageButtonClass(false), 'px-1']"
        title="Last page"
        aria-label="Last page"
        :disabled="currentPage >= totalPages || props.loading"
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
        :value="props.limit"
        class="cursor-pointer rounded-md border border-line bg-surface px-2 py-1 text-[0.85rem] text-ink outline-none transition-colors duration-150 focus:border-brand"
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
