<script lang="ts">
export const iconNames = [
  'H1',
  'Sparkles',
  'Pencil',
  'PencilPlus',
  'Trash',
  'LetterCase',
  'AdjustmentsHorizontal',
  'Eye',
  'Paragraph',
  'List',
  'Quote',
  'Code',
] as const

export type IconName = (typeof iconNames)[number]
</script>

<script setup lang="ts">
import { computed, type Component } from 'vue'
import {
  IconH1,
  IconSparkles,
  IconPencil,
  IconPencilPlus,
  IconTrash,
  IconLetterCase,
  IconAdjustmentsHorizontal,
  IconEye,
  IconAlignLeft,
  IconList,
  IconQuote,
  IconCode,
} from '@tabler/icons-vue'

const iconMap: Record<IconName, Component> = {
  H1: IconH1,
  Sparkles: IconSparkles,
  Pencil: IconPencil,
  PencilPlus: IconPencilPlus,
  Trash: IconTrash,
  LetterCase: IconLetterCase,
  AdjustmentsHorizontal: IconAdjustmentsHorizontal,
  Eye: IconEye,
  Paragraph: IconAlignLeft,
  List: IconList,
  Quote: IconQuote,
  Code: IconCode,
}

const props = withDefaults(defineProps<{
  name?: IconName
  size?: number | string
  color?: string
  stroke?: number | string
}>(), {
  name: 'Sparkles',
  size: 24,
  color: 'currentColor',
  stroke: 2,
})

const currentIcon = computed(() => iconMap[props.name] ?? IconSparkles)
</script>

<template>
  <component
    :is="currentIcon"
    :size="size"
    :color="color"
    :stroke="stroke"
    class="icon"
  />
</template>

<style scoped>
.icon {
  display: inline-block;
  vertical-align: middle;
  flex-shrink: 0;
}
</style>