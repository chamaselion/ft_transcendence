<script setup lang="ts">
import Button from '@/app/components/Button.vue'
import Icon from '@/app/components/Icon.vue'
import type { DocumentData } from '@/app/editor/document.api'
import { formatFullDate, formatRelativeTime } from '@/app/utils/date'
import { truncateTitle } from '@/utils/title'

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
  <div class="flex flex-col gap-4">
    <!-- Error message banner -->
    <div
      v-if="props.errorMessage"
      class="flex items-center justify-between rounded-lg border border-danger bg-danger/12 px-4 py-3 text-[0.9rem] text-danger"
    >
      <span>{{ props.errorMessage }}</span>
      <Button variant="outlined" size="x-small" @click="emit('retry')">{{ $t('common.retry') }}</Button>
    </div>

    <!-- Loading skeleton / state -->
    <div
      v-if="props.loading && props.documents.length === 0"
      class="flex flex-col items-center justify-center gap-3 px-4 py-16 text-[0.95rem] text-muted"
    >
      <div class="h-7 w-7 animate-spin rounded-full border-[3px] border-line border-t-brand" />
      <span>{{ $t('documents.loading') }}</span>
    </div>

    <!-- Empty states -->
    <div
      v-else-if="!props.loading && props.documents.length === 0"
      class="flex flex-col items-center justify-center rounded-xl border border-dashed border-line bg-surface/60 px-6 py-16 text-center"
    >
      <div class="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-subtle text-muted">
        <Icon name="FileText" :size="48" />
      </div>
      <h3 class="m-0 mb-2 text-xl font-semibold text-ink">
        {{ props.activeQuery ? $t('documents.emptyNoMatchTitle') : $t('documents.emptyTitle') }}
      </h3>
      <p class="m-0 mb-5 max-w-[420px] text-[0.9rem] text-ink-secondary">
        {{
          props.activeQuery
            ? $t('documents.emptyNoMatchDesc')
            : $t('documents.emptyDesc')
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
        {{ $t('documents.createDocument') }}
      </Button>
    </div>

    <!-- Documents List Table -->
    <div
      v-else
      class="overflow-hidden rounded-[10px] border border-line-subtle bg-surface shadow-[var(--shadow-sm)]"
    >
      <table class="w-full border-collapse text-left">
        <thead>
          <tr>
            <th
              class="w-[46%] border-b border-line-subtle bg-subtle px-4 py-3 text-[0.8rem] font-semibold tracking-[0.05em] text-ink-secondary uppercase max-md:w-[55%]"
            >
              {{ $t('documents.columnName') }}
            </th>
            <th
              class="w-[18%] border-b border-line-subtle bg-subtle px-4 py-3 text-[0.8rem] font-semibold tracking-[0.05em] text-ink-secondary uppercase max-md:w-[25%]"
            >
              {{ $t('documents.columnOwnership') }}
            </th>
            <th
              class="w-[20%] border-b border-line-subtle bg-subtle px-4 py-3 text-[0.8rem] font-semibold tracking-[0.05em] text-ink-secondary uppercase max-md:hidden"
            >
              {{ $t('documents.columnChanged') }}
            </th>
            <th
              class="w-[16%] border-b border-line-subtle bg-subtle px-4 py-3 text-right text-[0.8rem] font-semibold tracking-[0.05em] text-ink-secondary uppercase max-md:w-[20%]"
            >
              {{ $t('documents.columnActions') }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="doc in props.documents"
            :key="doc.id"
            class="group cursor-pointer border-b border-line-subtle transition-colors duration-150 last:border-0 hover:bg-[color-mix(in_srgb,var(--text-primary)_4%,var(--bg-surface))]"
            @click="emit('open', doc.id)"
          >
            <!-- Document Name -->
            <td class="min-w-0 px-4 py-3.5 align-middle">
              <div class="flex min-w-0 items-center gap-3">
                <div
                  class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand/12 text-brand"
                >
                  <Icon name="FileText" :size="20" />
                </div>
                <div class="flex min-w-0 flex-col gap-0.5 overflow-hidden">
                  <span
                    class="truncate text-[0.95rem] font-semibold text-ink group-hover:text-brand"
                    :title="doc.title || $t('common.untitledDocument')"
                  >
                    {{ truncateTitle(doc.title || $t('common.untitledDocument')) }}
                  </span>
                  <span class="font-mono text-xs text-muted">{{ $t('documents.idLabel') }} {{ doc.id.slice(0, 8) }}...</span>
                </div>
              </div>
            </td>

            <!-- Owned / Shared -->
            <td class="px-4 py-3.5 align-middle">
              <div class="flex flex-col items-start gap-0.5">
                <span
                  v-if="doc.permission === 'owner'"
                  class="inline-flex items-center rounded-full bg-success/15 px-2 py-0.5 text-xs font-semibold text-success capitalize"
                >
                  {{ $t('documents.badgeOwned') }}
                </span>
                <span
                  v-else
                  class="inline-flex items-center rounded-full bg-warning/15 px-2 py-0.5 text-xs font-semibold text-warning capitalize"
                  :title="doc.owner ? $t('documents.sharedBy', { login: doc.owner.login }) : $t('documents.sharedDocument')"
                >
                  {{ $t('documents.badgeShared') }}
                </span>

                <span
                  v-if="doc.permission !== 'owner' && doc.owner"
                  class="text-xs text-muted"
                  :title="$t('documents.createdBy', { login: doc.owner.login })"
                >
                  {{ $t('documents.by', { login: doc.owner.login }) }}
                </span>
              </div>
            </td>

            <!-- Last Changed -->
            <td class="px-4 py-3.5 align-middle max-md:hidden">
              <span class="text-sm text-ink-secondary" :title="formatFullDate(doc.updatedAt)">
                {{ formatRelativeTime(doc.updatedAt) }}
              </span>
            </td>

            <!-- Actions: if owner, icon buttons to share or delete -->
            <td class="px-4 py-3.5 text-right align-middle" @click.stop>
              <div
                v-if="doc.permission === 'owner'"
                class="inline-flex items-center justify-end gap-1.5"
              >
                <Button
                  variant="outlined"
                  size="small"
                  square
                  :title="$t('documents.shareDocument')"
                  :aria-label="$t('documents.shareDocument')"
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
                  :title="$t('documents.deleteDocument')"
                  :aria-label="$t('documents.deleteDocument')"
                  @click.stop="emit('delete', doc)"
                >
                  <template #icon>
                    <Icon name="Trash" :size="16" />
                  </template>
                </Button>
              </div>
              <div v-else class="inline-flex items-center justify-end">
                <span
                  class="rounded bg-subtle px-1.5 py-0.5 text-xs text-muted capitalize"
                  :title="$t('documents.roleTitle', { role: doc.permission })"
                >
                  {{ $t(`editor.roles.${doc.permission}`) }}
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
