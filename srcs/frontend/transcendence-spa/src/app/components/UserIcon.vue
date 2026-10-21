<template>
  <div class="user-icon inline-flex items-center gap-2">
    <img
      v-if="avatarUrl"
      class="user-icon__avatar shrink-0 rounded-full object-cover"
      :class="sizeClass"
      :src="avatarUrl"
      :alt="name"
    />
    <span
      v-else
      class="user-icon__fallback inline-flex shrink-0 items-center justify-center rounded-full bg-brand font-semibold text-brand-contrast"
      :class="sizeClass"
      >{{ initials }}</span
    >
    <span v-if="showName" class="user-icon__name text-sm text-ink">{{ name }}</span>
  </div>
</template>

<script lang="ts" setup>
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    avatarUrl?: string
    name?: string
    size?: 'small' | 'default' | 'large'
    showName?: boolean
  }>(),
  {
    name: '',
    size: 'default',
    showName: false,
  },
)

const sizeClass = computed(
  () =>
    ({
      small: 'h-7 w-7 text-[11px]',
      default: 'h-10 w-10 text-sm',
      large: 'h-14 w-14 text-xl',
    })[props.size],
)

const initials = computed(() =>
  props.name
    .split(' ')
    .map((part) => part[0] ?? '')
    .slice(0, 2)
    .join('')
    .toUpperCase(),
)
</script>
