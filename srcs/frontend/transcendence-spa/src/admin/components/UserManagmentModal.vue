<script setup lang="ts">
import { defineProps, defineEmits } from 'vue'
import { httpClient } from '@/auth/auth.api'
import type { User } from '@/auth/types/user'
import Button from '@/app/components/Button.vue'

const props = defineProps<{
  user: User
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const revokeAdmin = async (userID: string) => {
  try {
    await httpClient.patch(`/api/users/${userID}`, {
      role: 'user',
    })
    emit('close')
  } catch (error) {
    console.error('Failed to revoke admin:', error)
  }
}

const promoteToAdmin = async (userID: string) => {
  try {
    await httpClient.patch(`/api/users/${userID}`, {
      role: 'admin',
    })
    emit('close')
  } catch (error) {
    console.error('Failed to promote to admin:', error)
  }
}
</script>

<template>
  <div class="manage-user-modal">
    <h1>Manage Users here</h1>
    <span
      class="close-button"
      @click="$emit('close')"
      >X</span
    >
    <div
      class="user-management-content"
      v-if="user"
    >
      <p>{{ props.user.email }} - {{ props.user.login }}</p>
      <!-- User management content goes here -->
      <Button
        v-if="user.role !== 'admin'"
        @click="promoteToAdmin(user.id)"
        >Promote to Admin</Button
      >
      <Button
        v-if="user.role === 'admin'"
        @click="revokeAdmin(user.id)"
        >Revoke Admin</Button
      >
      <Button @click="emit('close')">Delete User</Button>
    </div>
  </div>
</template>

<style scoped>
.manage-user-modal {
  position: fixed;
  top: 10%;
  left: 10%;
  width: 80%;
  height: 80%;
  background-color: var(--bg-subtle);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  padding: 16px;
  z-index: 1000;
}

.close-button {
  position: absolute;
  top: 8px;
  right: 8px;
  cursor: pointer;
  font-size: 34px;
  font-weight: bold;
  padding: 4px 8px;
}

.close-button:hover {
  color: red;
}
</style>
