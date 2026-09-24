<template>
  <label class="input" :class="{ 'input--disabled': disabled }">
    <span v-if="label" class="input__label">{{ label }}</span>
    <input
      class="input__field"
      :class="{ 'input__field--error': !!error }"
      :type="type"
      :value="modelValue"
      :placeholder="placeholder"
      :disabled="disabled"
      @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    />
    <span v-if="error" class="input__error">{{ error }}</span>
    <span v-else-if="hint" class="input__hint">{{ hint }}</span>
  </label>
</template>

<script lang="ts" setup>
withDefaults(defineProps<{
  modelValue?: string | number
  label?: string
  type?: string
  placeholder?: string
  error?: string
  hint?: string
  disabled?: boolean
}>(), {
  modelValue: '',
  type: 'text',
  disabled: false,
})

defineEmits<{ 'update:modelValue': [value: string] }>()
</script>

<style lang="css" scoped>
.input {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
}

.input__label {
  color: var(--text-secondary);
  font-size: 14px;
  font-weight: 500;
}

.input__field {
  box-sizing: border-box;
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--border-default);
  border-radius: 6px;
  background-color: var(--bg-surface);
  color: var(--text-primary);
  font: inherit;
  font-size: 16px;
  transition: border-color .2s, box-shadow .2s;
}

.input__field::placeholder {
  color: var(--text-muted);
}

.input__field:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 25%, transparent);
}

.input__field--error {
  border-color: var(--color-alert);
}

.input__field--error:focus {
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-alert) 25%, transparent);
}

.input__error {
  color: var(--color-alert);
  font-size: 13px;
}

.input__hint {
  color: var(--text-muted);
  font-size: 13px;
}

.input--disabled {
  opacity: .6;
}
</style>
