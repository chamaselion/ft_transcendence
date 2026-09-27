<template>
  <div ref="nav" class="editor-nav" :class="{ 'editor-nav--floating': floating }">
    <Button
      v-for="type in blockTypes"
      :key="type"
      variant="flat"
      size="small"
      square
      :title="`Add ${blockTypeLabels[type]}`"
      @click="$emit('add', type)"
    >
      <template #icon>
        <Icon :name="typeIcons[type]" :size="18" />
      </template>
    </Button>

    <span class="editor-nav__divider" />

    <Button
      variant="outlined"
      color="alert"
      size="small"
      square
      title="Delete active block"
      :disabled="!activeBlockId"
      @click="$emit('delete')"
    >
      <template #icon>
        <Icon name="Trash" :size="18" />
      </template>
    </Button>
  </div>
</template>

<script lang="ts" setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import Button from '@/app/components/Button.vue'
import Icon, { type IconName } from '@/app/components/Icon.vue'
import { blockTypeLabels, blockTypes, type BlockType } from '@/app/editor/types'

defineProps<{ activeBlockId?: string | null }>()

defineEmits<{
  add: [type: BlockType]
  delete: []
}>()

const typeIcons: Record<BlockType, IconName> = {
  p: 'Paragraph',
  li: 'List',
  h: 'H1',
  cit: 'Quote',
  c: 'Code',
}

const nav = ref<HTMLElement | null>(null)
const floating = ref(false)

// `position: sticky` keeps the toolbar on screen; the scroll listener only adds
// a lifted look once the toolbar has actually stuck to the viewport edge.
const onScroll = () => {
  if (!nav.value) return
  floating.value = nav.value.getBoundingClientRect().top <= 24
}

onMounted(() => window.addEventListener('scroll', onScroll, { passive: true }))
onBeforeUnmount(() => window.removeEventListener('scroll', onScroll))
</script>

<style lang="css" scoped>
.editor-nav {
  position: sticky;
  top: 16px;
  z-index: 10;
  display: flex;
  flex-direction: column;
  align-self: start;
  gap: 6px;
  padding: 6px;
  border: 1px solid transparent;
  border-radius: 10px;
  background-color: var(--bg-surface);
  box-shadow: var(--shadow-sm);
  transition:
    box-shadow 0.2s ease,
    border-color 0.2s ease,
    background-color 0.2s ease;
}

.editor-nav--floating {
  border-color: var(--border-subtle);
  box-shadow: var(--shadow-md);
}

.editor-nav__divider {
  height: 1px;
  margin: 2px 4px;
  background-color: var(--border-subtle);
}

.editor-nav :deep(.btn) {
  margin: 0;
}
</style>
