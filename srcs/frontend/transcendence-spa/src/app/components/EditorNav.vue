<template>
  <div
    ref="nav"
    class="editor-nav"
    :class="[
      `editor-nav--${position}`,
      { 'editor-nav--floating': floating },
    ]"
  >
    <div class="editor-nav__group">
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
    </div>

    <span class="editor-nav__divider" />

    <div class="editor-nav__group">
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
  </div>
</template>

<script lang="ts" setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import Button from '@/app/components/Button.vue'
import Icon, { type IconName } from '@/app/components/Icon.vue'
import { blockTypeLabels, blockTypes, type BlockType } from '@/app/editor/types'

withDefaults(
  defineProps<{
    activeBlockId?: string | null
    position?: 'top' | 'left' | 'bottom'
  }>(),
  {
    activeBlockId: null,
    position: 'top',
  },
)

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

const onScroll = () => {
  if (!nav.value) return
  floating.value = nav.value.getBoundingClientRect().top <= 20
}

onMounted(() => window.addEventListener('scroll', onScroll, { passive: true }))
onBeforeUnmount(() => window.removeEventListener('scroll', onScroll))
</script>

<style lang="css" scoped>
.editor-nav {
  position: sticky;
  z-index: 10;
  display: flex;
  align-items: center;
  padding: 6px 10px;
  border: 1px solid var(--border-subtle);
  border-radius: 10px;
  background-color: var(--bg-surface);
  box-shadow: var(--shadow-sm);
  transition:
    box-shadow 0.2s ease,
    border-color 0.2s ease,
    background-color 0.2s ease;
}

.editor-nav--top {
  top: 12px;
  flex-direction: row;
  justify-content: flex-start;
  width: 100%;
  margin-bottom: 8px;
}

.editor-nav--left {
  top: 16px;
  flex-direction: column;
  align-self: start;
}

.editor-nav--bottom {
  bottom: 12px;
  flex-direction: row;
  width: 100%;
  margin-top: 8px;
}

.editor-nav--floating {
  border-color: var(--border-subtle);
  box-shadow: var(--shadow-md);
}

.editor-nav__group {
  display: flex;
  align-items: center;
  gap: 4px;
}

.editor-nav--left .editor-nav__group {
  flex-direction: column;
}

.editor-nav__divider {
  background-color: var(--border-subtle);
}

.editor-nav--top .editor-nav__divider,
.editor-nav--bottom .editor-nav__divider {
  width: 1px;
  height: 22px;
  margin: 0 8px;
}

.editor-nav--left .editor-nav__divider {
  width: 100%;
  height: 1px;
  margin: 6px 0;
}

.editor-nav :deep(.btn) {
  margin: 0;
}
</style>
