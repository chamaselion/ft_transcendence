<template>
  <div ref="containerRef" class="relative inline-flex items-center">
    <!-- Trigger Button -->
    <Button
      variant="flat"
      size="small"
      :disabled="disabled || loading || personasLoading"
      class="gap-1.5! px-2! py-[3px]! text-[0.8125rem]!"
      :title="
        loading ? $t('editor.elaborate.triggerLoadingTitle') : $t('editor.elaborate.triggerTitle')
      "
      @click="toggleMenu"
    >
      <template #icon>
        <Icon name="Sparkles" :size="16" :class="{ 'animate-spin': loading }" />
      </template>
      <span class="text-[0.775rem]">
        {{ loading ? $t('editor.elaborate.triggerLoading') : $t('editor.elaborate.trigger') }}
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
        <span>{{ $t('editor.elaborate.menuTitle') }}</span>
      </div>

      <p v-if="personasError" class="m-0 px-2 py-1.5 text-[0.72rem] text-danger">
        {{ personasError }}
      </p>

      <div v-for="cat in categories" :key="cat" class="flex flex-col gap-0.5">
        <div
          class="px-2 pt-1.5 pb-[3px] text-[0.7rem] font-bold tracking-[0.03em] text-muted uppercase"
        >
          {{ categoryLabel(cat) }}
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
            {{ personaName(persona) }}
          </div>
          <div class="mt-0.5 text-[0.72rem] leading-[1.35] text-ink-secondary">
            {{ personaDescription(persona) }}
          </div>
        </button>
      </div>
    </div>

    <!-- Hidden / Semantic HTML Select for automated testing & accessibility -->
    <select
      class="sr-only"
      :aria-label="$t('editor.elaborate.nativeLabel')"
      tabindex="-1"
      :disabled="disabled || loading || personasLoading"
      @change="onNativeSelectChange"
    >
      <option value="" disabled selected>{{ $t('editor.elaborate.nativePlaceholder') }}</option>
      <optgroup v-for="cat in categories" :key="cat" :label="categoryLabel(cat)">
        <option
          v-for="persona in getPersonasForCategory(cat)"
          :key="persona.key"
          :value="persona.key"
          :title="personaDescription(persona)"
        >
          {{ personaName(persona) }}
        </option>
      </optgroup>
    </select>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import Button from '@/app/components/Button.vue'
import Icon from '@/app/components/Icon.vue'
import { logger } from '@/utils/logger'
import {
  fetchPersonas,
  PERSONA_CATEGORY_KEYS,
  type PersonaKey,
  type PersonaDefinition,
} from '@/app/editor/elaboration.api'

const { t, te } = useI18n()

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
const personas = ref<PersonaDefinition[]>([])
const personasLoading = ref(true)
const personasError = ref('')

const categories = computed(() => {
  const seen = new Set<string>()
  return personas.value
    .map((persona) => persona.category)
    .filter((category) => {
      if (seen.has(category)) return false
      seen.add(category)
      return true
    })
})

function toggleMenu() {
  if (props.disabled || props.loading || personasLoading.value) return
  isOpen.value = !isOpen.value
}

function selectPersona(key: PersonaKey) {
  isOpen.value = false
  emit('select', key)
}

function getPersonasForCategory(category: string): PersonaDefinition[] {
  return personas.value.filter((persona) => persona.category === category)
}

function categoryLabel(category: string): string {
  const key = PERSONA_CATEGORY_KEYS[category]
  const translationKey = key ? `editor.elaborate.categories.${key}` : ''
  return translationKey && te(translationKey) ? t(translationKey) : category
}

function personaName(persona: PersonaDefinition): string {
  const key = `editor.elaborate.personas.${persona.key}.name`
  return te(key) ? t(key) : persona.name
}

function personaDescription(persona: PersonaDefinition): string {
  const key = `editor.elaborate.personas.${persona.key}.description`
  return te(key) ? t(key) : persona.description
}

async function loadPersonas() {
  personasLoading.value = true
  personasError.value = ''
  try {
    personas.value = await fetchPersonas()
  } catch (error) {
    logger.error('Failed to load AI personas:', error)
    personasError.value = t('editor.elaborate.loadFailed')
  } finally {
    personasLoading.value = false
  }
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
  void loadPersonas()
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside)
  document.removeEventListener('keydown', handleKeydown)
})
</script>
