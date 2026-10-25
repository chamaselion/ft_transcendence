<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useLocale } from '@/app/layout/useLocale'
import { useEditorStore } from '@/stores/editor'
import type { AppLocale } from '@/i18n'

const { t } = useI18n()
const { currentLocale, locales, setLocale } = useLocale()
const editorStore = useEditorStore()

const isOpen = ref(false)
const root = ref<HTMLElement | null>(null)
const isLocked = computed(() => editorStore.isElaborating || editorStore.isTranslating)
const translationProgress = computed(() => editorStore.translationProgress)
const lockTitle = computed(() => {
  if (editorStore.isElaborating) return t('editor.elaborate.triggerLoadingTitle')
  if (translationProgress.value) {
    return t('editor.translatingProgress', translationProgress.value)
  }
  return t('editor.translating')
})

const currentFlag = computed(
  () => locales.find((option) => option.code === currentLocale.value)?.flag ?? '',
)
const currentLabel = computed(
  () => locales.find((option) => option.code === currentLocale.value)?.label ?? '',
)

const toggle = () => {
  if (isLocked.value) return
  isOpen.value = !isOpen.value
}

const close = () => {
  isOpen.value = false
}

const selectLocale = async (code: AppLocale) => {
  if (isLocked.value) return
  isOpen.value = false
  await setLocale(code)
}

watch(isLocked, (locked) => {
  if (locked) close()
})

const onDocumentClick = (event: MouseEvent) => {
  if (!isOpen.value) return
  const target = event.target as Node | null
  if (target && root.value && !root.value.contains(target)) close()
}

const onDocumentKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') close()
}

onMounted(() => {
  document.addEventListener('click', onDocumentClick)
  document.addEventListener('keydown', onDocumentKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', onDocumentClick)
  document.removeEventListener('keydown', onDocumentKeydown)
})
</script>

<template>
  <div
    ref="root"
    class="language-switcher"
    :class="{ 'language-switcher--open': isOpen }"
  >
    <button
      type="button"
      class="language-switcher__trigger"
      :class="{ 'language-switcher__trigger--locked': isLocked }"
      :aria-label="isLocked ? lockTitle : `${$t('nav.language')}: ${currentLabel}`"
      :title="isLocked ? lockTitle : `${$t('nav.language')}: ${currentLabel}`"
      :aria-disabled="isLocked"
      :aria-busy="isLocked"
      aria-haspopup="listbox"
      :aria-expanded="isOpen"
      @click="toggle"
    >
      <span
        v-if="isLocked"
        class="language-switcher__flag language-switcher__flag--busy"
        aria-hidden="true"
        >🟡</span
      >
      <span v-else class="language-switcher__flag" aria-hidden="true">{{ currentFlag }}</span>
      <span
        v-if="isLocked && translationProgress"
        class="language-switcher__progress"
        aria-hidden="true"
      >
        {{ translationProgress.done }}/{{ translationProgress.total }}
      </span>
      <span v-if="!isLocked" class="language-switcher__caret" aria-hidden="true" />
    </button>

    <ul
      v-if="isOpen"
      class="language-switcher__menu"
      role="listbox"
      :aria-label="$t('nav.language')"
    >
      <li v-for="option in locales" :key="option.code" role="none">
        <button
          type="button"
          role="option"
          class="language-switcher__option"
          :class="{ 'language-switcher__option--active': option.code === currentLocale }"
          :aria-selected="option.code === currentLocale"
          :aria-label="option.label"
          :title="option.label"
          @click="selectLocale(option.code)"
        >
          <span class="language-switcher__flag" aria-hidden="true">{{ option.flag }}</span>
        </button>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.language-switcher {
  position: relative;
  display: inline-flex;
}

.language-switcher__trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  margin: 0;
  padding: 8px 14px;
  border: 1px solid transparent;
  border-radius: 8px;
  background-color: transparent;
  color: var(--text-secondary);
  font-family: inherit;
  font-size: 18px;
  font-weight: 500;
  line-height: 1.4;
  cursor: pointer;
  transition: background-color 0.2s ease, color 0.2s ease,
    border-color 0.2s ease, box-shadow 0.2s ease;
}

.language-switcher__trigger:hover {
  background-color: color-mix(in srgb, var(--text-primary) 8%, transparent);
  color: var(--text-primary);
}

.language-switcher__trigger--locked {
  cursor: not-allowed;
}

.language-switcher__trigger--locked:hover {
  background-color: transparent;
  color: var(--text-secondary);
}

.language-switcher__trigger:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.language-switcher__flag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 1.15em;
  line-height: 1;
}

.language-switcher__flag--busy {
  font-size: 0.95em;
  animation: language-switcher-pulse 1.2s ease-in-out infinite;
}

.language-switcher__progress {
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  color: var(--text-secondary);
}

@keyframes language-switcher-pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.45;
  }
}

.language-switcher__caret {
  width: 0;
  height: 0;
  border-right: 4px solid transparent;
  border-left: 4px solid transparent;
  border-top: 5px solid currentColor;
  transition: transform 0.2s ease;
}

.language-switcher--open .language-switcher__caret {
  transform: rotate(180deg);
}

.language-switcher__menu {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  z-index: 30;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 100%;
  margin: 0;
  padding: 4px;
  list-style: none;
  border: 1px solid var(--border-default);
  border-radius: 10px;
  background-color: var(--bg-surface);
  box-shadow: var(--shadow-md);
}

.language-switcher__option {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  margin: 0;
  padding: 8px 12px;
  border: 1px solid transparent;
  border-radius: 6px;
  background-color: transparent;
  color: var(--text-secondary);
  font-family: inherit;
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
  transition: background-color 0.2s ease, border-color 0.2s ease;
}

.language-switcher__option:hover {
  background-color: color-mix(in srgb, var(--text-primary) 8%, transparent);
}

.language-switcher__option:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 1px;
}

.language-switcher__option--active {
  background-color: color-mix(in srgb, var(--color-primary) 14%, transparent);
  border-color: color-mix(in srgb, var(--color-primary) 35%, transparent);
}

@media (max-width: 768px) {
  .language-switcher__trigger {
    min-width: 38px;
    min-height: 38px;
    padding: 8px;
  }
}
</style>
