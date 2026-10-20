<script setup lang="ts">
import Button from '@/app/components/Button.vue'
import Icon from '@/app/components/Icon.vue'
import type { DocumentData } from '@/app/editor/document.api'
import { formatFullDate, formatRelativeTime } from '@/app/utils/date'

const props = defineProps<{
  documents: DocumentData[]
  loading: boolean
  errorMessage: string | null
  activeQuery: string
}>()

const emit = defineEmits<{
  retry: []
  create: []
  open: [docId: string]
  share: [doc: DocumentData]
  delete: [doc: DocumentData]
}>()
</script>

<template>
  <div>
    <!-- Error message banner -->
    <div v-if="props.errorMessage" class="directory__error">
      <span>{{ props.errorMessage }}</span>
      <Button variant="outlined" size="x-small" @click="emit('retry')">Retry</Button>
    </div>

    <!-- Loading skeleton / state -->
    <div v-if="props.loading && props.documents.length === 0" class="directory__loading">
      <div class="directory__loader-spinner" />
      <span>Loading available documents...</span>
    </div>

    <!-- Empty states -->
    <div v-else-if="!props.loading && props.documents.length === 0" class="directory__empty">
      <div class="directory__empty-icon">
        <Icon name="FileText" :size="48" />
      </div>
      <h3 class="directory__empty-title">
        {{ props.activeQuery ? 'No matching documents' : 'No documents yet' }}
      </h3>
      <p class="directory__empty-desc">
        {{
          props.activeQuery
            ? 'Try adjusting your search terms or filter scope.'
            : 'Get started by creating your first document to edit and collaborate in real-time.'
        }}
      </p>
      <Button
        v-if="!props.activeQuery"
        variant="elevated"
        color="primary"
        size="small"
        @click="emit('create')"
      >
        <template #prepend>
          <Icon name="Plus" :size="16" />
        </template>
        Create Document
      </Button>
    </div>

    <!-- Documents List Table -->
    <div v-else class="directory__table-wrapper">
      <table class="directory__table">
        <thead>
          <tr>
            <th class="directory__th directory__th--name">Document Name</th>
            <th class="directory__th directory__th--status">Ownership</th>
            <th class="directory__th directory__th--changed">Last Changed</th>
            <th class="directory__th directory__th--actions">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="doc in props.documents"
            :key="doc.id"
            class="directory__row"
            @click="emit('open', doc.id)"
          >
            <!-- Document Name -->
            <td class="directory__td directory__td--name">
              <div class="directory__doc-info">
                <div class="directory__doc-icon">
                  <Icon name="FileText" :size="20" />
                </div>
                <div class="directory__doc-text">
                  <span class="directory__doc-title" :title="doc.title || 'Untitled Document'">
                    {{ doc.title || 'Untitled Document' }}
                  </span>
                  <span class="directory__doc-id">ID: {{ doc.id.slice(0, 8) }}...</span>
                </div>
              </div>
            </td>

            <!-- Owned / Shared -->
            <td class="directory__td directory__td--status">
              <div class="directory__ownership">
                <span
                  v-if="doc.permission === 'owner'"
                  class="directory__badge directory__badge--owned"
                >
                  Owned
                </span>
                <span
                  v-else
                  class="directory__badge directory__badge--shared"
                  :title="doc.owner ? `Shared by ${doc.owner.login}` : 'Shared document'"
                >
                  Shared
                </span>

                <span
                  v-if="doc.permission !== 'owner' && doc.owner"
                  class="directory__owner-note"
                  :title="`Document created by ${doc.owner.login}`"
                >
                  by {{ doc.owner.login }}
                </span>
              </div>
            </td>

            <!-- Last Changed -->
            <td class="directory__td directory__td--changed">
              <span class="directory__time" :title="formatFullDate(doc.updatedAt)">
                {{ formatRelativeTime(doc.updatedAt) }}
              </span>
            </td>

            <!-- Actions: if owner, icon buttons to share or delete -->
            <td class="directory__td directory__td--actions" @click.stop>
              <div v-if="doc.permission === 'owner'" class="directory__action-buttons">
                <Button
                  variant="outlined"
                  size="small"
                  square
                  title="Share document"
                  aria-label="Share document"
                  @click.stop="emit('share', doc)"
                >
                  <template #icon>
                    <Icon name="Share" :size="16" />
                  </template>
                </Button>
                <Button
                  variant="outlined"
                  color="alert"
                  size="small"
                  square
                  title="Delete document"
                  aria-label="Delete document"
                  @click.stop="emit('delete', doc)"
                >
                  <template #icon>
                    <Icon name="Trash" :size="16" />
                  </template>
                </Button>
              </div>
              <div v-else class="directory__non-owner-placeholder">
                <span class="directory__role-pill" :title="`Your role: ${doc.permission}`">
                  {{ doc.permission }}
                </span>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
      <slot name="footer" />
    </div>
  </div>
