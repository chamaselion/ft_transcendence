<template>
  <div
    class="editor-nav sticky z-10 flex min-w-0 max-w-full shrink-0 items-center rounded-[10px] border border-line-subtle bg-surface px-2.5 py-1.5 shadow-[var(--shadow-sm)]"
    :class="positionClass"
  >
    <div
      class="editor-nav__group flex flex-wrap items-center gap-1"
      :class="{ 'flex-col': position === 'left' }"
    >
      <Button
        v-for="type in blockTypes"
        :key="type"
        variant="flat"
        size="small"
        square
        :title="$t('editor.addBlock', { type: blockTypeLabel(type) })"
        @click="$emit('add', type)"
      >
        <template #icon>
          <Icon :name="typeIcons[type]" :size="18" />
        </template>
      </Button>
    </div>

    <template v-if="activeBlock && activeDecorator">
      <span
        class="editor-nav__divider"
        :class="[dividerClass, position === 'left' ? '' : 'max-sm:hidden']"
      />

      <div
        v-if="activeDecorator.type === 'p'"
        class="editor-nav__group editor-nav__group--formatting flex flex-wrap items-center gap-1"
        :class="{ 'flex-col': position === 'left' }"
      >
        <Button
          v-for="align in ['left', 'center', 'right', 'justify'] as const"
          :key="align"
          :variant="(activeDecorator.align || 'left') === align ? 'elevated' : 'flat'"
          size="small"
          square
          :disabled="deleteDisabled"
          :title="$t(alignTitleKeys[align])"
          @click="$emit('update:decorator', { ...activeDecorator, align })"
        >
          <template #icon>
            <Icon :name="alignIcons[align]" :size="18" />
          </template>
        </Button>
        <span class="editor-nav__divider" :class="dividerClass" />
        <EditorElaborateDropdown
          :disabled="deleteDisabled || isElaborating"
          :loading="isElaborating"
          @select="$emit('elaborate', $event)"
        />
      </div>

      <div
        v-else-if="activeDecorator.type === 'h'"
        class="editor-nav__group editor-nav__group--formatting flex flex-wrap items-center gap-1"
        :class="{ 'flex-col': position === 'left' }"
      >
        <Button
          v-for="lvl in [1, 2, 3, 4, 5, 6] as const"
          :key="lvl"
          :variant="(activeDecorator.level ?? 2) === lvl ? 'elevated' : 'flat'"
          size="small"
          square
          :disabled="deleteDisabled"
          :title="$t('editor.headingLevel', { level: lvl })"
          @click="$emit('update:decorator', { ...activeDecorator, level: lvl })"
        >
          <template #icon>
            <Icon :name="`H${lvl}` as IconName" :size="18" />
          </template>
        </Button>
      </div>

      <div
        v-else-if="activeDecorator.type === 'li'"
        class="editor-nav__group editor-nav__group--formatting flex flex-wrap items-center gap-1"
        :class="{ 'flex-col': position === 'left' }"
      >
        <Button
          :variant="!activeDecorator.ordered ? 'elevated' : 'flat'"
          size="small"
          square
          :disabled="deleteDisabled"
          :title="$t('editor.listUnnumbered')"
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
          :title="$t('editor.listNumbered')"
          @click="$emit('update:decorator', { ...activeDecorator, ordered: true })"
        >
          <template #icon>
            <Icon name="ListNumbers" :size="18" />
          </template>
        </Button>
      </div>

      <div
        v-else-if="activeDecorator.type === 'c'"
        class="editor-nav__group editor-nav__group--formatting flex flex-wrap items-center gap-1"
        :class="{ 'flex-col': position === 'left' }"
      >
        <span class="editor-nav__label mr-0.5 text-[0.75rem] font-semibold text-muted">{{
          $t('editor.languageLabel')
        }}</span>
        <select
          class="editor-nav__select cursor-pointer rounded-md border border-line-subtle bg-surface px-1.5 py-[3px] text-[0.75rem] font-medium text-ink outline-none transition-colors duration-150 focus:border-brand disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="deleteDisabled"
          :value="activeDecorator.language || 'plaintext'"
          @change="onNavLanguageChange"
        >
          <option v-for="lang in supportedLanguages" :key="lang" :value="lang">
            {{ lang }}
          </option>
        </select>
      </div>

      <span
        v-if="activeDecorator.type !== 'cit'"
        class="editor-nav__divider"
        :class="position === 'left' ? '' : 'max-sm:hidden'"
      />

      <!-- Delete active block button -->
      <div class="editor-nav__group flex flex-wrap items-center gap-1">
        <Button
          variant="outlined"
          color="alert"
          size="small"
          square
          :title="$t('editor.deleteBlock')"
          :disabled="!activeBlockId || deleteDisabled"
          @click="$emit('delete')"
        >
          <template #icon>
            <Icon name="Trash" :size="18" />
          </template>
        </Button>
      </div>
    </template>
  </div>
