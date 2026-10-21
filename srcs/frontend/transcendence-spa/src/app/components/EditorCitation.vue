<template>
  <blockquote class="citation flex gap-3.5 rounded-lg px-4 py-3.5 italic [margin:0]" :style="style">
    <span class="citation__stripe w-1 shrink-0 rounded-full" :style="{ backgroundColor: accent }" />
    <div class="citation__body min-w-0 flex-1">
      <div
        ref="element"
        class="citation__text rounded outline-none [overflow-wrap:anywhere]"
        :class="{
          'citation__text--editable': isEditable,
          'citation__text--locked cursor-not-allowed opacity-70': locked,
          'citation__text--empty': isEmpty,
        }"
        :data-placeholder="placeholder"
        v-bind="attributes"
        @input="onInput"
        @focus="onFocus"
        @blur="onBlur"
        @keydown="onKeydown"
        @paste="onPaste"
      >
        <slot v-if="!editable">{{ text }}</slot>
      </div>
      <footer
        v-if="source"
        class="citation__source mt-2 text-[0.85em] font-normal text-muted not-italic"
      >
        — {{ source }}
      </footer>
    </div>
  </blockquote>
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue'
import { useEditable } from '@/app/editor/useEditable'

const props = withDefaults(
  defineProps<{
    text?: string
    source?: string
    editable?: boolean
    locked?: boolean
    placeholder?: string
    typeface?: string
    color?: string
    bgColor?: string
    size?: string
    accent?: string
  }>(),
  {
    text: '',
    source: '',
    editable: false,
    locked: false,
    placeholder: 'Quote',
    typeface: 'inherit',
    color: 'var(--text-primary)',
    bgColor: 'var(--bg-subtle)',
    size: '1rem',
    accent: 'var(--color-primary)',
  },
)

const emit = defineEmits<{
  'update:text': [value: string]
  focus: []
  blur: []
}>()

const element = ref<HTMLElement | null>(null)
const isEditable = computed(() => props.editable && !props.locked)
const isEmpty = computed(() => isEditable.value && props.text.length === 0)

const { attributes, onInput, onFocus, onBlur, onKeydown, onPaste } = useEditable(
  element,
  () => props.text,
  () => isEditable.value,
  emit,
  { multiline: true },
)

const style = computed(() => ({
  fontFamily: props.typeface,
  color: props.color,
  backgroundColor: props.bgColor,
  fontSize: props.size,
}))
</script>

<style scoped>
.citation__text--editable.citation__text--empty:not(:focus)::before {
  content: attr(data-placeholder);
  color: var(--text-muted);
  pointer-events: none;
  font-style: normal;
}
</style>
