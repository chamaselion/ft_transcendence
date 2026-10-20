<template>
  <div ref="containerRef" class="relative inline-flex items-center">
    <!-- Trigger Button -->
    <Button
      variant="flat"
      size="small"
      :disabled="disabled || loading"
      class="gap-1.5! px-2! py-[3px]! text-[0.8125rem]!"
      :title="loading ? 'Elaborating block with AI...' : 'Rewrite or elaborate paragraph with AI persona'"
      @click="toggleMenu"
    >
      <template #icon>
        <Icon name="Sparkles" :size="16" :class="{ 'animate-spin': loading }" />
      </template>
      <span class="text-[0.775rem]">
        {{ loading ? 'Elaborating…' : 'AI Elaborate' }}
      </span>
      <span class="ml-0.5 text-[0.65rem] opacity-80" aria-hidden="true">▾</span>
    </Button>

    <!-- Dropdown Menu Popover -->
    <div
      v-if="isOpen"
      class="absolute top-[calc(100%+6px)] left-0 z-[100] flex max-h-[460px] w-[360px] max-w-[90vw] flex-col gap-1.5 overflow-y-auto rounded-lg border border-line bg-surface p-1.5 shadow-[0_10px_25px_-5px_rgba(0,0,0,0.15),0_8px_10px_-6px_rgba(0,0,0,0.1)]"
      role="menu"
      aria-orientation="vertical"
    >
      <div
        class="flex items-center gap-1.5 border-b border-line-subtle px-2 py-1.5 text-xs font-bold text-brand"
      >
        <Icon name="Sparkles" :size="14" />
        <span>Select AI Block Persona</span>
      </div>

      <div v-for="cat in PERSONA_CATEGORIES" :key="cat" class="flex flex-col gap-0.5">
        <div
          class="px-2 pt-1.5 pb-[3px] text-[0.7rem] font-bold tracking-[0.03em] text-muted uppercase"
        >
          {{ cat }}
        </div>

        <button
          v-for="persona in getPersonasForCategory(cat)"
          :key="persona.key"
          type="button"
          class="flex w-full cursor-pointer flex-col items-start rounded-md border-none bg-transparent px-2 py-1.5 text-left transition-colors duration-150 hover:bg-subtle"
          role="menuitem"
          @click="selectPersona(persona.key)"
        >
          <div class="text-[0.8125rem] font-semibold text-ink">
            {{ persona.name }}
          </div>
          <div class="mt-0.5 text-[0.72rem] leading-[1.35] text-ink-secondary">
            {{ persona.description }}
          </div>
        </button>
      </div>
    </div>

    <!-- Hidden / Semantic HTML Select for automated testing & accessibility -->
    <select
      class="sr-only"
      aria-label="AI Persona"
      tabindex="-1"
      :disabled="disabled || loading"
      @change="onNativeSelectChange"
    >
      <option value="" disabled selected>Elaborate with AI</option>
      <optgroup v-for="cat in PERSONA_CATEGORIES" :key="cat" :label="cat">
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
