<template>
  <p class="paragraph" :style="style">
    <slot>{{ text }}</slot>
  </p>
</template>

<script lang="ts" setup>
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  text?: string
  typeface?: string
  color?: string
  bgColor?: string
  size?: string
}>(), {
  typeface: 'inherit',
  color: 'var(--text-primary)',
  bgColor: 'transparent',
  size: '1rem',
})

const style = computed(() => ({
  fontFamily: props.typeface,
  color: props.color,
  backgroundColor: props.bgColor,
  fontSize: props.size,
}))
</script>

<style lang="css" scoped>
.paragraph {
  margin: 0 0 1em;
  line-height: 1.6;
}
</style>
