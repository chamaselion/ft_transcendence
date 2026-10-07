<script lang="ts">
export const iconNames = [
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
  'Sparkles',
  'Pencil',
  'PencilPlus',
  'Trash',
  'LetterCase',
  'AdjustmentsHorizontal',
  'Eye',
  'Paragraph',
  'List',
  'ListNumbers',
  'Quote',
  'Code',
  'AlignLeft',
  'AlignCenter',
  'AlignRight',
  'AlignJustified',
  'Login',
  'Logout',
  'Sun',
  'Moon',
  'Github',
  'FortyTwo',
  'ExclamationMark',
  'Share',
  'FileText',
  'Plus',
  'Folder',
  'Search',
  'Refresh',
] as const

export type IconName = (typeof iconNames)[number]
</script>

<script setup lang="ts">
import { computed, type Component } from 'vue'
import {
  IconH1,
  IconH2,
  IconH3,
  IconH4,
  IconH5,
  IconH6,
  IconSparkles,
  IconPencil,
  IconPencilPlus,
  IconTrash,
  IconLetterCase,
  IconAdjustmentsHorizontal,
  IconEye,
  IconAlignLeft,
  IconAlignCenter,
  IconAlignRight,
  IconAlignJustified,
  IconList,
  IconListNumbers,
  IconQuote,
  IconCode,
  IconLogin,
  IconLogout,
  IconSun,
  IconMoon,
  IconBrandGithub,
  IconNumber42Small,
  IconExclamationMark,
  IconShare,
  IconFileText,
  IconPlus,
  IconFolder,
  IconSearch,
  IconRefresh,
} from '@tabler/icons-vue'

const iconMap: Record<IconName, Component> = {
  H1: IconH1,
  H2: IconH2,
  H3: IconH3,
  H4: IconH4,
  H5: IconH5,
  H6: IconH6,
  Sparkles: IconSparkles,
  Pencil: IconPencil,
  PencilPlus: IconPencilPlus,
  Trash: IconTrash,
  LetterCase: IconLetterCase,
  AdjustmentsHorizontal: IconAdjustmentsHorizontal,
  Eye: IconEye,
  Paragraph: IconAlignLeft,
  List: IconList,
  ListNumbers: IconListNumbers,
  Quote: IconQuote,
  Code: IconCode,
  AlignLeft: IconAlignLeft,
  AlignCenter: IconAlignCenter,
  AlignRight: IconAlignRight,
  AlignJustified: IconAlignJustified,
  Login: IconLogin,
  Logout: IconLogout,
  Sun: IconSun,
  Moon: IconMoon,
  Github: IconBrandGithub,
  FortyTwo: IconNumber42Small,
  ExclamationMark: IconExclamationMark,
  Share: IconShare,
  FileText: IconFileText,
  Plus: IconPlus,
  Folder: IconFolder,
  Search: IconSearch,
  Refresh: IconRefresh,
}

const props = withDefaults(
  defineProps<{
    name?: IconName
    size?: number | string
    color?: string
    stroke?: number | string
  }>(),
  {
    name: 'Sparkles',
    size: 24,
    color: 'currentColor',
    stroke: 2,
  },
)

const currentIcon = computed(() => iconMap[props.name] ?? IconSparkles)
</script>

<template>
  <component :is="currentIcon" :size="size" :color="color" :stroke="stroke" class="icon" />
</template>

<style scoped>
.icon {
  display: inline-block;
  vertical-align: middle;
  flex-shrink: 0;
}
</style>
