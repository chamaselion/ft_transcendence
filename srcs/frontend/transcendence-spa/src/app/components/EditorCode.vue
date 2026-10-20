<template>
  <figure class="code m-0 overflow-hidden rounded-lg" :style="style">
    <figcaption
      class="code__header flex items-center justify-between border-b border-white/12 px-3.5 py-2 text-[0.75rem] tracking-[0.04em] uppercase opacity-75"
    >
      <select
        v-if="isEditable"
        class="code__language-select cursor-pointer rounded border border-white/20 bg-white/[0.08] px-1.5 py-0.5 text-[0.75rem] text-[#e2e8f0] tracking-[0.04em] uppercase outline-none transition-colors duration-150 [font-family:inherit] focus:border-brand [&_option]:bg-[#0b0f19] [&_option]:text-[#e2e8f0]"
        :value="language"
        @change="onLanguageChange"
      >
        <option v-for="lang in supportedLanguages" :key="lang" :value="lang">
          {{ lang }}
        </option>
      </select>
      <span v-else class="code__language">{{ language }}</span>
      <span v-if="isEditable" class="code__export-language hidden">{{ language }}</span>
      <slot name="header" />
    </figcaption>
    <pre class="code__pre m-0 overflow-x-auto p-3.5"><code
      ref="element"
      class="code__content whitespace-pre-wrap outline-none [font:inherit] [overflow-wrap:anywhere]"
      :class="{
        'code__content--editable': isEditable,
        'code__content--locked cursor-not-allowed opacity-70': locked,
        'code__content--empty': isEmpty,
      }"
      :data-placeholder="placeholder"
      v-bind="attributes"
      @input="onInput"
      @focus="onFocus"
      @blur="onBlur"
      @keydown="onKeydown"
      @paste="onPaste"
    ><slot v-if="!editable">{{ code }}</slot></code></pre>
  </figure>
</template>

<script lang="ts">
export const supportedLanguages = [
  'plaintext',
  'javascript',
  'typescript',
  'python',
  'html',
  'css',
  'c',
  'cpp',
  'java',
  'sql',
  'json',
  'bash',
  'markdown',
  'go',
  'rust',
] as const
</script>

<script lang="ts" setup>
import { computed, ref } from 'vue'
import { useEditable } from '@/app/editor/useEditable'

const props = withDefaults(
  defineProps<{
    code?: string
    language?: string
    editable?: boolean
    locked?: boolean
    placeholder?: string
    typeface?: string
    color?: string
    bgColor?: string
    size?: string
  }>(),
  {
    code: '',
    language: 'plaintext',
    editable: false,
    locked: false,
    placeholder: '// code',
    typeface: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace",
    color: '#e2e8f0',
    bgColor: '#0b0f19',
    size: '.875rem',
  },
)

const emit = defineEmits<{
  'update:text': [value: string]
  'update:language': [value: string]
  focus: []
  blur: []
}>()

function onLanguageChange(e: Event) {
  const target = e.target as HTMLSelectElement
  emit('update:language', target.value)
}

const element = ref<HTMLElement | null>(null)
const isEditable = computed(() => props.editable && !props.locked)
const isEmpty = computed(() => isEditable.value && props.code.length === 0)

const { attributes, onInput, onFocus, onBlur, onKeydown, onPaste } = useEditable(
  element,
  () => props.code,
  () => isEditable.value,
  emit,
  { raw: true, multiline: true },
)

const style = computed(() => ({
  fontFamily: props.typeface,
  color: props.color,
  backgroundColor: props.bgColor,
  fontSize: props.size,
}))
</script>

<style scoped>
.code__content--editable.code__content--empty:not(:focus)::before {
  content: attr(data-placeholder);
  opacity: 0.5;
  pointer-events: none;
}
</style>
