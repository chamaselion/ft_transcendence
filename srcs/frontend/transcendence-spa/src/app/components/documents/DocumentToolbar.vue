<script setup lang="ts">
import Icon from '@/app/components/Icon.vue'
import type {
  DocumentScope,
  DocumentSortField,
  DocumentSortOrder,
} from '@/app/composables/useDocumentDirectory'
import { SEARCH_QUERY_MAX_LENGTH } from '@/utils/validation'

const props = defineProps<{
  searchQuery: string
  searchError: string
  scope: DocumentScope
  sortField: DocumentSortField
  sortOrder: DocumentSortOrder
  loading: boolean
}>()

const emit = defineEmits<{
  'search-input': [value: string]
  clear: []
  'update:scope': [value: DocumentScope]
  'update:sort-field': [value: DocumentSortField]
  'toggle-sort-order': []
  refresh: []
}>()

function onInput(event: Event) {
  emit('search-input', (event.target as HTMLInputElement).value)
}

function onSortChange(event: Event) {
  emit('update:sort-field', (event.target as HTMLSelectElement).value as DocumentSortField)
}

const tabClass = (scope: DocumentScope) => [
  'inline-flex cursor-pointer items-center gap-1.5 rounded-md border-none px-3 py-1.5 text-[0.85rem] transition-[background-color,color] duration-150',
  props.scope === scope
    ? 'bg-surface font-semibold text-ink shadow-[var(--shadow-sm)]'
    : 'bg-transparent font-medium text-ink-secondary hover:bg-[color-mix(in_srgb,var(--text-primary)_6%,transparent)] hover:text-ink',
]
</script>

<template>
  <div class="flex flex-wrap items-center justify-between gap-3">
    <div class="flex min-w-[260px] flex-1 flex-col gap-1">
      <div class="relative flex items-center">
        <Icon name="Search" :size="16" class="pointer-events-none absolute left-3 text-muted" />
        <input
          :value="props.searchQuery"
          type="text"
          :maxlength="SEARCH_QUERY_MAX_LENGTH"
          class="w-full rounded-lg border border-line bg-surface py-2 pr-[34px] pl-9 text-[0.9rem] text-ink transition-[border-color,box-shadow] outline-none placeholder:text-muted focus:border-brand focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-primary)_20%,transparent)]"
          :placeholder="$t('documents.searchPlaceholder')"
          :aria-label="$t('documents.searchAria')"
          @input="onInput"
        />
        <button
          v-if="props.searchQuery"
          type="button"
          class="absolute right-2 flex h-[22px] w-[22px] cursor-pointer items-center justify-center rounded-full border-none bg-transparent p-0 text-lg leading-none text-muted hover:bg-subtle hover:text-ink"
          :title="$t('documents.clearSearch')"
          :aria-label="$t('documents.clearSearch')"
          @click="emit('clear')"
        >
          ×
        </button>
      </div>
      <span v-if="props.searchError" class="text-[13px] text-danger">{{ props.searchError }}</span>
    </div>

    <div class="flex flex-wrap items-center gap-2">
      <div class="flex items-center gap-1.5 rounded-lg bg-subtle p-1">
        <select
          :value="props.sortField"
          :aria-label="$t('documents.sortBy')"
          class="cursor-pointer rounded-md border border-transparent bg-surface px-2.5 py-1.5 text-[0.82rem] font-medium text-ink shadow-[var(--shadow-sm)] outline-none focus:border-brand"
          @change="onSortChange"
        >
          <option value="updatedAt">{{ $t('documents.sortUpdated') }}</option>
          <option value="createdAt">{{ $t('documents.sortCreated') }}</option>
          <option value="title">{{ $t('documents.sortTitle') }}</option>
        </select>
        <button
          type="button"
          class="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border-none bg-surface p-0 text-xs font-bold text-ink shadow-[var(--shadow-sm)] transition-colors duration-150 hover:text-brand"
          :title="props.sortOrder === 'DESC' ? $t('documents.orderDesc') : $t('documents.orderAsc')"
          :aria-label="
            props.sortOrder === 'DESC' ? $t('documents.orderDesc') : $t('documents.orderAsc')
          "
          @click="emit('toggle-sort-order')"
        >
          {{ props.sortOrder === 'DESC' ? '↓' : '↑' }}
        </button>
      </div>

      <div class="flex items-center gap-1 rounded-lg bg-subtle p-1">
        <button type="button" :class="tabClass('all')" @click="emit('update:scope', 'all')">
          {{ $t('documents.filterAll') }}
        </button>
        <button type="button" :class="tabClass('own')" @click="emit('update:scope', 'own')">
          {{ $t('documents.filterOwned') }}
        </button>
        <button type="button" :class="tabClass('shared')" @click="emit('update:scope', 'shared')">
          {{ $t('documents.filterShared') }}
        </button>

        <button
          type="button"
          class="ml-1 inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border-none bg-transparent p-0 text-ink-secondary transition-[background-color,color] duration-150 hover:bg-surface hover:text-ink"
          :title="$t('documents.refresh')"
          :aria-label="$t('documents.refresh')"
          :disabled="props.loading"
          @click="emit('refresh')"
        >
          <Icon name="Refresh" :size="16" :class="{ 'animate-spin': props.loading }" />
        </button>
      </div>
    </div>
  </div>
</template>