</template>

<style scoped>
/* Error State */
.directory__error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-radius: 8px;
  background-color: color-mix(in srgb, var(--color-alert) 12%, transparent);
  border: 1px solid var(--color-alert);
  color: var(--color-alert);
  font-size: 0.9rem;
}

/* Loading State */
.directory__loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 64px 16px;
  color: var(--text-muted);
  font-size: 0.95rem;
}

.directory__loader-spinner {
  width: 28px;
  height: 28px;
  border: 3px solid var(--border-default);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

/* Empty State */
.directory__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 64px 24px;
  border: 1px dashed var(--border-default);
  border-radius: 12px;
  background-color: color-mix(in srgb, var(--bg-surface) 60%, transparent);
}

.directory__empty-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background-color: var(--bg-subtle);
  color: var(--text-muted);
  margin-bottom: 16px;
}

.directory__empty-title {
  margin: 0 0 8px;
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text-primary);
}

.directory__empty-desc {
  margin: 0 0 20px;
  font-size: 0.9rem;
  color: var(--text-secondary);
  max-width: 420px;
}

/* Table Wrapper */
.directory__table-wrapper {
  background-color: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: 10px;
  overflow: hidden;
  box-shadow: var(--shadow-sm);
}

.directory__table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
}

.directory__th {
  padding: 12px 16px;
  background-color: var(--bg-subtle);
  color: var(--text-secondary);
  font-size: 0.8rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-bottom: 1px solid var(--border-subtle);
}

.directory__th--name {
  width: 46%;
}

.directory__th--status {
  width: 18%;
}

.directory__th--changed {
  width: 20%;
}

.directory__th--actions {
  width: 16%;
  text-align: right;
}

.directory__row {
  cursor: pointer;
  transition: background-color 0.15s ease;
  border-bottom: 1px solid var(--border-subtle);
}

.directory__row:last-child {
  border-bottom: none;
}

.directory__row:hover {
  background-color: color-mix(in srgb, var(--text-primary) 4%, var(--bg-surface));
}

.directory__td {
  padding: 14px 16px;
  vertical-align: middle;
}

.directory__td--name {
  min-width: 0;
}

.directory__doc-info {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.directory__doc-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background-color: color-mix(in srgb, var(--color-primary) 12%, transparent);
  color: var(--color-primary);
  flex-shrink: 0;
}

.directory__doc-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  overflow: hidden;
}

.directory__doc-title {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.directory__row:hover .directory__doc-title {
  color: var(--color-primary);
}

.directory__doc-id {
  font-size: 0.75rem;
  color: var(--text-muted);
  font-family: monospace;
}

/* Ownership badges */
.directory__ownership {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
}

.directory__badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: capitalize;
}

.directory__badge--owned {
  background-color: color-mix(in srgb, var(--color-good) 15%, transparent);
  color: var(--color-good);
}

.directory__badge--shared {
  background-color: color-mix(in srgb, var(--color-warn) 15%, transparent);
  color: var(--color-warn);
}

.directory__owner-note {
  font-size: 0.75rem;
  color: var(--text-muted);
}

/* Changed column */
.directory__time {
  font-size: 0.875rem;
  color: var(--text-secondary);
}

/* Actions column */
.directory__td--actions {
  text-align: right;
}

.directory__action-buttons {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
}

.directory__action-buttons :deep(.btn) {
  margin: 0;
}

.directory__non-owner-placeholder {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
}

.directory__role-pill {
  font-size: 0.75rem;
  padding: 2px 6px;
  border-radius: 4px;
  background-color: var(--bg-subtle);
  color: var(--text-muted);
  text-transform: capitalize;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .directory__th--changed,
  .directory__td--changed {
    display: none;
  }

  .directory__th--name {
    width: 55%;
  }

  .directory__th--status {
    width: 25%;
  }

  .directory__th--actions {
    width: 20%;
  }
}
</style>
