<script setup lang="ts">
import { computed, ref, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { httpClient, HttpError } from '@/auth/auth.api'
import { logger } from '@/utils/logger'
import type { UserDetailed } from '@/auth/types/user'
import Button from '@/app/components/Button.vue'
import Input from '@/app/components/Input.vue'
import Modal from '@/app/components/Modal.vue'
import Toast from '@/app/components/Toast.vue'
import { validateLogin } from '@/utils/validation'

const { t } = useI18n()
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
  if (!value || Number.isNaN(date.getTime())) return t('admin.modal.unavailable')
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
  return canConfirmDelete.value
    ? ''
    : t('admin.modal.typeToConfirm', { login: user.value?.login ?? '' })
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
    showError(null, t('admin.errors.notLoaded'))
    return
  }
  toastVisible.value = false
  try {
    await httpClient.patch(`/api/users/${user.value.id}`, {
      role: 'user',
    })
    emit('close')
  } catch (error) {
    showError(error, t('admin.errors.revokeFailed'))
  }
}

const promoteToAdmin = async () => {
  if (!user.value) {
    showError(null, t('admin.errors.notLoaded'))
    return
  }
  toastVisible.value = false
  try {
    await httpClient.patch(`/api/users/${user.value.id}`, {
      role: 'admin',
    })
    emit('close')
  } catch (error) {
    showError(error, t('admin.errors.promoteFailed'))
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
    showError(error, t('admin.errors.deleteFailed'))
  } finally {
    deleting.value = false
  }
}

const updateUsername = async () => {
  if (!user.value) {
    showError(null, t('admin.errors.notLoaded'))
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
    showError(error, t('admin.errors.updateFailed'))
  }
}

onMounted(async () => {
  try {
    const response = await httpClient.get<{ user: UserDetailed }>(`/api/users/${props.userID}`)
    user.value = response.user
  } catch (error) {
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      logger.error(
        '[TimeoutError] Logout request timed out. Please check your network connection.',
      )
    }
    showError(error, t('admin.errors.fetchFailed'))
  }
})
</script>

<template>
  <Modal
    :model-value="true"
    :title="$t('admin.modal.title')"
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
          <dt class="mb-1 text-xs font-medium text-ink-secondary">{{ $t('admin.modal.createdAt') }}</dt>
          <dd class="m-0 text-ink [overflow-wrap:anywhere]">{{ formatDate(user.createdAt) }}</dd>
        </div>
        <div>
          <dt class="mb-1 text-xs font-medium text-ink-secondary">{{ $t('admin.modal.updatedAt') }}</dt>
          <dd class="m-0 text-ink [overflow-wrap:anywhere]">{{ formatDate(user.updatedAt) }}</dd>
        </div>
      </dl>
      <Button v-if="user.role !== 'admin'" @click="promoteToAdmin()">{{ $t('admin.modal.promote') }}</Button>
      <Button v-if="user.role === 'admin'" @click="revokeAdmin()">{{ $t('admin.modal.revoke') }}</Button>
      <Button color="alert" variant="outlined" @click="openDeleteConfirmation">{{ $t('admin.modal.delete') }}</Button>
      <Input class="mt-2" type="text" v-model="username" :placeholder="$t('admin.modal.updateUsernamePlaceholder')" />
      <Button @click="updateUsername">{{ $t('admin.modal.updateUsername') }}</Button>
    </div>

    <Modal
      v-model="confirmingDelete"
      :title="$t('admin.modal.deleteTitle')"
      size="small"
      :close-on-overlay="!deleting"
      :close-on-esc="!deleting"
    >
      <div class="flex flex-col gap-3">
        <p class="m-0 text-sm leading-normal">
          {{ $t('admin.modal.permanentlyDelete', { login: user?.login ?? '' }) }}
        </p>
        <p class="m-0 text-sm leading-normal text-ink-secondary">
          {{ $t('admin.modal.deleteWarning') }}
        </p>
        <Input
          v-model="deleteConfirmationName"
          :label="$t('admin.modal.typeToConfirm', { login: user?.login ?? '' })"
          type="text"
          :placeholder="$t('admin.modal.enterUsername')"
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
          {{ $t('common.cancel') }}
        </Button>
        <Button color="alert" :loading="deleting" :disabled="!canConfirmDelete" @click="deleteUser">
          {{ $t('admin.modal.delete') }}
        </Button>
      </template>
    </Modal>
  </Modal>
</template>
