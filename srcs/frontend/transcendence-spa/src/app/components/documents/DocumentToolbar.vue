<script setup lang="ts">
import Icon from '@/app/components/Icon.vue'
import type { DocumentScope } from '@/app/composables/useDocumentDirectory'

const props = defineProps<{
  searchQuery: string
  scope: DocumentScope
  loading: boolean
}>()

const emit = defineEmits<{
  'search-input': [value: string]
  clear: []
  'update:scope': [value: DocumentScope]
  refresh: []
}>()

function onInput(event: Event) {
  emit('search-input', (event.target as HTMLInputElement).value)
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
    <div class="relative flex min-w-[260px] flex-1 items-center">
      <Icon name="Search" :size="16" class="pointer-events-none absolute left-3 text-muted" />
      <input
        :value="props.searchQuery"
        type="text"
        class="w-full rounded-lg border border-line bg-surface py-2 pr-[34px] pl-9 text-[0.9rem] text-ink transition-[border-color,box-shadow] outline-none placeholder:text-muted focus:border-brand focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-primary)_20%,transparent)]"
        placeholder="Search title and content..."
        aria-label="Search documents by title and content"
        @input="onInput"
      />
      <button
        v-if="props.searchQuery"
        type="button"
        class="absolute right-2 flex h-[22px] w-[22px] cursor-pointer items-center justify-center rounded-full border-none bg-transparent p-0 text-lg leading-none text-muted hover:bg-subtle hover:text-ink"
        title="Clear search"
        aria-label="Clear search"
        @click="emit('clear')"
      >
        ×
      </button>
    </div>

    <div class="flex items-center gap-1 rounded-lg bg-subtle p-1">
      <button type="button" :class="tabClass('all')" @click="emit('update:scope', 'all')">
        All
      </button>
      <button type="button" :class="tabClass('own')" @click="emit('update:scope', 'own')">
        Owned
      </button>
      <button type="button" :class="tabClass('shared')" @click="emit('update:scope', 'shared')">
        Shared
      </button>

      <button
        type="button"
        class="ml-1 inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border-none bg-transparent p-0 text-ink-secondary transition-[background-color,color] duration-150 hover:bg-surface hover:text-ink"
        title="Refresh documents"
        aria-label="Refresh documents"
        :disabled="props.loading"
        @click="emit('refresh')"
      >
        <Icon name="Refresh" :size="16" :class="{ 'animate-spin': props.loading }" />
      </button>
    </div>
  </div>
</template>
