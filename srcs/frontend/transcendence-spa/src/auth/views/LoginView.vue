<script setup lang="ts">
  import { computed } from 'vue'
  import Login from '@/auth/components/Login.vue'
  import { useRoute } from 'vue-router'
  import { useAuthStore } from '@/stores/auth'
  import Toast from '@/app/components/Toast.vue'

  const route = useRoute()

  const authStore = useAuthStore()

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

  <div class="login-parent">
    <Login  :email="email" v-if="authStore.isAuthenticated === false"
            :isRegisterRedirect="isRegisterRedirect"/>
    <Toast :modelValue="authStore.isAuthenticated === true"
           type="good"
           message="You are already logged in." />
  </div>

</template>

<style scoped>
  .login-parent {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100%;
    min-height: 100vh;
  }


</style>
