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
</script>

<template>
  <div class="directory__toolbar">
    <div class="directory__search-wrapper">
      <Icon name="Search" :size="16" class="directory__search-icon" />
      <input
        :value="props.searchQuery"
        type="text"
        class="directory__search-input"
        placeholder="Search title and content..."
        aria-label="Search documents by title and content"
        @input="onInput"
      />
      <button
        v-if="props.searchQuery"
        type="button"
        class="directory__search-clear"
        title="Clear search"
        aria-label="Clear search"
        @click="emit('clear')"
      >
        ×
      </button>
    </div>

    <div class="directory__filters">
      <button
        type="button"
        class="directory__filter-tab"
        :class="{ 'directory__filter-tab--active': props.scope === 'all' }"
        @click="emit('update:scope', 'all')"
      >
        All
      </button>
      <button
        type="button"
        class="directory__filter-tab"
        :class="{ 'directory__filter-tab--active': props.scope === 'own' }"
        @click="emit('update:scope', 'own')"
      >
        Owned
      </button>
      <button
        type="button"
        class="directory__filter-tab"
        :class="{ 'directory__filter-tab--active': props.scope === 'shared' }"
        @click="emit('update:scope', 'shared')"
      >
        Shared
      </button>

      <button
        type="button"
        class="directory__refresh-btn"
        title="Refresh documents"
        aria-label="Refresh documents"
        :disabled="props.loading"
        @click="emit('refresh')"
      >
        <Icon name="Refresh" :size="16" :class="{ 'directory__refresh-spinner': props.loading }" />
      </button>
    </div>
  </div>
</template>

<style scoped>
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
</style>
