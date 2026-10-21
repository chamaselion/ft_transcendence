<template>
  <component v-if="exportMode" :is="ordered ? 'ol' : 'ul'" class="list list--export" :style="style">
    <li v-for="(item, index) in lines" :key="index" class="list__item">
      <span class="list__marker" aria-hidden="true">{{ markerLabel(index) }}</span
      >{{ item }}
    </li>
  </component>

  <component
    v-else
    :is="ordered ? 'ol' : 'ul'"
    :ref="setElement"
    class="list space-y-1 pl-[1.5em] leading-relaxed [margin:0]"
    :class="{
      'list--editable rounded outline-none': isEditable,
      'list--locked cursor-not-allowed opacity-70': locked,
      'list--empty': isEmpty,
    }"
    :style="style"
    v-bind="attributes"
    @input="onInput"
    @focus="onFocus"
    @blur="onBlur"
    @keydown="handleKeydown"
    @paste="onPaste"
  >
    <template v-if="!editable">
      <li v-for="(item, index) in items" :key="index" class="list__item">
        <slot name="item" :item="item" :index="index">{{ item }}</slot>
      </li>
    </template>
  </component>
</template>

<script lang="ts" setup>
import { computed, ref, type ComponentPublicInstance } from 'vue'
import { useEditable, type EditableInsertEvent } from '@/app/editor/useEditable'

const props = withDefaults(
  defineProps<{
    items?: string[]
    text?: string
    ordered?: boolean
    marker?: string
    editable?: boolean
    locked?: boolean
    typeface?: string
    color?: string
    bgColor?: string
    size?: string
    exportMode?: boolean
  }>(),
  {
    items: () => [],
    text: '',
    ordered: false,
    marker: '',
    editable: false,
    locked: false,
    typeface: 'inherit',
    color: 'var(--text-primary)',
    bgColor: 'transparent',
    size: '1rem',
    exportMode: false,
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

const isEditable = computed(() => props.editable && !props.locked)

const lines = computed(() => (props.text ? props.text.split('\n') : props.items))
const isEmpty = computed(() => isEditable.value && lines.value.join('').trim() === '')

const { attributes, onInput, onFocus, onBlur, onKeydown, onPaste } = useEditable(
  element,
  () => lines.value.join('\n'),
  () => isEditable.value,
  emit,
  {
    multiline: true,
    pasteMode: 'list',
    write: (el, text) => {
      el.replaceChildren()
      text.split('\n').forEach((line) => {
        const item = document.createElement('li')
        item.textContent = line
        el.appendChild(item)
      })
    },
    read: (el) => {
      const items = Array.from(el.querySelectorAll('li')).map((item) => item.innerText)
      return items.length ? items.join('\n') : el.innerText
    },
  },
)

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Backspace' || event.key === 'Delete') {
    const el = element.value
    const items = el ? Array.from(el.querySelectorAll('li')) : []
    const onlyEmptyItem = items.length <= 1 && items.every((item) => item.innerText.trim() === '')

    if (onlyEmptyItem) {
      event.preventDefault()
      return
    }
  }

  onKeydown(event)
}

const style = computed(() => ({
  fontFamily: props.typeface,
  color: props.color,
  backgroundColor: props.bgColor,
  fontSize: props.size,
  listStyleType: props.exportMode ? 'none' : props.marker || (props.ordered ? 'decimal' : 'disc'),
}))

function markerLabel(index: number): string {
  if (props.ordered) return `${index + 1}.`
  if (props.marker === 'circle') return '◦'
  if (props.marker === 'square') return '▪'
  return '•'
}
</script>
