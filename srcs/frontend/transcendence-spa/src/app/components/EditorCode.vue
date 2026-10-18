<template>
  <figure class="code" :style="style">
    <figcaption class="code__header">
      <select
        v-if="isEditable"
        class="code__language-select"
        :value="language"
        @change="onLanguageChange"
      >
        <option v-for="lang in supportedLanguages" :key="lang" :value="lang">
          {{ lang }}
        </option>
      </select>
      <span v-else class="code__language">{{ language }}</span>
      <span v-if="isEditable" class="code__export-language">{{ language }}</span>
      <slot name="header" />
    </figcaption>
    <pre class="code__pre"><code
      ref="element"
      class="code__content"
      :class="{
        'code__content--editable': isEditable,
        'code__content--locked': locked,
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

<style lang="css" scoped>
.code__export-language {
  display: none;
}

.code {
  margin: 0;
  border-radius: 8px;
  overflow-wrap: anywhere;
  overflow: hidden;
}

.code__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 14px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
  font-size: 0.75rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  opacity: 0.75;
}

.code__language-select {
  background: rgba(255, 255, 255, 0.08);
  color: #e2e8f0;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  padding: 2px 6px;
  font-size: 0.75rem;
  font-family: inherit;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  cursor: pointer;
  outline: none;
  transition: border-color 0.15s ease;
}

.code__language-select:focus {
  border-color: var(--color-primary, #3b82f6);
}

.code__language-select option {
  background-color: #0b0f19;
  color: #e2e8f0;
}

.code__pre {
  margin: 0;
  padding: 14px;
  overflow-x: auto;
}

.code__content {
  font-family: inherit;
  font-size: inherit;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  outline: none;
}

.code__content--editable.code__content--empty:not(:focus)::before {
  content: attr(data-placeholder);
  opacity: 0.5;
  pointer-events: none;
}

.code__content--locked {
  opacity: 0.7;
  cursor: not-allowed;
}
</style>
