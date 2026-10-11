<script setup lang="ts">
import { defineProps, defineEmits, ref } from 'vue'
import { httpClient } from '@/auth/auth.api'
import type { User } from '@/auth/types/user'
import Button from '@/app/components/Button.vue'
import Input from '@/app/components/Input.vue'

const username = ref<string | undefined | null>(null)

const props = defineProps<{
  user: User
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const revokeAdmin = async () => {
  try {
    await httpClient.patch(`/api/users/${props.user.id}`, {
      role: 'user',
    })
    emit('close')
  } catch (error) {
    console.error('Failed to revoke admin:', error)
  }
}

const promoteToAdmin = async () => {
  try {
    await httpClient.patch(`/api/users/${props.user.id}`, {
      role: 'admin',
    })
    emit('close')
  } catch (error) {
    console.error('Failed to promote to admin:', error)
  }
}

const deleteUser = async () => {
  try {
    await httpClient.delete(`/api/users/${props.user.id}`)
    emit('close')
  } catch (error) {
    console.error('Failed to delete user:', error)
  }
}

const updateUsername = async () => {
  try {
    await httpClient.patch(`/api/users/${props.user.id}`, {
      login: username.value,
    })
    emit('close')
  } catch (error) {
    console.error('Failed to update username:', error)
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
        @click="promoteToAdmin()"
        >Promote to Admin</Button
      >
      <Button
        v-if="user.role === 'admin'"
        @click="revokeAdmin()"
        >Revoke Admin</Button
      >
      <Button @click="deleteUser()">Delete User</Button>
      <Input
        type="text"
        v-model="username"
        placeholder="Update Username"
      />
      <Button @click="updateUsername">Update Username</Button>
    </div>
  </div>
</template>

<style scoped>
.manage-user-modal {
  position: fixed;
  top: 50%;
  left: 50%;
  z-index: 1000;
  box-sizing: border-box;
  width: min(520px, calc(100% - 32px));
  max-height: calc(100dvh - 32px);
  overflow-y: auto;
  transform: translate(-50%, -50%);
  padding: 20px;
  border: 1px solid var(--border-subtle);
  border-radius: 12px;
  background-color: var(--bg-surface);
  color: var(--text-primary);
  box-shadow: var(--shadow-md);
}

.manage-user-modal h1 {
  margin: 0 0 20px;
  padding: 0 40px 16px 0;
  border-bottom: 1px solid var(--border-subtle);
  font-size: 18px;
  font-weight: 600;
  line-height: 1.5;
}

.user-management-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.user-management-content p {
  margin: 0 0 4px;
  padding: 12px;
  border-radius: 8px;
  background-color: var(--bg-subtle);
  color: var(--text-secondary);
  font-size: 14px;
  line-height: 1.5;
  overflow-wrap: anywhere;
}

.user-management-content > .input {
  margin-top: 8px;
}

.close-button {
  position: absolute;
  top: 16px;
  right: 20px;
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 18px;
  line-height: 1;
  transition:
    background-color 0.2s,
    color 0.2s;
}

.close-button:hover {
  background-color: var(--bg-subtle);
  color: var(--text-primary);
}
</style>
