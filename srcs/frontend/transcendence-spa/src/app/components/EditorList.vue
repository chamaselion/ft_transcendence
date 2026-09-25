<template>
  <component :is="ordered ? 'ol' : 'ul'" class="list" :style="style">
    <li v-for="(item, index) in items" :key="index" class="list__item">
      <slot name="item" :item="item" :index="index">{{ item }}</slot>
    </li>
  </component>
</template>

<script lang="ts" setup>
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  items?: string[]
  ordered?: boolean
  marker?: string
  typeface?: string
  color?: string
  bgColor?: string
  size?: string
}>(), {
  items: () => [],
  ordered: false,
  marker: '',
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
  listStyleType: props.marker || (props.ordered ? 'decimal' : 'disc'),
}))
</script>

<style lang="css" scoped>
.list {
  margin: 0;
  padding-left: 1.5em;
}

.list__item {
  line-height: 1.6;
}

.list__item + .list__item {
  margin-top: 4px;
}
</style>
