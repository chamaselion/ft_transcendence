<script setup lang="ts">
import { RouterView } from 'vue-router'
import Header from '@/app/layout/Header.vue'

</script>
<template>
  <Header />
  <RouterView />
</template>

<style scoped>
html, body {
  margin: 0;
  padding: 0;
  height: 100%;
  overflow: hidden; /* Disables window-level scrolling */
}
</style>
