<template>
  <h1>Login</h1>
</template>

<script setup lang="ts">
  import { buildUrl } from '@/auth/auth.api'

  try {
    console.log(buildUrl("/temp/test").toString())
    console.log(buildUrl("temp/test").toString())

  } catch (e) {
    console.error(e)
  }
</script>

