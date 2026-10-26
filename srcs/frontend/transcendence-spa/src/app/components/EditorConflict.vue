<template>
  <section
    class="conflict rounded-lg border-2 border-danger bg-danger/[0.12] p-3"
    :data-block-id="block.id"
  >
    <header class="mb-3 flex flex-wrap items-center justify-between gap-2">
      <span class="text-[0.7rem] font-bold tracking-[0.08em] text-danger uppercase">
        {{ $t('editor.conflict.title') }}
      </span>
      <span class="text-xs text-ink-secondary">
        {{ $t(`editor.conflict.kinds.${conflict.kind}`) }}
      </span>
    </header>

    <div class="grid gap-3 md:grid-cols-2">
      <div class="conflict__pane rounded-md border border-danger/40 bg-surface/80 p-2">
        <div class="mb-1 flex items-center justify-between gap-2">
          <span class="text-xs font-semibold text-ink-secondary">
            {{ $t('editor.conflict.localLabel') }}
          </span>
          <span v-if="!canEditLocal" class="text-[0.7rem] font-semibold text-danger">
            {{ $t('editor.conflict.deleted') }}
          </span>
        </div>
        <EditorBlock
          v-if="localBlock"
          :block="localBlock"
          :editable="editable"
          :preview-canonical="false"
          @update:text="$emit('update-local', { text: $event })"
          @update:decorator="$emit('update-local', { decorator: $event })"
        />
        <p v-else class="m-0 px-2 py-3 text-sm text-muted italic">
          {{ $t('editor.conflict.deletedLocally') }}
        </p>
      </div>

      <div class="conflict__pane rounded-md border border-line-subtle bg-subtle/80 p-2">
        <div class="mb-1 flex items-center justify-between gap-2">
          <span class="text-xs font-semibold text-ink-secondary">
            {{ $t('editor.conflict.remoteLabel') }}
          </span>
          <span v-if="!remoteBlock" class="text-[0.7rem] font-semibold text-danger">
            {{ $t('editor.conflict.deleted') }}
          </span>
        </div>
        <EditorBlock
          v-if="remoteBlock"
          :block="remoteBlock"
          :editable="false"
          :preview-canonical="false"
        />
        <p v-else class="m-0 px-2 py-3 text-sm text-muted italic">
          {{ $t('editor.conflict.deletedRemotely') }}
        </p>
      </div>
    </div>

    <div class="mt-3 flex flex-wrap justify-end gap-2">
      <Button variant="outlined" size="small" :disabled="!editable" @click="$emit('resolve-local')">
        {{ localActionLabel }}
      </Button>
      <Button
        variant="flat"
        size="small"
        color="danger"
        :disabled="!editable"
        @click="$emit('resolve-remote')"
      >
        {{ remoteActionLabel }}
      </Button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import EditorBlock from '@/app/components/EditorBlock.vue'
import Button from '@/app/components/Button.vue'
import type { Block } from '@/app/editor/types'
import type { BlockConflict } from '@/app/editor/merge'

const props = defineProps<{
  block: Block
  conflict: BlockConflict
  editable: boolean
}>()

defineEmits<{
  'update-local': [value: { text?: string; decorator?: string }]
  'resolve-local': []
  'resolve-remote': []
}>()

const { t } = useI18n()

const localBlock = computed<Block | null>(() => {
  if (!props.conflict.local) return null
  return {
    id: props.block.id,
    text: props.block.text,
    decorator: props.block.decorator,
    lockedBy: null,
  }
})

const remoteBlock = computed<Block | null>(() => {
  if (!props.conflict.remote) return null
  return {
    id: props.block.id,
    text: props.conflict.remote.text,
    decorator: props.conflict.remote.decorator,
    lockedBy: null,
  }
})

const canEditLocal = computed(() => props.conflict.local !== null)
const localActionLabel = computed(() =>
  props.conflict.local ? t('editor.conflict.keepLocal') : t('editor.conflict.keepDeletion'),
)
const remoteActionLabel = computed(() =>
  props.conflict.remote ? t('editor.conflict.useRemote') : t('editor.conflict.acceptDeletion'),
)
</script>
