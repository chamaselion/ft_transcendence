<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { httpClient, HttpError } from '@/auth/auth.api'
import type { User } from '@/auth/types/user'
import { type Pagination } from '@/types/pagination'
import { logger } from '@/utils/logger'
import UserManagmentModal from './UserManagmentModal.vue'

interface ResponseShape {
  users: User[]
  pagination: Pagination
}

const limit = ref<number>(10)

const res = ref<ResponseShape | null>(null)
const users = ref<User[] | null>(null)
const pagination = ref<Pagination | null>(null)
const sortOption = ref<string>('createdAt')
const lastClickedUser = ref<User | null>(null)

const hasNext = computed(() => {
  const p = pagination.value
  return p !== null && p.offset + p.limit < p.total
})

const hasPrevious = computed(() => {
  return (pagination.value?.offset ?? 0) > 0
})

async function fetchUsers(limit: number, offset: number) {
  try {
    res.value = await httpClient.get<ResponseShape>(
      `/api/users?limit=${limit}&offset=${offset}&sort=${sortOption.value}`,
    )
    users.value = res.value.users
    pagination.value = res.value.pagination
  } catch (error) {
    if (error instanceof HttpError) {
      logger.error('HTTP error while fetching users:', error.message)
    } else {
      logger.error('Unexpected error while fetching users:', error)
    }
  }
}

function currentPage(): number {
  if (!pagination.value) return 0
  return Math.floor(pagination.value.offset) + limit.value
}

const rangeStart = computed(() => {
  const p = pagination.value
  return p && users.value?.length ? p.offset + 1 : 0
})

const rangeEnd = computed(() => {
  const p = pagination.value
  return p && users.value?.length ? Math.min(p.offset + users.value.length, p.total) : 0
})

const openModal = (user: User) => {
  lastClickedUser.value = user
}

const closeModal = () => {
  lastClickedUser.value = null
  window.location.reload() // NOTE: unclean refresh to update the user list after changes.
  //Considering to use a more reactive approach in the future.
}

onMounted(async () => {
  await fetchUsers(10, 0)
})
</script>

<template>
  <div class="mx-6 my-3 min-w-0 text-ink max-sm:mx-3">
    <div
      class="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-line-subtle bg-subtle p-4 text-sm max-sm:flex-col max-sm:items-stretch max-sm:p-3"
    >
      <p v-if="pagination" class="m-0 mr-auto leading-normal text-ink-secondary">
        {{ $t('admin.users.showing', { from: rangeStart, to: rangeEnd, total: pagination.total }) }}
      </p>
      <div class="flex flex-wrap items-center gap-2">
        <label class="font-medium text-ink-secondary" for="limit">{{
          $t('admin.users.perPage')
        }}</label>
        <select
          id="limit"
          v-model="limit"
          class="min-h-[38px] cursor-pointer rounded-md border border-line bg-surface px-3 py-2 text-ink transition-[background-color,border-color] duration-200 [font:inherit] hover:enabled:border-brand hover:enabled:bg-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand max-sm:min-w-0 max-sm:flex-1"
          @change="fetchUsers(limit, 0)"
        >
          <option :value="10">10</option>
          <option :value="20">20</option>
          <option :value="50">50</option>
        </select>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <button
          class="min-h-[38px] cursor-pointer rounded-md border border-line bg-surface px-3 py-2 font-medium text-ink transition-[background-color,border-color] duration-200 [font:inherit] hover:enabled:border-brand hover:enabled:bg-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-50 max-sm:flex-1"
          :disabled="!hasNext"
          @click="fetchUsers(limit, currentPage())"
        >
          {{ $t('admin.users.nextPage') }}
        </button>
        <button
          class="min-h-[38px] cursor-pointer rounded-md border border-line bg-surface px-3 py-2 font-medium text-ink transition-[background-color,border-color] duration-200 [font:inherit] hover:enabled:border-brand hover:enabled:bg-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-50 max-sm:flex-1"
          :disabled="!hasPrevious"
          @click="fetchUsers(limit, currentPage() - limit * 2)"
        >
          {{ $t('admin.users.previousPage') }}
        </button>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <label class="font-medium text-ink-secondary" for="sort">{{
          $t('admin.users.sortBy')
        }}</label>
        <select
          id="sort"
          v-model="sortOption"
          class="min-h-[38px] cursor-pointer rounded-md border border-line bg-surface px-3 py-2 text-ink transition-[background-color,border-color] duration-200 [font:inherit] hover:enabled:border-brand hover:enabled:bg-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand max-sm:min-w-0 max-sm:flex-1"
          @change="fetchUsers(limit, 0)"
        >
          <option value="createdAt">{{ $t('admin.users.createdAt') }}</option>
          <option value="login">{{ $t('admin.users.username') }}</option>
          <option value="email">{{ $t('admin.users.userEmail') }}</option>
        </select>
      </div>
    </div>

    <div class="overflow-x-auto rounded-xl border border-line-subtle bg-surface">
      <table class="w-full min-w-[600px] border-collapse text-sm leading-normal">
        <thead>
          <tr>
            <th
              scope="col"
              class="border-b border-line-subtle bg-subtle px-4 py-3.5 text-left font-semibold whitespace-nowrap text-ink-secondary [overflow-wrap:anywhere]"
            >
              {{ $t('admin.users.userId') }}
            </th>
            <th
              scope="col"
              class="border-b border-line-subtle bg-subtle px-4 py-3.5 text-left font-semibold whitespace-nowrap text-ink-secondary [overflow-wrap:anywhere]"
            >
              {{ $t('admin.users.username') }}
            </th>
            <th
              scope="col"
              class="border-b border-line-subtle bg-subtle px-4 py-3.5 text-left font-semibold whitespace-nowrap text-ink-secondary [overflow-wrap:anywhere]"
            >
              {{ $t('admin.users.userEmail') }}
            </th>
            <th
              scope="col"
              class="border-b border-line-subtle bg-subtle px-4 py-3.5 text-left font-semibold whitespace-nowrap text-ink-secondary [overflow-wrap:anywhere]"
            >
              {{ $t('admin.users.role') }}
            </th>
          </tr>
        </thead>
        <tbody class="[&>tr:last-child>td]:border-0">
          <tr
            v-for="user in users"
            :key="user.id"
            class="cursor-pointer transition-colors duration-200 hover:bg-subtle"
            @click="openModal(user)"
          >
            <td class="border-b border-line-subtle px-4 py-3.5 text-left [overflow-wrap:anywhere]">
              {{ user.id }}
            </td>
            <td class="border-b border-line-subtle px-4 py-3.5 text-left [overflow-wrap:anywhere]">
              {{ user.login }}
            </td>
            <td class="border-b border-line-subtle px-4 py-3.5 text-left [overflow-wrap:anywhere]">
              {{ user.email }}
            </td>
            <td class="border-b border-line-subtle px-4 py-3.5 text-left [overflow-wrap:anywhere]">
              <span
                class="inline-block rounded-full px-2.5 py-[3px] text-xs font-semibold capitalize"
                :class="
                  user.role === 'admin' ? 'bg-danger/12 text-danger' : 'bg-brand/12 text-brand'
                "
                >{{ user.role }}</span
              >
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <UserManagmentModal
    v-if="lastClickedUser"
    :key="lastClickedUser.id"
    :userID="lastClickedUser.id"
    @close="closeModal"
  />
</template>
