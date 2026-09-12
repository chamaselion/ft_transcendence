<script setup lang="ts">
import { computed } from 'vue'

type Variant = 'elevated' | 'flat' | 'outlined'
type Size = 'x-small' | 'small' | 'default' | 'large' | 'x-large'

const props = withDefaults(defineProps<{
  variant?: Variant
  color?: string
  size?: Size
  block?: boolean
  rounded?: boolean
  loading?: boolean
  disabled?: boolean
  type?: 'button' | 'submit' | 'reset'
}>(), {
  variant: 'elevated',
  color: 'primary',
  size: 'default',
  type: 'button',
})

const classes = computed(() => [
  'btn',
  `btn--v-${props.variant ?? "flat"}`,
  `btn--s-${props.size ?? "default"}`,
  `btn--c-${props.color ?? "default"}`,
  { 'btn--block': props.block, 'btn--rounded': props.rounded, 'btn--loading': props.loading },
])

const style = computed(() => {
  if (props.color === 'default') return {}
  return {
    '--btn-color': `var(--color-${props.color})`,
    '--btn-color-hover': `var(--color-${props.color}-hover)`,
    '--btn-contrast': `var(--color-${props.color}-contrast)`,
  }
})
</script>

<template>
  <button
    :class="classes"
    :style="style"
    :type="type"
    :disabled="disabled || loading"
  >
    <span v-if="loading" class="btn__loader" />
    <slot name="prepend" />
    <slot />
    <slot name="append" />
  </button>
</template>

<style scoped>
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 1px solid transparent;
  border-radius: 6px;
  font: inherit;
  font-weight: 500;
  line-height: 1.5;
  color: var(--text-primary);
  cursor: pointer;
  transition: background-color .2s, color .2s, box-shadow .2s, border-color .2s;
}

.btn:disabled {
  opacity: .5;
  cursor: not-allowed;
}

.btn--s-x-small { padding: 2px 8px; font-size: 12px; }
.btn--s-small { padding: 4px 10px; font-size: 14px; }
.btn--s-default { padding: 6px 12px; font-size: 16px; }
.btn--s-large { padding: 8px 14px; font-size: 18px; }
.btn--s-x-large { padding: 10px 16px; font-size: 20px; }

/* Variants decide *how* the color is applied */
.btn--v-elevated,
.btn--v-flat {
  background-color: var(--btn-color);
  color: var(--btn-contrast, var(--text-primary));
}

.btn--v-elevated { box-shadow: var(--shadow-md); }

.btn--v-elevated:hover,
.btn--v-flat:hover {
  background-color: var(--btn-color-hover, var(--btn-color));
}

.btn--v-outlined {
  background-color: transparent;
  border-color: var(--btn-color);
  color: var(--btn-color);
}

.btn--v-outlined:hover {
  background-color: color-mix(in srgb, var(--btn-color) 12%, transparent);
}

/* "default" has no theme token, so it is mapped here */
.btn--c-default {
  --btn-color: var(--bg-surface);
  --btn-color-hover: var(--bg-subtle);
  --btn-contrast: var(--text-primary);
}

</style>