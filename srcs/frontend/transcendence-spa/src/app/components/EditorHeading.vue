<template>
  <component
    :is="tag"
    :ref="setElement"
    class="heading font-bold leading-[1.25] [margin:0_0_0.5em]"
    :class="[
      levelClass,
      {
        'heading--editable rounded outline-none': isEditable,
        'heading--locked cursor-not-allowed opacity-70': locked,
        'heading--empty': isEmpty,
      },
    ]"
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

const levelClass = computed(
  () =>
    ({
      1: 'text-[2rem]',
      2: 'text-[1.6rem]',
      3: 'text-[1.35rem]',
      4: 'text-[1.15rem]',
      5: 'text-[1rem]',
      6: 'text-[0.875rem] uppercase tracking-[0.05em]',
    })[props.level],
)

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

<style scoped>
.heading--editable.heading--empty:not(:focus)::before {
  content: attr(data-placeholder);
  color: var(--text-muted);
  pointer-events: none;
}
</style>
