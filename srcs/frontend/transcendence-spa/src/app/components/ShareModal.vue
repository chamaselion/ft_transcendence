<template>
  <Modal
    :model-value="modelValue"
    :title="$t('share.title')"
    size="default"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <div class="flex flex-col gap-5">
      <!-- Add new collaborator section -->
      <section v-if="isOwner" class="flex flex-col gap-2.5 border-b border-line-subtle pb-4">
        <h3 class="m-0 text-[0.95rem] font-semibold text-ink">{{ $t('share.inviteTitle') }}</h3>
        <form class="flex flex-col gap-3" @submit.prevent="handleShare">
          <div class="flex flex-col gap-2.5">
            <Input
              v-model="email"
              type="email"
              :placeholder="$t('share.emailPlaceholder')"
              :label="$t('share.emailLabel')"
              :disabled="loading"
              required
              :error="emailError"
              @blur="validateCollaboratorEmail"
            />

            <label class="flex flex-col gap-1.5">
              <span class="text-sm text-ink-secondary">{{ $t('share.permission') }}</span>
              <select
                v-model="permission"
                class="rounded-lg border border-line-subtle bg-surface px-3 py-2 text-sm text-ink outline-none transition-colors duration-150 focus:border-brand disabled:cursor-not-allowed disabled:opacity-50"
                :disabled="loading"
              >
                <option value="editor">{{ $t('share.permissionEditorLong') }}</option>
                <option value="viewer">{{ $t('share.permissionViewerLong') }}</option>
              </select>
            </label>
          </div>

          <div class="flex justify-end">
            <Button
              type="submit"
              variant="elevated"
              size="small"
              :loading="loading"
              :disabled="!email.trim() || loading"
            >
              {{ $t('share.addCollaborator') }}
            </Button>
          </div>
        </form>

        <p
          v-if="error"
          class="m-0 rounded-md border border-danger bg-danger/12 px-3 py-2 text-[0.825rem] text-danger"
        >
          {{ error }}
        </p>
        <p
          v-if="successMessage"
          class="m-0 rounded-md border border-success bg-success/12 px-3 py-2 text-[0.825rem] text-success"
        >
          {{ successMessage }}
        </p>
      </section>

      <section v-else class="flex flex-col gap-2.5 border-b border-line-subtle pb-4">
        <p class="m-0 text-sm text-muted">
          {{ $t('share.ownerOnly') }}
        </p>
      </section>

      <!-- Existing collaborators section -->
      <section class="flex flex-col gap-2.5 border-b border-line-subtle pb-4">
        <h3 class="m-0 text-[0.95rem] font-semibold text-ink">{{ $t('share.peopleWithAccess') }}</h3>

        <div v-if="loadingShares" class="px-0 py-2 text-sm text-muted italic">
          {{ $t('share.loading') }}
        </div>

        <div v-else-if="shares.length === 0" class="px-0 py-2 text-sm text-muted italic">
          {{ $t('share.empty') }}
        </div>

        <ul v-else class="m-0 flex max-h-[180px] list-none flex-col gap-2 overflow-y-auto p-0">
          <li
            v-for="share in shares"
            :key="share.userId"
            class="flex items-center justify-between rounded-lg bg-subtle px-3 py-2"
          >
            <div class="flex flex-col gap-0.5">
              <span class="text-sm font-semibold text-ink">{{ share.login }}</span>
              <span class="text-xs text-muted">{{ share.email }}</span>
            </div>

            <div class="flex items-center gap-2">
              <select
                v-if="isOwner"
                :value="share.permission"
                class="rounded-lg border border-line-subtle bg-surface px-2 py-1 text-[0.8rem] text-ink outline-none transition-colors duration-150 focus:border-brand disabled:cursor-not-allowed disabled:opacity-50"
                :disabled="loading"
                @change="
                  handleUpdatePermission(
                    share.userId,
                    ($event.target as HTMLSelectElement).value as 'viewer' | 'editor',
                  )
                "
              >
                <option value="editor">{{ $t('share.permissionEditor') }}</option>
                <option value="viewer">{{ $t('share.permissionViewer') }}</option>
              </select>
              <span
                v-else
                class="rounded-full bg-surface px-2 py-0.5 text-xs font-medium text-ink-secondary"
              >
                {{ share.permission }}
              </span>

              <Button
                v-if="isOwner"
                variant="outlined"
                color="alert"
                size="x-small"
                :title="$t('share.revokeAccess')"
                :disabled="loading"
                @click="handleRevoke(share.userId)"
              >
                {{ $t('common.remove') }}
              </Button>
            </div>
          </li>
        </ul>
      </section>

      <!-- Share link section -->
      <section class="flex flex-col gap-2.5 pb-0">
        <div class="flex w-full items-end gap-2">
          <Input :model-value="shareUrl" :label="$t('share.roomLink')" readonly />
          <Button variant="outlined" size="small" @click="handleCopyLink">
            {{ copied ? $t('share.copied') : $t('share.copyLink') }}
          </Button>
        </div>
      </section>
    </div>
  </Modal>
