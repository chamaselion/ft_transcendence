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
  'Home',
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
  'ChevronLeft',
  'ChevronRight',
  'ChevronsLeft',
  'ChevronsRight',
  'FilePDF',
  'Cookie',
  'ShieldCheck',
  'InfoCircle',
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
  IconHome,
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
  IconChevronLeft,
  IconChevronRight,
  IconChevronsLeft,
  IconChevronsRight,
  IconFileTypePdf,
  IconCookie,
  IconShieldCheck,
  IconInfoCircle,
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
  Home: IconHome,
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
  ChevronLeft: IconChevronLeft,
  ChevronRight: IconChevronRight,
  ChevronsLeft: IconChevronsLeft,
  ChevronsRight: IconChevronsRight,
  FilePDF: IconFileTypePdf,
  Cookie: IconCookie,
  ShieldCheck: IconShieldCheck,
  InfoCircle: IconInfoCircle,
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
  <component
    :is="currentIcon"
    :size="size"
    :color="color"
    :stroke="stroke"
    class="icon inline-block shrink-0 align-middle"
  />
</template>
