<script setup lang="ts">
  import { computed } from 'vue'
  import Login from '@/auth/components/Login.vue'
  import { useRoute } from 'vue-router'

  const route = useRoute()

  const email = computed(() => {
    const value = route.query.email
    const first = Array.isArray(value) ? value[0] : value

    return typeof first === 'string' ? first : undefined
  })

  const isRegisterRedirect = computed(() => {
    const value = route.query.redirect
    const first = Array.isArray(value) ? value[0] : value

    return first === 'true'
  })
</script>

<template>

  <Login  :email="email"
          :isRegisterRedirect="isRegisterRedirect"/>

</template>
