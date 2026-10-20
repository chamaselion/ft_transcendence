<script setup lang="ts">
import { computed, useSlots } from 'vue'

type Variant = 'elevated' | 'flat' | 'outlined'
type Size = 'x-small' | 'small' | 'default' | 'large' | 'x-large'

const props = withDefaults(
  defineProps<{
    variant?: Variant
    color?: string
    size?: Size
    disabled?: boolean
    loading?: boolean
    square?: boolean
    type?: 'button' | 'submit' | 'reset'
  }>(),
  {
    variant: 'elevated',
    color: 'primary',
    size: 'default',
    loading: false,
    square: false,
    type: 'button',
  },
)

const slots = useSlots()

const isIconOnly = computed(() => {
  if (props.square) return true
  if (!slots.icon) return false
  if (!slots.default) return true
  const nodes = slots.default()
  return nodes.every((node) => typeof node.children === 'string' && node.children.trim() === '')
})

const sizeClasses: Record<Size, string> = {
  'x-small': 'px-2 py-0.5 text-xs [--btn-icon-pad:4px]',
  small: 'px-2.5 py-1 text-sm [--btn-icon-pad:6px]',
  default: 'px-3 py-1.5 text-base [--btn-icon-pad:8px]',
  large: 'px-3.5 py-2 text-lg [--btn-icon-pad:10px]',
  'x-large': 'px-4 py-2.5 text-xl [--btn-icon-pad:12px]',
}

const variantClasses: Record<Variant, string> = {
  elevated:
    'border-transparent bg-[var(--btn-color)] text-[color:var(--btn-contrast)] shadow-float hover:bg-[var(--btn-color-hover)]',
  flat: 'border-transparent bg-[var(--btn-color)] text-[color:var(--btn-contrast)] hover:bg-[var(--btn-color-hover)]',
  outlined:
    'bg-transparent border-[color:var(--btn-color)] text-[color:var(--btn-color)] hover:bg-[color-mix(in_srgb,var(--btn-color)_12%,transparent)]',
}

const classes = computed(() => [
  'btn',
  'inline-flex items-center justify-center gap-2 rounded-md border font-medium leading-normal cursor-pointer transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed',
  '[&_.icon]:h-[1.25em] [&_.icon]:w-[1.25em]',
  sizeClasses[props.size],
  isIconOnly.value ? 'aspect-square p-[var(--btn-icon-pad)]' : '',
  variantClasses[props.variant],
  props.color === 'default'
    ? '[--btn-color:var(--bg-surface)] [--btn-color-hover:var(--bg-subtle)] [--btn-contrast:var(--text-primary)]'
    : '',
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
  <button :class="classes" :style="style" :type="type" :disabled="disabled || loading">
    <span v-if="loading" class="btn__loader" />
    <slot name="prepend" />
    <slot name="icon" />
    <slot />
    <slot name="append" />
  </button>
</template>
