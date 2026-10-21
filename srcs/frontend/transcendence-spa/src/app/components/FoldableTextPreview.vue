<template>
  <div class="canonical-preview" :class="{ 'canonical-preview--expanded': expanded }">
    <button
      type="button"
      class="canonical-preview__toggle"
      :aria-expanded="expanded"
      @click.stop="expanded = !expanded"
      @keydown.enter.prevent.stop="expanded = !expanded"
      @keydown.space.prevent.stop="expanded = !expanded"
    >
      <!-- <span class="canonical-label">EN:</span> -->
      <span class="canonical-text">{{ text }}</span>
      <span class="canonical-chevron" aria-hidden="true">{{ expanded ? '▾' : '▸' }}</span>
    </button>
    <span
      class="canonical-status"
      :class="isDirty ? 'canonical-status--draft' : 'canonical-status--synced'"
      :title="isDirty ? 'Pending back-translation on blur' : 'Synchronized with database'"
    >
      {{ isDirty ? 'Draft' : 'Synced' }}
    </span>
  </div>
</template>

<script lang="ts" setup>
import { ref } from 'vue'

defineProps<{
  text: string
  isDirty: boolean
}>()

const expanded = ref(false)
</script>

<style lang="css" scoped>
.canonical-preview {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 4px;
  padding: 2px 8px;
  /* background-color: var(--bg-subtle, rgba(0, 0, 0, 0.04)); */
  border-radius: 4px;
  font-size: 0.72rem;
  color: var(--text-muted, #64748b);
}

.canonical-preview--expanded {
  align-items: flex-start;
}

.canonical-preview__toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  min-width: 0;
  padding: 0;
  border: none;
  background: transparent;
  font: inherit;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.canonical-preview__toggle:hover .canonical-text,
.canonical-preview__toggle:focus-visible .canonical-text {
  color: var(--text-secondary, #475569);
}

.canonical-preview__toggle:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
  border-radius: 4px;
}

.canonical-label {
  flex-shrink: 0;
  font-weight: 700;
  color: var(--text-secondary, #475569);
}

.canonical-text {
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-style: italic;
}

.canonical-preview--expanded .canonical-text {
  white-space: pre-wrap;
  overflow: visible;
  word-break: break-word;
}

.canonical-chevron {
  flex-shrink: 0;
  font-size: 0.7rem;
  opacity: 0.7;
}

.canonical-status {
  flex-shrink: 0;
  padding: 1px 5px;
  border-radius: 9999px;
  font-size: 0.65rem;
  font-weight: 600;
}

.canonical-preview--expanded .canonical-status {
  margin-top: 1px;
}

.canonical-status--synced {
  background-color: color-mix(in srgb, var(--color-success, #22c55e) 15%, transparent);
  color: var(--color-success, #22c55e);
}

.canonical-status--draft {
  background-color: color-mix(in srgb, var(--color-warn, #eab308) 15%, transparent);
  color: var(--color-warn, #eab308);
}
</style>
