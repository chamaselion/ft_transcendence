<template>
  <div
    class="editor-block relative rounded-md border-l-[3px] border-l-transparent px-3 py-1 transition-[background-color,border-color] duration-150"
    :class="{
      'editor-block--active border-l-brand bg-subtle': active && !readOnly,
      'editor-block--locked cursor-not-allowed border-2 border-l-2 border-danger bg-danger/[0.08] select-none [&_*]:pointer-events-none [&_*]:select-none':
        locked,
      'editor-block--elaborating cursor-progress border-l-warning bg-warning/[0.08] select-none [&_*]:pointer-events-none [&_*]:select-none':
        elaborating,
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
      @focus="!readOnly && $emit('focus')"
      @blur="$emit('blur')"
    />
    <FoldableTextPreview
      v-if="
        isForeignLanguage &&
        canonicalText &&
        !elaborating &&
        decorator.type !== 'c' &&
        decorator.type !== 'cit'
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
import { computed, type Component } from 'vue'
import { useI18n } from 'vue-i18n'
import EditorParagraph from '@/app/components/EditorParagraph.vue'
import EditorHeading from '@/app/components/EditorHeading.vue'
import EditorList from '@/app/components/EditorList.vue'
import EditorCitation from '@/app/components/EditorCitation.vue'
import EditorCode from '@/app/components/EditorCode.vue'
import FoldableTextPreview from '@/app/components/FoldableTextPreview.vue'
import { parseDecorator, serializeDecorator, type Block, type BlockType } from '@/app/editor/types'
import type { EditableInsertEvent } from '@/app/editor/useEditable'
import { useEditorStore } from '@/stores/editor'

const props = defineProps<{
  block: Block
  active?: boolean
  locked?: boolean
  elaborating?: boolean
  translating?: boolean
  exportMode?: boolean
}>()

const { t } = useI18n()
const store = useEditorStore()
const readOnly = computed(
  () => Boolean(props.locked) || Boolean(props.elaborating) || Boolean(props.translating),
)
const canonicalText = computed(() => store.getCanonicalText(props.block.id))
const isForeignLanguage = computed(() => store.activeLanguage !== 'en')
const isDirty = computed(() => store.isBlockDirty(props.block.id))

const emit = defineEmits<{
  'update:text': [value: string]
  'insert-blocks': [event: EditableInsertEvent]
  'update:decorator': [value: string]
  focus: []
  blur: []
}>()

const componentMap: Record<BlockType, Component> = {
  p: EditorParagraph,
  h: EditorHeading,
  li: EditorList,
  cit: EditorCitation,
  c: EditorCode,
}

const decorator = computed(() => parseDecorator(props.block.decorator))
const component = computed(() => componentMap[decorator.value.type])

function onUpdateLanguage(language: string) {
  if (readOnly.value) return
  const updated = { ...decorator.value, language }
  emit('update:decorator', serializeDecorator(updated))
}

const componentProps = computed(() => {
  const decoratorValue = decorator.value
  const base = { editable: true, locked: readOnly.value }

  switch (decoratorValue.type) {
    case 'h':
      return {
        ...base,
        text: props.block.text,
        level: decoratorValue.level ?? 2,
        placeholder: t('editor.placeholder.h'),
      }
    case 'li':
      return {
        ...base,
        text: props.block.text,
        ordered: decoratorValue.ordered,
        marker: decoratorValue.marker,
        exportMode: props.exportMode,
      }
    case 'cit':
      return {
        ...base,
        text: props.block.text,
        source: decoratorValue.source,
        placeholder: t('editor.placeholder.cit'),
      }
    case 'c':
      return {
        ...base,
        code: props.block.text,
        language: decoratorValue.language,
        placeholder: t('editor.placeholder.c'),
      }
    case 'p':
    default:
      return {
        ...base,
        text: props.block.text,
        align: decoratorValue.align || 'left',
        placeholder: t('editor.placeholder.p'),
      }
  }
})
</script>
