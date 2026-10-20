<template>
  <div
    class="card overflow-hidden rounded-[10px] border bg-surface text-ink"
    :class="{ 'shadow-card': elevated, 'border-line': outlined, 'border-transparent': !outlined }"
  >
    <div
      v-if="title || $slots.header"
      class="border-b border-line-subtle px-4 py-3 text-base font-semibold"
    >
      <slot name="header">{{ title }}</slot>
    </div>
    <div class="p-4">
      <slot />
    </div>
    <div v-if="$slots.footer" class="border-t border-line-subtle bg-subtle px-4 py-3">
      <slot name="footer" />
    </div>
  </div>
</template>

<script lang="ts" setup>
withDefaults(
  defineProps<{
    title?: string
    elevated?: boolean
    outlined?: boolean
  }>(),
  {
    elevated: true,
    outlined: false,
  },
)
</script>
