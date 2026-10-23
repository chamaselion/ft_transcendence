<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import Login from '@/auth/components/Login.vue'
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
  <div
    class="box-border flex min-h-[calc(100vh_-_61px)] flex-col items-center justify-center px-6 py-10"
  >
    <Login
      v-if="authStore.isAuthenticated === false"
      :email="email"
      :is-register-redirect="isRegisterRedirect"
    />
    <Toast
      :model-value="authStore.isAuthenticated === true"
      type="good"
      :message="$t('common.alreadyLoggedIn')"
    />
  </div>
</template>
