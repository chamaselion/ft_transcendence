<script setup lang="ts">
  import Login from '@/auth/components/Login.vue'
  import { useRoute } from 'vue-router'

  const route = useRoute()
</script>

<template>

  <Login :email="route.query.email" />

</template>
