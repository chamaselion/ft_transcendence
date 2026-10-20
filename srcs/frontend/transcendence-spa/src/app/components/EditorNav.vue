<template>
  <div
    ref="nav"
    class="editor-nav"
    :class="[
      `editor-nav--${position}`,
      { 'editor-nav--floating': floating },
    ]"
  >
    <!-- When block is active: Specific formatting options for active block + Delete button on left side -->
    <template v-if="activeBlock && activeDecorator">
      <!-- Paragraph: Alignment (Left, Middle/Center, Right, Block/Justify) -->
      <div v-if="activeDecorator.type === 'p'" class="editor-nav__group editor-nav__group--formatting">
        <Button
          v-for="align in (['left', 'center', 'right', 'justify'] as const)"
          :key="align"
          :variant="(activeDecorator.align || 'left') === align ? 'elevated' : 'flat'"
          size="small"
          square
          :disabled="deleteDisabled"
          :title="`Align ${align === 'center' ? 'middle' : align === 'justify' ? 'block' : align}`"
          @click="$emit('update:decorator', { ...activeDecorator, align })"
        >
          <template #icon>
            <Icon :name="alignIcons[align]" :size="18" />
          </template>
        </Button>
      </div>

      <!-- Heading: Level 1 to 6 (Size) -->
      <div v-else-if="activeDecorator.type === 'h'" class="editor-nav__group editor-nav__group--formatting">
        <Button
          v-for="lvl in ([1, 2, 3, 4, 5, 6] as const)"
          :key="lvl"
          :variant="(activeDecorator.level ?? 2) === lvl ? 'elevated' : 'flat'"
          size="small"
          square
          :disabled="deleteDisabled"
          :title="`Heading ${lvl}`"
          @click="$emit('update:decorator', { ...activeDecorator, level: lvl })"
        >
          <template #icon>
            <Icon :name="(`H${lvl}` as IconName)" :size="18" />
          </template>
        </Button>
      </div>

      <!-- List: Numbered vs Unnumbered switcher -->
      <div v-else-if="activeDecorator.type === 'li'" class="editor-nav__group editor-nav__group--formatting">
        <Button
          :variant="!activeDecorator.ordered ? 'elevated' : 'flat'"
          size="small"
          square
          :disabled="deleteDisabled"
          title="Unnumbered list (bullets)"
          @click="$emit('update:decorator', { ...activeDecorator, ordered: false })"
        >
          <template #icon>
            <Icon name="List" :size="18" />
          </template>
        </Button>
        <Button
          :variant="activeDecorator.ordered ? 'elevated' : 'flat'"
          size="small"
          square
          :disabled="deleteDisabled"
          title="Numbered list"
          @click="$emit('update:decorator', { ...activeDecorator, ordered: true })"
        >
          <template #icon>
            <Icon name="ListNumbers" :size="18" />
          </template>
        </Button>
      </div>

      <!-- Code: Language selector -->
      <div v-else-if="activeDecorator.type === 'c'" class="editor-nav__group editor-nav__group--formatting">
        <span class="editor-nav__label">Lang:</span>
        <select
          class="editor-nav__select"
          :disabled="deleteDisabled"
          :value="activeDecorator.language || 'plaintext'"
          @change="onNavLanguageChange"
        >
          <option v-for="lang in supportedLanguages" :key="lang" :value="lang">
            {{ lang }}
          </option>
        </select>
      </div>

      <span v-if="activeDecorator.type !== 'cit'" class="editor-nav__divider" />

      <!-- Delete active block button -->
      <div class="editor-nav__group">
        <Button
          variant="outlined"
          color="alert"
          size="small"
          square
          title="Delete active block"
          :disabled="!activeBlockId || deleteDisabled"
          @click="$emit('delete')"
        >
          <template #icon>
            <Icon name="Trash" :size="18" />
          </template>
        </Button>
      </div>
    </template>

    <!-- Add block buttons (pushed to right side when block is active, or aligned to left when no block active) -->
    <div
      class="editor-nav__group editor-nav__group--add"
      :class="{ 'editor-nav__group--pushed': Boolean(activeBlock && activeDecorator) }"
    >
      <span v-if="activeBlock && activeDecorator" class="editor-nav__divider" />
      <span v-else class="editor-nav__label">Add:</span>
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
  </div>
</template>

<script lang="ts" setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import Button from '@/app/components/Button.vue'
import Icon, { type IconName } from '@/app/components/Icon.vue'
import {
  blockTypeLabels,
  blockTypes,
  parseDecorator,
  type Block,
  type BlockDecorator,
  type BlockType,
  type ParagraphAlignment,
} from '@/app/editor/types'
import { supportedLanguages } from '@/app/components/EditorCode.vue'

const props = withDefaults(
  defineProps<{
    activeBlockId?: string | null
    activeBlock?: Block | null
    deleteDisabled?: boolean
    position?: 'top' | 'left' | 'bottom'
  }>(),
  {
    activeBlockId: null,
    activeBlock: null,
    deleteDisabled: false,
    position: 'top',
  },
)

const emit = defineEmits<{
  add: [type: BlockType]
  delete: []
  'update:decorator': [decorator: BlockDecorator]
}>()

const activeDecorator = computed(() =>
  props.activeBlock ? parseDecorator(props.activeBlock.decorator) : null,
)

const typeIcons: Record<BlockType, IconName> = {
  p: 'Paragraph',
  li: 'List',
  h: 'H1',
  cit: 'Quote',
  c: 'Code',
}

const alignIcons: Record<ParagraphAlignment, IconName> = {
  left: 'AlignLeft',
  center: 'AlignCenter',
  right: 'AlignRight',
  justify: 'AlignJustified',
}

function onNavLanguageChange(e: Event) {
  if (!activeDecorator.value) return
  const target = e.target as HTMLSelectElement
  emit('update:decorator', { ...activeDecorator.value, language: target.value })
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
  background-color: color-mix(in srgb, var(--bg-header) 88%, transparent);
  box-shadow: var(--shadow-sm);
  transition:
    box-shadow 0.2s ease,
    border-color 0.2s ease,
    background-color 0.2s ease;
}

.editor-nav--top {
  top: calc(var(--header-height) + 5px);
  flex-direction: row;
  justify-content: flex-start;
  width: auto;
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
  width: auto;
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

.editor-nav--top .editor-nav__group--pushed,
.editor-nav--bottom .editor-nav__group--pushed {
  margin-left: auto;
}

.editor-nav--left .editor-nav__group--pushed {
  margin-top: auto;
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

.editor-nav__label {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-muted, #94a3b8);
  margin-right: 2px;
}

.editor-nav__select {
  background-color: var(--bg-surface);
  color: var(--text-primary);
  border: 1px solid var(--border-default);
  border-radius: 6px;
  padding: 3px 6px;
  font-size: 0.75rem;
  font-weight: 500;
  outline: none;
  cursor: pointer;
  transition: border-color 0.15s ease;
}

.editor-nav__select option {
  background-color: var(--bg-surface);
  color: var(--text-primary);
}

.editor-nav__select:focus {
  border-color: var(--color-primary, #3b82f6);
}

.editor-nav__select:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
