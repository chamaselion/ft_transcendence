<template>
  <Modal
    :model-value="modelValue"
    title="Share Document"
    size="default"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <div class="share-modal">
      <!-- Add new collaborator section -->
      <section v-if="isOwner" class="share-modal__section">
        <h3 class="share-modal__section-title">Invite Collaborator</h3>
        <form class="share-modal__form" @submit.prevent="handleShare">
          <div class="share-modal__inputs">
            <Input
              v-model="email"
              type="email"
              placeholder="Enter user email (e.g. bob@example.com)"
              label="Collaborator Email"
              :disabled="loading"
              required
            />

            <label class="share-modal__select-label">
              <span class="share-modal__label-text">Permission</span>
              <select
                v-model="permission"
                class="share-modal__select"
                :disabled="loading"
              >
                <option value="editor">Editor (Can edit and write)</option>
                <option value="viewer">Viewer (Read-only)</option>
              </select>
            </label>
          </div>

          <div class="share-modal__actions">
            <Button
              type="submit"
              variant="elevated"
              size="small"
              :loading="loading"
              :disabled="!email.trim() || loading"
            >
              Add Collaborator
            </Button>
          </div>
        </form>

        <p v-if="error" class="share-modal__alert share-modal__alert--error">
          {{ error }}
        </p>
        <p v-if="successMessage" class="share-modal__alert share-modal__alert--success">
          {{ successMessage }}
        </p>
      </section>

      <section v-else class="share-modal__section">
        <p class="share-modal__hint">
          Only the document owner can manage shares and invite new collaborators.
        </p>
      </section>

      <!-- Existing collaborators section -->
      <section class="share-modal__section">
        <h3 class="share-modal__section-title">People with Access</h3>

        <div v-if="loadingShares" class="share-modal__muted">
          Loading collaborators...
        </div>

        <div v-else-if="shares.length === 0" class="share-modal__muted">
          No collaborators shared yet. Invite someone using their email above.
        </div>

        <ul v-else class="share-modal__list">
          <li v-for="share in shares" :key="share.userId" class="share-modal__item">
            <div class="share-modal__user-info">
              <span class="share-modal__user-login">{{ share.login }}</span>
              <span class="share-modal__user-email">{{ share.email }}</span>
            </div>

            <div class="share-modal__user-actions">
              <select
                v-if="isOwner"
                :value="share.permission"
                class="share-modal__select share-modal__select--compact"
                :disabled="loading"
                @change="handleUpdatePermission(share.userId, ($event.target as HTMLSelectElement).value as 'viewer' | 'editor')"
              >
                <option value="editor">Editor</option>
                <option value="viewer">Viewer</option>
              </select>
              <span v-else class="share-modal__badge">
                {{ share.permission }}
              </span>

              <Button
                v-if="isOwner"
                variant="outlined"
                color="alert"
                size="x-small"
                title="Revoke access"
                :disabled="loading"
                @click="handleRevoke(share.userId)"
              >
                Remove
              </Button>
            </div>
          </li>
        </ul>
      </section>

      <!-- Share link section -->
      <section class="share-modal__section share-modal__section--footer">
        <div class="share-modal__link-row">
          <Input
            :model-value="shareUrl"
            label="Room Link"
            readonly
          />
          <Button
            variant="outlined"
            size="small"
            @click="handleCopyLink"
          >
            {{ copied ? 'Copied!' : 'Copy Link' }}
          </Button>
        </div>
      </section>
    </div>
  </Modal>
</template>

<script lang="ts" setup>
import { ref, computed, watch } from 'vue'
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
const successMessage = ref<string | null>(null)
const copied = ref(false)

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
  if (!email.value.trim() || !props.documentId) return
  loading.value = true
  error.value = null
  successMessage.value = null

  try {
    await createShare(props.documentId, email.value.trim(), permission.value)
    successMessage.value = `Access granted to ${email.value.trim()} as ${permission.value}.`
    email.value = ''
    await fetchShares()
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to share document'
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
    error.value = err instanceof Error ? err.message : 'Failed to update share'
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
    error.value = err instanceof Error ? err.message : 'Failed to revoke share'
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

<style lang="css" scoped>
.share-modal {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.share-modal__section {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--border-subtle);
}

.share-modal__section--footer {
  border-bottom: none;
  padding-bottom: 0;
}

.share-modal__section-title {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--text-base);
}

.share-modal__form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.share-modal__inputs {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.share-modal__select-label {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.share-modal__label-text {
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.share-modal__select {
  padding: 8px 12px;
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  background-color: var(--bg-surface);
  color: var(--text-base);
  font-size: 0.875rem;
  outline: none;
  transition: border-color 0.15s ease;
}

.share-modal__select:focus {
  border-color: var(--color-primary);
}

.share-modal__select--compact {
  padding: 4px 8px;
  font-size: 0.8rem;
}

.share-modal__actions {
  display: flex;
  justify-content: flex-end;
}

.share-modal__alert {
  margin: 0;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 0.825rem;
}

.share-modal__alert--error {
  background-color: color-mix(in srgb, var(--color-alert, #ef4444) 12%, transparent);
  color: var(--color-alert, #ef4444);
  border: 1px solid var(--color-alert, #ef4444);
}

.share-modal__alert--success {
  background-color: color-mix(in srgb, var(--color-success, #22c55e) 12%, transparent);
  color: var(--color-success, #22c55e);
  border: 1px solid var(--color-success, #22c55e);
}

.share-modal__hint {
  margin: 0;
  color: var(--text-muted);
  font-size: 0.875rem;
}

.share-modal__muted {
  color: var(--text-muted);
  font-size: 0.875rem;
  font-style: italic;
  padding: 8px 0;
}

.share-modal__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 180px;
  overflow-y: auto;
}

.share-modal__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-radius: 8px;
  background-color: var(--bg-subtle);
}

.share-modal__user-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.share-modal__user-login {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-base);
}

.share-modal__user-email {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.share-modal__user-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.share-modal__badge {
  padding: 2px 8px;
  border-radius: 9999px;
  background-color: var(--bg-surface);
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--text-secondary);
}

.share-modal__link-row {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  width: 100%;
}
</style>