</template>

<script lang="ts" setup>
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Modal from '@/app/components/Modal.vue'
import Button from '@/app/components/Button.vue'
import Input from '@/app/components/Input.vue'
import {
  listShares,
  createShare,
  updateShare,
  deleteShare,
  type ShareData,
} from '@/app/editor/document.api'
import { validateEmail } from '@/utils/validation'

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    documentId: string
    isOwner?: boolean
  }>(),
  {
    isOwner: true,
  },
)

defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const shares = ref<ShareData[]>([])
const email = ref('')
const permission = ref<'viewer' | 'editor'>('editor')
const loading = ref(false)
const loadingShares = ref(false)
const error = ref<string | null>(null)
const emailError = ref('')

const validateCollaboratorEmail = () => {
  const result = validateEmail(email.value, t('share.emailLabel'))
  emailError.value = result.error ?? ''
  return result
}
const successMessage = ref<string | null>(null)
const copied = ref(false)

const { t } = useI18n()

const permissionLabelKeys = {
  editor: 'share.permissionEditor',
  viewer: 'share.permissionViewer',
} as const

const shareUrl = computed(() => {
  if (typeof window === 'undefined') return ''
  return `${window.location.origin}/editor/${props.documentId}`
})

async function fetchShares() {
  if (!props.documentId || !props.isOwner) return
  loadingShares.value = true
  try {
    shares.value = await listShares(props.documentId)
  } catch (err) {
    console.error('Failed to load shares:', err)
  } finally {
    loadingShares.value = false
  }
}

async function handleShare() {
  if (!props.documentId) return
  const result = validateCollaboratorEmail()
  if (result.error) return
  loading.value = true
  error.value = null
  successMessage.value = null

  try {
    await createShare(props.documentId, result.value, permission.value)
    successMessage.value = t('share.accessGranted', {
      email: email.value.trim(),
      permission: t(permissionLabelKeys[permission.value]),
    })
    email.value = ''
    emailError.value = ''
    await fetchShares()
  } catch (err) {
    error.value = err instanceof Error ? err.message : t('share.failedShare')
  } finally {
    loading.value = false
  }
}

async function handleUpdatePermission(userId: string, newPermission: 'viewer' | 'editor') {
  if (!props.documentId) return
  loading.value = true
  error.value = null

  try {
    await updateShare(props.documentId, userId, newPermission)
    await fetchShares()
  } catch (err) {
    error.value = err instanceof Error ? err.message : t('share.failedUpdate')
  } finally {
    loading.value = false
  }
}

async function handleRevoke(userId: string) {
  if (!props.documentId) return
  loading.value = true
  error.value = null

  try {
    await deleteShare(props.documentId, userId)
    await fetchShares()
  } catch (err) {
    error.value = err instanceof Error ? err.message : t('share.failedRevoke')
  } finally {
    loading.value = false
  }
}

async function handleCopyLink() {
  if (!shareUrl.value) return
  try {
    await navigator.clipboard.writeText(shareUrl.value)
    copied.value = true
    setTimeout(() => {
      copied.value = false
    }, 2000)
  } catch {
    copied.value = false
  }
}

watch(
  () => props.modelValue,
  (isOpen) => {
    if (isOpen) {
      error.value = null
      successMessage.value = null
      fetchShares()
    }
  },
  { immediate: true },
)
</script>
