<script setup lang="ts">
import { computed, ref, onMounted, watch } from 'vue'
import { httpClient, HttpError } from '@/auth/auth.api'
import type { UserDetailed } from '@/auth/types/user'
import Button from '@/app/components/Button.vue'
import Input from '@/app/components/Input.vue'
import Modal from '@/app/components/Modal.vue'
import Toast from '@/app/components/Toast.vue'

const username = ref('')

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
  <Modal
    :model-value="true"
    title="Manage User"
    :close-on-overlay="!confirmingDelete"
    :close-on-esc="!confirmingDelete"
    @update:model-value="emit('close')"
  >
    <Toast
      v-model="toastVisible"
      class="management-error mb-4 min-w-0"
      :message="toastMessage"
      type="alert"
      :duration="0"
      fluid
      role="alert"
    />
    <div v-if="user" class="flex flex-col gap-3">
      <p
        class="m-0 mb-1 rounded-lg bg-subtle p-3 text-sm leading-normal text-ink-secondary [overflow-wrap:anywhere]"
      >
        {{ user.email }} - {{ user.login }}
      </p>
      <dl
        class="m-0 mb-1 grid grid-cols-[repeat(auto-fit,minmax(min(180px,100%),1fr))] gap-3 rounded-lg border border-line-subtle p-3 text-sm leading-normal"
      >
        <div>
          <dt class="mb-1 text-xs font-medium text-ink-secondary">Created at</dt>
          <dd class="m-0 text-ink [overflow-wrap:anywhere]">{{ formatDate(user.createdAt) }}</dd>
        </div>
        <div>
          <dt class="mb-1 text-xs font-medium text-ink-secondary">Updated at</dt>
          <dd class="m-0 text-ink [overflow-wrap:anywhere]">{{ formatDate(user.updatedAt) }}</dd>
        </div>
      </dl>
      <Button v-if="user.role !== 'admin'" @click="promoteToAdmin()">Promote to Admin</Button>
      <Button v-if="user.role === 'admin'" @click="revokeAdmin()">Revoke Admin</Button>
      <Button color="alert" variant="outlined" @click="openDeleteConfirmation">Delete User</Button>
      <Input class="mt-2" type="text" v-model="username" placeholder="Update Username" />
      <Button @click="updateUsername">Update Username</Button>
    </div>

    <Modal
      v-model="confirmingDelete"
      title="Delete User"
      size="small"
      :close-on-overlay="!deleting"
      :close-on-esc="!deleting"
    >
      <div class="flex flex-col gap-3">
        <p class="m-0 text-sm leading-normal">
          Permanently delete
          <strong>{{ user?.login }}</strong
          >?
        </p>
        <p class="m-0 text-sm leading-normal text-ink-secondary">
          This account and all associated data will be deleted. This action cannot be undone.
        </p>
        <Input
          v-model="deleteConfirmationName"
          :label="`Type “${user?.login ?? ''}” to confirm`"
          type="text"
          placeholder="Enter the username"
          :disabled="deleting"
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
        <Button color="alert" :loading="deleting" :disabled="!canConfirmDelete" @click="deleteUser">
          Delete User
        </Button>
      </template>
    </Modal>
  </Modal>
</template>
