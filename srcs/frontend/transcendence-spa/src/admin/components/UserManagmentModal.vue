<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { httpClient, HttpError } from '@/auth/auth.api'
import type { UserDetailed } from '@/auth/types/user'
import Button from '@/app/components/Button.vue'
import Input from '@/app/components/Input.vue'
import Toast from '@/app/components/Toast.vue'

const username = ref('')

const toastMessage = ref('')
const toastVisible = ref(false)

const user = ref<UserDetailed | null>(null)

// User readable ISO date formatting
const formatDate = (value: string) => {
  const date = new Date(value)
  if (!value || Number.isNaN(date.getTime())) return 'Unavailable'
  return date.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

const showError = (error: unknown, fallback: string) => {
  toastMessage.value = error instanceof HttpError && error.message ? error.message : fallback
  toastVisible.value = true
}

const props = defineProps<{
  userID: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const revokeAdmin = async () => {
  if (!user.value) {
    showError(null, 'User data is not loaded yet.')
    return
  }
  toastVisible.value = false
  try {
    await httpClient.patch(`/api/users/${user.value.id}`, {
      role: 'user',
    })
    emit('close')
  } catch (error) {
    showError(error, 'Failed to revoke admin. Please try again.')
  }
}

const promoteToAdmin = async () => {
  if (!user.value) {
    showError(null, 'User data is not loaded yet.')
    return
  }
  toastVisible.value = false
  try {
    await httpClient.patch(`/api/users/${user.value.id}`, {
      role: 'admin',
    })
    emit('close')
  } catch (error) {
    showError(error, 'Failed to promote to admin. Please try again.')
  }
}

const deleteUser = async () => {
  if (!user.value) {
    showError(null, 'User data is not loaded yet.')
    return
  }
  toastVisible.value = false
  try {
    await httpClient.delete(`/api/users/${user.value.id}`)
    emit('close')
  } catch (error) {
    showError(error, 'Failed to delete user. Please try again.')
  }
}

const updateUsername = async () => {
  if (!user.value) {
    showError(null, 'User data is not loaded yet.')
    return
  }
  toastVisible.value = false
  try {
    await httpClient.patch(`/api/users/${user.value.id}`, {
      login: username.value,
    })
    emit('close')
  } catch (error) {
    showError(error, 'Failed to update username. Please try again.')
  }
}

onMounted(async () => {
  try {
    const response = await httpClient.get<{ user: UserDetailed }>(`/api/users/${props.userID}`)
    user.value = response.user
  } catch (error) {
    showError(error, 'Failed to fetch user details. Please try again.')
  }
})
</script>

<template>
  <div class="manage-user-modal">
    <h1>Manage Users here</h1>
    <Toast
      v-model="toastVisible"
      class="management-error"
      :message="toastMessage"
      type="alert"
      :duration="0"
      fluid
      role="alert"
    />
    <span
      class="close-button"
      @click="$emit('close')"
      >X</span
    >
    <div
      class="user-management-content"
      v-if="user"
    >
      <p>{{ user.email }} - {{ user.login }}</p>
      <dl class="user-timestamps">
        <div>
          <dt>Created at</dt>
          <dd>{{ formatDate(user.createdAt) }}</dd>
        </div>
        <div>
          <dt>Updated at</dt>
          <dd>{{ formatDate(user.updatedAt) }}</dd>
        </div>
      </dl>
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

.management-error {
  min-width: 0;
  margin-bottom: 16px;
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

.user-timestamps {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(180px, 100%), 1fr));
  gap: 12px;
  margin: 0 0 4px;
  padding: 12px;
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  font-size: 14px;
  line-height: 1.5;
}

.user-timestamps dt {
  margin-bottom: 4px;
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 500;
}

.user-timestamps dd {
  margin: 0;
  color: var(--text-primary);
  overflow-wrap: anywhere;
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
