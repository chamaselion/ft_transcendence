<template>
  <component
    :is="tag"
    :ref="setElement"
    class="heading"
    :class="{
      'heading--editable': isEditable,
      'heading--locked': locked,
      'heading--empty': isEmpty,
    }"
    :style="style"
    :data-placeholder="placeholder"
    v-bind="attributes"
    @input="onInput"
    @focus="onFocus"
    @blur="onBlur"
    @keydown="onKeydown"
    @paste="onPaste"
  >
    <slot v-if="!editable">{{ text }}</slot>
  </component>
</template>

<script lang="ts" setup>
import { computed, ref, type ComponentPublicInstance } from 'vue'
import { useEditable, type EditableInsertEvent } from '@/app/editor/useEditable'

const props = withDefaults(
  defineProps<{
    level?: 1 | 2 | 3 | 4 | 5 | 6
    text?: string
    editable?: boolean
    locked?: boolean
    placeholder?: string
    typeface?: string
    color?: string
    bgColor?: string
    size?: string
  }>(),
  {
    level: 1,
    text: '',
    editable: false,
    locked: false,
    placeholder: 'Heading',
    typeface: 'inherit',
    color: 'var(--text-primary)',
    bgColor: 'transparent',
    size: '',
  },
)

const emit = defineEmits<{
  'update:text': [value: string]
  'insert-blocks': [event: EditableInsertEvent]
  focus: []
  blur: []
}>()

const element = ref<HTMLElement | null>(null)
const setElement = (el: Element | ComponentPublicInstance | null) => {
  element.value = el instanceof HTMLElement ? el : null
}

const tag = computed(() => `h${props.level}`)
const isEditable = computed(() => props.editable && !props.locked)
const isEmpty = computed(() => isEditable.value && props.text.length === 0)

const { attributes, onInput, onFocus, onBlur, onKeydown, onPaste } = useEditable(
  element,
  () => props.text,
  () => isEditable.value,
  emit,
)

const style = computed(() => ({
  fontFamily: props.typeface,
  color: props.color,
  backgroundColor: props.bgColor,
  fontSize: props.size || undefined,
}))
</script>

<style lang="css" scoped>
.heading {
  margin: 0 0 0.5em;
  font-weight: 700;
  line-height: 1.25;
}

.heading--editable {
  outline: none;
  border-radius: 4px;
}

.heading--editable.heading--empty:not(:focus)::before {
  content: attr(data-placeholder);
  color: var(--text-muted);
  pointer-events: none;
}

.heading--locked {
  opacity: 0.7;
  cursor: not-allowed;
}

h1.heading {
  font-size: 2rem;
}
h2.heading {
  font-size: 1.6rem;
}
h3.heading {
  font-size: 1.35rem;
}
h4.heading {
  font-size: 1.15rem;
}
h5.heading {
  font-size: 1rem;
}
h6.heading {
  font-size: 0.875rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
</style>
