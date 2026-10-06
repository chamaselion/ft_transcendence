<template>
  <blockquote class="citation" :style="style">
    <span class="citation__stripe" :style="{ backgroundColor: accent }" />
    <div class="citation__body">
      <div
        ref="element"
        class="citation__text"
        :class="{
          'citation__text--editable': isEditable,
          'citation__text--locked': locked,
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
      <footer v-if="source" class="citation__source">— {{ source }}</footer>
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

<style lang="css" scoped>
.citation {
  display: flex;
  gap: 14px;
  margin: 0;
  padding: 14px 16px;
  border-radius: 8px;
  font-style: italic;
}

.citation__stripe {
  flex-shrink: 0;
  width: 4px;
  border-radius: 999px;
}

.citation__body {
  flex: 1;
}

.citation__text {
  outline: none;
  border-radius: 4px;
}

.citation__text--editable.citation__text--empty:not(:focus)::before {
  content: attr(data-placeholder);
  color: var(--text-muted);
  pointer-events: none;
  font-style: normal;
}

.citation__text--locked {
  opacity: 0.7;
  cursor: not-allowed;
}

.citation__source {
  margin-top: 8px;
  color: var(--text-muted);
  font-size: 0.85em;
  font-style: normal;
}
</style>
