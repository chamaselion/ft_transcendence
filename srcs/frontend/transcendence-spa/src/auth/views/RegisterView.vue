<script setup lang="ts">
  import Register from '@/auth/components/Register.vue'
  import Toast from '@/app/components/Toast.vue'
  import { useAuthStore } from '@/stores/auth'

  const authStore = useAuthStore()
</script>

<template>

  <div class="register-parent">
    <Register v-if="!authStore.isAuthenticated" />
    <Toast :modelValue="authStore.isAuthenticated"
             type="good"
             message="You are already logged in." />
  </div>


</template>

<style scoped>
  .register-parent {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100vh;
  }
</style>
