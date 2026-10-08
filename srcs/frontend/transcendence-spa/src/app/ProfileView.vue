<script setup lang="ts">
import { computed } from 'vue'
import UserManaging from '@/admin/components/UserManaging.vue'
import UserSettings from '@/auth/components/UserSettings.vue'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()

const isAdmin = computed(() => authStore.isAdmin)
</script>

<template>
  <UserSettings />
  <UserManaging v-if="isAdmin()" />
</template>
