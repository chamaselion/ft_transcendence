<template>
  <figure class="code" :style="style">
    <figcaption class="code__header">
      <span class="code__language">{{ language }}</span>
      <slot name="header" />
    </figcaption>
    <pre class="code__pre"><code class="code__content"><slot>{{ code }}</slot></code></pre>
  </figure>
</template>

<script lang="ts" setup>
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  code?: string
  language?: string
  typeface?: string
  color?: string
  bgColor?: string
  size?: string
}>(), {
  language: 'plaintext',
  typeface: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace",
  color: '#e2e8f0',
  bgColor: '#0b0f19',
  size: '.875rem',
})

const style = computed(() => ({
  fontFamily: props.typeface,
  color: props.color,
  backgroundColor: props.bgColor,
  fontSize: props.size,
}))
</script>

<style lang="css" scoped>
.code {
  margin: 0;
  border-radius: 8px;
  overflow: hidden;
}

.code__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 14px;
  border-bottom: 1px solid rgba(255, 255, 255, .12);
  font-size: .75rem;
  letter-spacing: .04em;
  text-transform: uppercase;
  opacity: .75;
}

.code__pre {
  margin: 0;
  padding: 14px;
  overflow-x: auto;
}

.code__content {
  font-family: inherit;
  font-size: inherit;
  white-space: pre;
}
</style>