</template>

<script lang="ts" setup>
import { useI18n } from 'vue-i18n'
import { computed } from 'vue'
import Button from '@/app/components/Button.vue'
import Icon, { type IconName } from '@/app/components/Icon.vue'
import {
  blockTypes,
  parseDecorator,
  type Block,
  type BlockDecorator,
  type BlockType,
  type ParagraphAlignment,
} from '@/app/editor/types'
import { supportedLanguages } from '@/app/components/EditorCode.vue'
import EditorElaborateDropdown from '@/app/components/EditorElaborateDropdown.vue'
import type { PersonaKey } from '@/app/editor/elaboration.api'

const props = withDefaults(
  defineProps<{
    activeBlockId?: string | null
    activeBlock?: Block | null
    deleteDisabled?: boolean
    isElaborating?: boolean
    position?: 'top' | 'left' | 'bottom'
  }>(),
  {
    activeBlockId: null,
    activeBlock: null,
    deleteDisabled: false,
    isElaborating: false,
    position: 'top',
  },
)

const emit = defineEmits<{
  add: [type: BlockType]
  delete: []
  elaborate: [personaKey: PersonaKey]
  'update:decorator': [decorator: BlockDecorator]
}>()

const { t } = useI18n()

const blockTypeKeys = {
  p: 'editor.blockType.p',
  li: 'editor.blockType.li',
  h: 'editor.blockType.h',
  cit: 'editor.blockType.cit',
  c: 'editor.blockType.c',
} as const

const blockTypeLabel = (type: BlockType) => t(blockTypeKeys[type])

const alignTitleKeys = {
  left: 'editor.alignLeft',
  center: 'editor.alignCenter',
  right: 'editor.alignRight',
  justify: 'editor.alignJustify',
} as const

const activeDecorator = computed(() =>
  props.activeBlock ? parseDecorator(props.activeBlock.decorator) : null,
)

const positionClass = computed(
  () =>
    ({
      top: 'top-0 mb-2 w-full flex-row flex-wrap justify-start gap-1 gap-y-1.5',
      left: 'top-0 flex-col self-start',
      bottom: 'bottom-0 mt-2 w-full flex-row flex-wrap gap-1 gap-y-1.5',
    })[props.position],
)

const dividerClass = computed(() =>
  props.position === 'left'
    ? 'my-1.5 h-px w-full bg-line-subtle'
    : 'mx-2 h-[22px] w-px bg-line-subtle',
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
</script>
<style scoped>
.editor-nav :deep(.btn) {
  flex-shrink: 0;
}

@media (max-width: 639px) {
  .editor-nav {
    padding: 4px 6px;
  }

  .editor-nav :deep(.btn) {
    padding: 4px;
  }

  .editor-nav__select {
    padding: 2px 4px;
    font-size: 0.7rem;
  }
}
</style>
