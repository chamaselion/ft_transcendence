<!-- eslint-disable vue/multi-word-component-names -->
<template>
  <div
    class="math-block flex flex-col gap-2 rounded-md"
    :class="{ 'math-block--locked cursor-not-allowed opacity-70': locked }"
  >
    <textarea
      v-if="isEditable"
      :value="latex"
      class="math-block__input min-h-[64px] w-full resize-y rounded-md border border-line-subtle bg-surface p-2 font-mono text-sm text-ink outline-none focus:border-brand"
      :placeholder="placeholder"
      spellcheck="false"
      @input="onInput"
      @focus="$emit('focus')"
      @blur="$emit('blur')"
    />
    <div
      v-if="latex.trim()"
      class="math-block__preview overflow-x-auto rounded-md border border-line-subtle bg-subtle/40 px-3 py-2 text-ink"
      :class="{ 'text-center': displayMode === 'block' }"
      v-html="rendered"
    />
    <p v-else-if="!isEditable" class="m-0 py-2 text-sm text-muted italic">
      {{ $t('editor.math.empty') }}
    </p>
  </div>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import katex from 'katex'
import 'katex/dist/katex.min.css'

const props = withDefaults(
  defineProps<{
    latex?: string
    displayMode?: 'inline' | 'block'
    editable?: boolean
    locked?: boolean
    placeholder?: string
  }>(),
  {
    latex: '',
    displayMode: 'block',
    editable: false,
    locked: false,
    placeholder: 'E = mc^2',
  },
)

const emit = defineEmits<{
  'update:text': [value: string]
  focus: []
  blur: []
}>()

const isEditable = computed(() => props.editable && !props.locked)

const rendered = computed(() => {
  try {
    return katex.renderToString(props.latex, {
      displayMode: props.displayMode === 'block',
      throwOnError: false,
      strict: false,
      trust: false,
    })
  } catch {
    return `<span class="text-danger">${props.latex}</span>`
  }
})

function onInput(event: Event) {
  const target = event.target as HTMLTextAreaElement
  emit('update:text', target.value)
}
</script>
