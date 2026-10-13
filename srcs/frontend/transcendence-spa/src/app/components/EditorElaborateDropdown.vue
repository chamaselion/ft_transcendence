<template>
  <div ref="containerRef" class="elaborate-dropdown">
    <!-- Trigger Button -->
    <Button
      variant="flat"
      size="small"
      :disabled="disabled || loading"
      class="elaborate-dropdown__btn"
      :title="loading ? 'Elaborating block with AI...' : 'Rewrite or elaborate paragraph with AI persona'"
      @click="toggleMenu"
    >
      <template #icon>
        <Icon
          name="Sparkles"
          :size="16"
          :class="{ 'elaborate-dropdown__sparkle--spinning': loading }"
        />
      </template>
      <span class="elaborate-dropdown__btn-text">
        {{ loading ? 'Elaborating…' : 'AI Elaborate' }}
      </span>
      <span class="elaborate-dropdown__chevron" aria-hidden="true">▾</span>
    </Button>

    <!-- Dropdown Menu Popover -->
    <div
      v-if="isOpen"
      class="elaborate-menu"
      role="menu"
      aria-orientation="vertical"
    >
      <div class="elaborate-menu__header">
        <Icon name="Sparkles" :size="14" />
        <span>Select AI Block Persona</span>
      </div>

      <div
        v-for="cat in PERSONA_CATEGORIES"
        :key="cat"
        class="elaborate-menu__category"
      >
        <div class="elaborate-menu__category-title">
          {{ cat }}
        </div>

        <button
          v-for="persona in getPersonasForCategory(cat)"
          :key="persona.key"
          type="button"
          class="elaborate-menu__item"
          role="menuitem"
          @click="selectPersona(persona.key)"
        >
          <div class="elaborate-menu__item-name">
            {{ persona.name }}
          </div>
          <div class="elaborate-menu__item-desc">
            {{ persona.description }}
          </div>
        </button>
      </div>
    </div>

    <!-- Hidden / Semantic HTML Select for automated testing & accessibility -->
    <select
      class="elaborate-dropdown__native-select"
      aria-label="AI Persona"
      tabindex="-1"
      :disabled="disabled || loading"
      @change="onNativeSelectChange"
    >
      <option value="" disabled selected>Elaborate with AI</option>
      <optgroup
        v-for="cat in PERSONA_CATEGORIES"
        :key="cat"
        :label="cat"
      >
        <option
          v-for="persona in getPersonasForCategory(cat)"
          :key="persona.key"
          :value="persona.key"
          :title="persona.description"
        >
          {{ persona.name }}
        </option>
      </optgroup>
    </select>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import Button from '@/app/components/Button.vue'
import Icon from '@/app/components/Icon.vue'
import {
  PERSONAS,
  PERSONA_CATEGORIES,
  type PersonaKey,
  type PersonaDefinition,
} from '@/app/editor/elaboration.api'

const props = withDefaults(
  defineProps<{
    disabled?: boolean
    loading?: boolean
  }>(),
  {
    disabled: false,
    loading: false,
  },
)

const emit = defineEmits<{
  select: [personaKey: PersonaKey]
}>()

const isOpen = ref(false)
const containerRef = ref<HTMLElement | null>(null)

function toggleMenu() {
  if (props.disabled || props.loading) return
  isOpen.value = !isOpen.value
}

function selectPersona(key: PersonaKey) {
  isOpen.value = false
  emit('select', key)
}

function getPersonasForCategory(cat: string): PersonaDefinition[] {
  return PERSONAS.filter((p) => p.category === cat)
}

function onNativeSelectChange(e: Event) {
  const select = e.target as HTMLSelectElement
  const key = select.value as PersonaKey
  if (key) {
    emit('select', key)
    select.value = ''
  }
}

function handleClickOutside(e: MouseEvent) {
  if (containerRef.value && !containerRef.value.contains(e.target as Node)) {
    isOpen.value = false
  }
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && isOpen.value) {
    isOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
  document.addEventListener('keydown', handleKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside)
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<style scoped>
.elaborate-dropdown {
  position: relative;
  display: inline-flex;
  align-items: center;
  color: var(--btn-contrast);
}

.elaborate-dropdown__btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-weight: 500;
  font-size: 0.8125rem;
  color: var(--color-primary-contrast);
  padding: 3px 8px;
  border-radius: 6px;
  transition: background-color 0.15s ease, opacity 0.15s ease;
}

.elaborate-dropdown__btn-text {
  font-size: 0.775rem;
}

.elaborate-dropdown__chevron {
  font-size: 0.65rem;
  opacity: 0.8;
  margin-left: 2px;
}

.elaborate-dropdown__sparkle--spinning {
  animation: spin 1.2s infinite linear;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.elaborate-menu {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  z-index: 100;
  width: 360px;
  max-width: 90vw;
  max-height: 460px;
  overflow-y: auto;
  background-color: var(--bg-surface, #ffffff);
  border: 1px solid var(--border-default, #e2e8f0);
  border-radius: 8px;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.elaborate-menu__header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--color-primary, #3b82f6);
  border-bottom: 1px solid var(--border-subtle, #f1f5f9);
}

.elaborate-menu__category {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.elaborate-menu__category-title {
  padding: 6px 8px 3px;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  color: var(--text-muted, #94a3b8);
}

.elaborate-menu__item {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  text-align: left;
  padding: 6px 8px;
  border-radius: 6px;
  background: transparent;
  border: none;
  cursor: pointer;
  transition: background-color 0.15s ease;
  width: 100%;
}

.elaborate-menu__item:hover {
  background-color: var(--bg-subtle, #f8fafc);
}

.elaborate-menu__item-name {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-primary, #0f172a);
}

.elaborate-menu__item-desc {
  margin-top: 2px;
  font-size: 0.72rem;
  line-height: 1.35;
  color: var(--text-secondary, #64748b);
}

/* Visually hidden native select kept for screen readers & integration tests */
.elaborate-dropdown__native-select {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  border: 0;
}
</style>
