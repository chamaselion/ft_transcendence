<script setup lang="ts">
import { computed, ref, onMounted, watch } from 'vue'
import { httpClient, HttpError } from '@/auth/auth.api'
import type { UserDetailed } from '@/auth/types/user'
import Button from '@/app/components/Button.vue'
import Input from '@/app/components/Input.vue'
import Modal from '@/app/components/Modal.vue'
import Toast from '@/app/components/Toast.vue'
import { validateLogin } from '@/utils/validation'

const username = ref('')
const usernameError = ref('')

const validateUsername = () => {
  const result = validateLogin(username.value)
  usernameError.value = result.error ?? ''
  return result
}

const toastMessage = ref('')
const toastVisible = ref(false)

const user = ref<UserDetailed | null>(null)

const confirmingDelete = ref(false)
const deleteConfirmationName = ref('')
const deleting = ref(false)

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

const canConfirmDelete = computed(
  () => user.value !== null && deleteConfirmationName.value.trim() === user.value.login,
)

const deleteConfirmationError = computed(() => {
  if (!deleteConfirmationName.value.trim()) return ''
  return canConfirmDelete.value ? '' : `Type “${user.value?.login ?? ''}” exactly to confirm.`
})

const openDeleteConfirmation = () => {
  deleteConfirmationName.value = ''
  confirmingDelete.value = true
}

const closeDeleteConfirmation = () => {
  confirmingDelete.value = false
}

watch(confirmingDelete, (open) => {
  if (!open) deleteConfirmationName.value = ''
})

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
  if (!user.value || deleting.value || !canConfirmDelete.value) return
  deleting.value = true
  toastVisible.value = false
  try {
    await httpClient.delete(`/api/users/${user.value.id}`)
    emit('close')
  } catch (error) {
    closeDeleteConfirmation()
    showError(error, 'Failed to delete user. Please try again.')
  } finally {
    deleting.value = false
  }
}

const updateUsername = async () => {
  if (!user.value) {
    showError(null, 'User data is not loaded yet.')
    return
  }
  const result = validateUsername()
  if (result.error) return
  toastVisible.value = false
  try {
    await httpClient.patch(`/api/users/${user.value.id}`, {
      login: result.value,
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
  <Modal
    :model-value="true"
    title="Manage User"
    :close-on-overlay="!confirmingDelete"
    :close-on-esc="!confirmingDelete"
    @update:model-value="emit('close')"
  >
    <Toast
      v-model="toastVisible"
      class="management-error"
      :message="toastMessage"
      type="alert"
      :duration="0"
      fluid
      role="alert"
    />
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
      <Button
        color="alert"
        variant="outlined"
        @click="openDeleteConfirmation"
        >Delete User</Button
      >
      <Input
        type="text"
        v-model="username"
        placeholder="Update Username"
        :error="usernameError"
        @blur="validateUsername"
      />
      <Button @click="updateUsername">Update Username</Button>
    </div>

    <Modal
      v-model="confirmingDelete"
      title="Delete User"
      size="small"
      :close-on-overlay="!deleting"
      :close-on-esc="!deleting"
    >
      <div class="delete-confirmation">
        <p>
          Permanently delete
          <strong>{{ user?.login }}</strong
          >?
        </p>
        <p class="delete-confirmation__warning">
          This account and all associated data will be deleted. This action cannot be undone.
        </p>
        <Input
          v-model="deleteConfirmationName"
          :label="`Type “${user?.login ?? ''}” to confirm`"
          type="text"
          placeholder="Enter the username"
          :disabled="deleting"
          :error="deleteConfirmationError"
        />
      </div>
      <template #footer>
        <Button
          variant="outlined"
          color="default"
          :disabled="deleting"
          @click="closeDeleteConfirmation"
        >
          Cancel
        </Button>
        <Button
          color="alert"
          :loading="deleting"
          :disabled="!canConfirmDelete"
          @click="deleteUser"
        >
          Delete User
        </Button>
      </template>
    </Modal>
  </Modal>
</template>

<style scoped>
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

.delete-confirmation {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.delete-confirmation p {
  margin: 0;
  font-size: 14px;
  line-height: 1.5;
}

.delete-confirmation__warning {
  color: var(--text-secondary);
}
</style>
