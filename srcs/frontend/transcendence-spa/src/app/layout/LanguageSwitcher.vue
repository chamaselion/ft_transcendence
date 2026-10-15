<script setup lang="ts">
import { useLocale } from '@/app/layout/useLocale'

const { currentLocale, locales, setLocale } = useLocale()

const onChange = (event: Event) => {
  setLocale((event.target as HTMLSelectElement).value)
}
</script>

<template>
  <select
    class="language-switcher"
    :value="currentLocale"
    :aria-label="$t('nav.language')"
    :title="$t('nav.language')"
    @change="onChange"
  >
    <option v-for="option in locales" :key="option.code" :value="option.code">
      {{ option.label }}
    </option>
  </select>
</template>

<style scoped>
.language-switcher {
  display: inline-flex;
  align-items: center;
  margin: 0;
  padding: 8px 14px;
  border: 1px solid transparent;
  border-radius: 8px;
  background-color: transparent;
  color: var(--text-secondary);
  font-family: inherit;
  font-size: 15px;
  font-weight: 500;
  line-height: 1.4;
  cursor: pointer;
  transition: background-color 0.2s ease, color 0.2s ease,
    border-color 0.2s ease, box-shadow 0.2s ease;
}

.language-switcher:hover {
  background-color: color-mix(in srgb, var(--text-primary) 8%, transparent);
  color: var(--text-primary);
}

.language-switcher:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.language-switcher option {
  color: var(--text-primary);
  background-color: var(--bg-surface);
}
</style>
