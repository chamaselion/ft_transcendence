<template>
  <blockquote class="citation" :style="style">
    <span class="citation__stripe" :style="{ backgroundColor: accent }" />
    <div class="citation__body">
      <slot>{{ text }}</slot>
      <footer v-if="source" class="citation__source">— {{ source }}</footer>
    </div>
  </blockquote>
</template>

<script lang="ts" setup>
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  text?: string
  source?: string
  typeface?: string
  color?: string
  bgColor?: string
  size?: string
  accent?: string
}>(), {
  typeface: 'inherit',
  color: 'var(--text-primary)',
  bgColor: 'var(--bg-subtle)',
  size: '1rem',
  accent: 'var(--color-primary)',
})

const style = computed(() => ({
  fontFamily: props.typeface,
  color: props.color,
  backgroundColor: props.bgColor,
  fontSize: props.size,
}))
</script>

<style lang="css" scoped>
.citation {
  display: flex;
  gap: 14px;
  margin: 0;
  padding: 14px 16px;
  border-radius: 8px;
  font-style: italic;
}

.citation__stripe {
  flex-shrink: 0;
  width: 4px;
  border-radius: 999px;
}

.citation__body {
  flex: 1;
}

.citation__source {
  margin-top: 8px;
  color: var(--text-muted);
  font-size: .85em;
  font-style: normal;
}
</style>
