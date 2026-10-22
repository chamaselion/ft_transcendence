<script setup lang="ts">
import Register from '@/auth/components/Register.vue'
import Toast from '@/app/components/Toast.vue'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()
</script>

<template>
  <div
    class="box-border flex min-h-[calc(100vh_-_61px)] flex-col items-center justify-center px-6 py-10"
  >
    <Register v-if="!authStore.isAuthenticated" />
    <Toast
      :model-value="authStore.isAuthenticated"
      type="good"
      :message="$t('common.alreadyLoggedIn')"
    />
  </div>
</template>
