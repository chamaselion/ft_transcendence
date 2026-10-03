<template>
  <p
    ref="element"
    class="paragraph"
    :class="{
      'paragraph--editable': isEditable,
      'paragraph--locked': locked,
      'paragraph--empty': isEmpty,
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
  </p>
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue'
import { useEditable } from '@/app/editor/useEditable'

const props = withDefaults(
  defineProps<{
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
    text: '',
    editable: false,
    locked: false,
    placeholder: 'Write something…',
    typeface: 'inherit',
    color: 'var(--text-primary)',
    bgColor: 'transparent',
    size: '1rem',
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
)

const style = computed(() => ({
  fontFamily: props.typeface,
  color: props.color,
  backgroundColor: props.bgColor,
  fontSize: props.size,
}))
</script>

<style lang="css" scoped>
.paragraph {
  margin: 0 0 1em;
  line-height: 1.6;
}

.paragraph--editable {
  outline: none;
  border-radius: 4px;
}

.paragraph--editable.paragraph--empty:not(:focus)::before {
  content: attr(data-placeholder);
  color: var(--text-muted);
  pointer-events: none;
}

.paragraph--locked {
  opacity: 0.7;
  cursor: not-allowed;
}
</style>
