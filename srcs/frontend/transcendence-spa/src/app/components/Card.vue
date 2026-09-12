<template>
  <div class="card" :class="{ 'card--elevated': elevated, 'card--outlined': outlined }">
    <div v-if="title || $slots.header" class="card__header">
      <slot name="header">{{ title }}</slot>
    </div>
    <div class="card__body">
      <slot />
    </div>
    <div v-if="$slots.footer" class="card__footer">
      <slot name="footer" />
    </div>
  </div>
</template>

<script lang="ts" setup>
withDefaults(defineProps<{
  title?: string
  elevated?: boolean
  outlined?: boolean
}>(), {
  elevated: true,
  outlined: false,
})
</script>

<style lang="css" scoped>
.card {
  background-color: var(--bg-surface);
  color: var(--text-primary);
  border: 1px solid transparent;
  border-radius: 10px;
  overflow: hidden;
}

.card--elevated {
  box-shadow: var(--shadow-md);
}

.card--outlined {
  border-color: var(--border-default);
}

.card__header {
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-subtle);
  font-size: 16px;
  font-weight: 600;
}

.card__body {
  padding: 16px;
}

.card__footer {
  padding: 12px 16px;
  border-top: 1px solid var(--border-subtle);
  background-color: var(--bg-subtle);
}
</style>
