<template>
  <label class="input" :class="['flex w-full flex-col gap-1.5', { 'opacity-60': disabled }]">
    <span v-if="label" class="text-sm font-medium text-ink-secondary">{{ label }}</span>
    <input
      v-bind="$attrs"
      class="box-border w-full rounded-md border bg-surface px-3 py-2 text-base text-ink transition-[border-color,box-shadow] [font:inherit] placeholder:text-muted focus:border-brand focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-primary)_25%,transparent)] focus:outline-none"
      :class="
        error
          ? 'border-danger focus:border-danger focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-alert)_25%,transparent)]'
          : 'border-line'
      "
      :type="type"
      :value="modelValue"
      :placeholder="placeholder"
      :disabled="disabled"
      @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    />
    <span v-if="error" class="text-[13px] text-danger">{{ error }}</span>
    <span v-else-if="hint" class="text-[13px] text-muted">{{ hint }}</span>
  </label>
</template>

<script lang="ts" setup>
defineOptions({ inheritAttrs: false })

withDefaults(
  defineProps<{
    modelValue?: string | number
    label?: string
    type?: string
    placeholder?: string
    error?: string
    hint?: string
    disabled?: boolean
  }>(),
  {
    modelValue: '',
    type: 'text',
    disabled: false,
  },
)

defineEmits<{ 'update:modelValue': [value: string] }>()
</script>
