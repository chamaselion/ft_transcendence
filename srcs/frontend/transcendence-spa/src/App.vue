<script setup lang="ts">
import { RouterView } from 'vue-router'
import Header from '@/app/layout/Header.vue'
import CookieBanner from '@/app/components/CookieBanner.vue'

</script>
<template>
  <Header />
  <RouterView />
  <CookieBanner />
</template>

<style scoped>
html, body {
  margin: 0;
  padding: 0;
  height: 100%;
  overflow: hidden; /* Disables window-level scrolling */
}
</style>
