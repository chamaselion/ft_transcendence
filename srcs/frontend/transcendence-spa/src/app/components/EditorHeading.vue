<template>
  <component :is="tag" class="heading" :style="style">
    <slot>{{ text }}</slot>
  </component>
</template>

<script lang="ts" setup>
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  level?: 1 | 2 | 3 | 4 | 5 | 6
  text?: string
  typeface?: string
  color?: string
  bgColor?: string
  size?: string
}>(), {
  level: 1,
  typeface: 'inherit',
  color: 'var(--text-primary)',
  bgColor: 'transparent',
  size: '',
})

const tag = computed(() => `h${props.level}`)

const style = computed(() => ({
  fontFamily: props.typeface,
  color: props.color,
  backgroundColor: props.bgColor,
  fontSize: props.size || undefined,
}))
</script>

<style lang="css" scoped>
.heading {
  margin: 0 0 .5em;
  font-weight: 700;
  line-height: 1.25;
}

h1.heading { font-size: 2rem; }
h2.heading { font-size: 1.6rem; }
h3.heading { font-size: 1.35rem; }
h4.heading { font-size: 1.15rem; }
h5.heading { font-size: 1rem; }
h6.heading { font-size: .875rem; text-transform: uppercase; letter-spacing: .05em; }
</style>
