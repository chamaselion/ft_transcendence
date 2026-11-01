<template>
  <div
    class="editor-block relative rounded-md border-[1px] border-x-transparent border-t-transparent px-3 py-1 transition-[background-color,border-color] duration-150"
    :class="{
      'editor-block--active border-l-brand bg-subtle': active && !readOnly,
      'editor-block--locked cursor-not-allowed border-2 border-l-2 border-danger bg-danger/[0.08] select-none [&_*]:pointer-events-none [&_*]:select-none':
        locked,
      'editor-block--elaborating cursor-progress border-l-warning bg-warning/[0.08] select-none [&_*]:pointer-events-none [&_*]:select-none':
        elaborating,
      'editor-block--translating cursor-progress opacity-70': translating && !locked,
    }"
    :data-block-id="block.id"
    @click="!readOnly && $emit('focus')"
  >
    <component
      :is="component"
      v-bind="componentProps"
      @update:text="!readOnly && $emit('update:text', $event)"
      @insert-blocks="!readOnly && $emit('insert-blocks', $event)"
      @update:language="!readOnly && onUpdateLanguage($event)"
      @update:content="!readOnly && onUpdateContent($event)"
      @update:data="!readOnly && onUpdateData($event)"
      @focus="!readOnly && $emit('focus')"
      @blur="$emit('blur')"
    />
    <FoldableTextPreview
      v-show="
        previewCanonical && isForeignLanguage && canonicalText && !elaborating && showsPreview
      "
      :text="canonicalText"
      :is-dirty="isDirty"
    />
    <span
      v-if="locked"
      class="editor-block__lock pointer-events-auto absolute top-1 right-2 rounded bg-danger px-2 py-0.5 text-[10px] font-bold tracking-[0.05em] text-danger-contrast uppercase shadow-[0_1px_3px_rgba(0,0,0,0.2)]"
      :title="$t('editor.lockedTitle')"
    >
      {{ $t('editor.lockedBadge') }}
    </span>
    <span
      v-else-if="elaborating"
      class="editor-block__elaborating pointer-events-auto absolute top-1 right-2 animate-pulse rounded bg-warning px-2 py-0.5 text-[10px] font-bold tracking-[0.05em] text-warning-contrast uppercase shadow-[0_1px_3px_rgba(0,0,0,0.2)]"
      :title="$t('editor.elaborate.triggerLoadingTitle')"
    >
      {{ $t('editor.elaborate.triggerLoading') }}
    </span>
    <span
      v-else-if="translating && active"
      class="editor-block__translating pointer-events-auto absolute top-1 right-2 animate-pulse rounded bg-warning px-2 py-0.5 text-[10px] font-bold tracking-[0.05em] text-warning-contrast uppercase shadow-[0_1px_3px_rgba(0,0,0,0.2)]"
      :title="$t('editor.translating')"
    >
      {{ $t('editor.translating') }}
    </span>
  </div>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import FoldableTextPreview from '@/app/components/FoldableTextPreview.vue'
import { getBlockDefinition, type BlockDefinition } from '@/app/blocks'
import {
  parseDecorator,
  serializeDecorator,
  showsCanonicalPreview,
  type Block,
  type BlockDecorator,
} from '@/app/editor/types'
import type { EditableInsertEvent } from '@/app/editor/useEditable'
import { useEditorStore } from '@/stores/editor'

const props = withDefaults(
  defineProps<{
    block: Block
    active?: boolean
    locked?: boolean
    elaborating?: boolean
    translating?: boolean
    exportMode?: boolean
    editable?: boolean
    previewCanonical?: boolean
  }>(),
  {
    previewCanonical: true,
  },
)

const { t } = useI18n()
const store = useEditorStore()
const readOnly = computed(
  () =>
    props.editable === false ||
    Boolean(props.locked) ||
    Boolean(props.elaborating) ||
    Boolean(props.translating),
)
const canonicalText = computed(() => store.getCanonicalText(props.block.id))
const isForeignLanguage = computed(() => store.activeLanguage !== 'en')
const isDirty = computed(() => store.isBlockDirty(props.block.id))

const emit = defineEmits<{
  'update:text': [value: string]
  'update:content': [value: { text: string; decorator: string }]
  'insert-blocks': [event: EditableInsertEvent]
  'update:decorator': [value: string]
  focus: []
  blur: []
}>()

const decorator = computed(() => parseDecorator(props.block.decorator))
const definition = computed<BlockDefinition>(
  () => getBlockDefinition(decorator.value.type) ?? getBlockDefinition('p')!,
)
const component = computed(() =>
  props.exportMode && definition.value.pdf?.component
    ? definition.value.pdf.component
    : definition.value.component,
)
const showsPreview = computed(() => showsCanonicalPreview(props.block.decorator))

const componentProps = computed(() => {
  const context = {
    block: props.block,
    decorator: decorator.value,
    editable: props.editable !== false,
    locked: readOnly.value,
    exportMode: Boolean(props.exportMode),
    t,
  }
  if (props.exportMode && definition.value.pdf?.props) {
    return definition.value.pdf.props(context)
  }
  return definition.value.props(context)
})

function onUpdateLanguage(language: string) {
  if (readOnly.value) return
  const updated = { ...decorator.value, language }
  emit('update:decorator', serializeDecorator(updated))
}

function onUpdateContent(payload: { text: string; checked?: boolean[] }) {
  if (readOnly.value) return
  emit('update:content', {
    text: payload.text,
    decorator: serializeDecorator({
      ...decorator.value,
      checked: Array.isArray(payload.checked) ? payload.checked : decorator.value.checked,
    } as BlockDecorator),
  })
}

function onUpdateData(payload: Record<string, unknown>) {
  if (readOnly.value) return
  emit('update:decorator', serializeDecorator({ ...decorator.value, ...payload }))
}
</script>
