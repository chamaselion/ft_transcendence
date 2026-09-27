<template>
  <component
    :is="ordered ? 'ol' : 'ul'"
    :ref="setElement"
    class="list"
    :class="{ 'list--editable': isEditable, 'list--locked': locked, 'list--empty': isEmpty }"
    :style="style"
    :data-placeholder="placeholder"
    v-bind="attributes"
    @input="onInput"
    @focus="onFocus"
    @blur="onBlur"
    @keydown="onKeydown"
  >
    <template v-if="!isEditable">
      <li v-for="(item, index) in items" :key="index" class="list__item">
        <slot name="item" :item="item" :index="index">{{ item }}</slot>
      </li>
    </template>
  </component>
</template>

<script lang="ts" setup>
import { computed, ref, type ComponentPublicInstance } from 'vue'
import { useEditable } from '@/app/editor/useEditable'

const props = withDefaults(
  defineProps<{
    items?: string[]
    text?: string
    ordered?: boolean
    marker?: string
    editable?: boolean
    locked?: boolean
    placeholder?: string
    typeface?: string
    color?: string
    bgColor?: string
    size?: string
  }>(),
  {
    items: () => [],
    text: '',
    ordered: false,
    marker: '',
    editable: false,
    locked: false,
    placeholder: 'List item',
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
const setElement = (el: Element | ComponentPublicInstance | null) => {
  element.value = el instanceof HTMLElement ? el : null
}

const isEditable = computed(() => props.editable && !props.locked)

const lines = computed(() => (props.text ? props.text.split('\n') : props.items))
const isEmpty = computed(() => isEditable.value && lines.value.join('').trim() === '')

const { attributes, onInput, onFocus, onBlur, onKeydown } = useEditable(
  element,
  () => lines.value.join('\n'),
  () => isEditable.value,
  emit,
  {
    multiline: true,
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

const style = computed(() => ({
  fontFamily: props.typeface,
  color: props.color,
  backgroundColor: props.bgColor,
  fontSize: props.size,
  listStyleType: props.marker || (props.ordered ? 'decimal' : 'disc'),
}))
</script>

<style lang="css" scoped>
.list {
  margin: 0;
  padding-left: 1.5em;
}

.list--editable {
  outline: none;
  border-radius: 4px;
}

.list--editable.list--empty:not(:focus)::before {
  content: attr(data-placeholder);
  color: var(--text-muted);
  pointer-events: none;
}

.list--locked {
  opacity: 0.7;
  cursor: not-allowed;
}

.list__item {
  line-height: 1.6;
}

.list__item + .list__item {
  margin-top: 4px;
}
</style>
