<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { httpClient, HttpError } from '@/auth/auth.api'
import type { User } from '@/auth/types/user'
import { type Pagination } from '@/types/pagination'
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
      console.error('HTTP error while fetching users:', error.message)
    } else {
      console.error('Unexpected error while fetching users:', error)
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
}

onMounted(async () => {
  await fetchUsers(10, 0)
})
</script>

<template>
  <div class="user-listing-view">
    <div class="listing-header-options">
      <p v-if="pagination">
        Showing {{ rangeStart }}–{{ rangeEnd }} of {{ pagination.total }} users
      </p>
      <div class="listing-filter">
        <label for="limit">Users per page:</label>
        <select
          id="limit"
          v-model="limit"
          @change="fetchUsers(limit, 0)"
        >
          <option :value="10">10</option>
          <option :value="20">20</option>
          <option :value="50">50</option>
        </select>
      </div>
      <div class="listing-pagination">
        <button
          @click="fetchUsers(limit, currentPage())"
          :disabled="!hasNext"
        >
          Next Page
        </button>
        <button
          @click="fetchUsers(limit, currentPage() - limit * 2)"
          :disabled="!hasPrevious"
        >
          Previous Page
        </button>
      </div>
      <div class="listing-filter">
        <label for="sort">Sort by:</label>
        <select
          id="sort"
          v-model="sortOption"
          @change="fetchUsers(limit, 0)"
        >
          <option value="createdAt">Created At</option>
          <option value="login">Username</option>
          <option value="email">Email</option>
        </select>
      </div>
    </div>

    <div class="listing-table-wrapper">
      <table>
        <thead>
          <tr>
            <th scope="col">User ID</th>
            <th scope="col">Username</th>
            <th scope="col">Email</th>
            <th scope="col">Role</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="user in users"
            :key="user.id"
            class="user-listing"
            @click="openModal(user)"
          >
            <td>{{ user.id }}</td>
            <td>{{ user.login }}</td>
            <td>{{ user.email }}</td>
            <td>
              <span
                class="user-role"
                :class="`user-role-${user.role}`"
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

<style scoped>
.user-listing-view {
  min-width: 0;
  margin: 12px 24px;
  color: var(--text-primary);
}

.listing-header-options {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
  padding: 16px;
  border: 1px solid var(--border-subtle);
  border-radius: 12px;
  background-color: var(--bg-subtle);
  font-size: 14px;
}

.listing-header-options p {
  margin: 0 auto 0 0;
  color: var(--text-secondary);
  line-height: 1.5;
}

.listing-filter,
.listing-pagination {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.listing-filter label {
  color: var(--text-secondary);
  font-weight: 500;
}

.listing-header-options select,
.listing-header-options button {
  min-height: 38px;
  padding: 8px 12px;
  border: 1px solid var(--border-default);
  border-radius: 6px;
  background-color: var(--bg-surface);
  color: var(--text-primary);
  font: inherit;
  cursor: pointer;
  transition:
    background-color 0.2s,
    border-color 0.2s;
}

.listing-header-options button {
  font-weight: 500;
}

.listing-header-options select:hover,
.listing-header-options button:hover:not(:disabled) {
  border-color: var(--color-primary);
  background-color: var(--bg-subtle);
}

.listing-header-options select:focus-visible,
.listing-header-options button:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.listing-header-options button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.listing-table-wrapper {
  overflow-x: auto;
  border: 1px solid var(--border-subtle);
  border-radius: 12px;
  background-color: var(--bg-surface);
}

table {
  width: 100%;
  min-width: 600px;
  border-collapse: collapse;
  font-size: 14px;
  line-height: 1.5;
}

th,
td {
  padding: 14px 16px;
  text-align: left;
  overflow-wrap: anywhere;
}

th {
  border-bottom: 1px solid var(--border-subtle);
  background-color: var(--bg-subtle);
  color: var(--text-secondary);
  font-weight: 600;
  white-space: nowrap;
}

td {
  border-bottom: 1px solid var(--border-subtle);
}

tbody tr:last-child td {
  border-bottom: none;
}

.user-listing {
  cursor: pointer;
  transition: background-color 0.2s;
}

.user-listing:hover {
  background-color: var(--bg-subtle);
}

.user-role {
  display: inline-block;
  padding: 3px 10px;
  border-radius: 999px;
  background-color: var(--bg-subtle);
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 600;
  text-transform: capitalize;
}

.user-role-admin {
  background-color: color-mix(in srgb, var(--color-alert) 12%, transparent);
  color: var(--color-alert);
}

.user-role-user {
  background-color: color-mix(in srgb, var(--color-primary) 12%, transparent);
  color: var(--color-primary);
}

@media (max-width: 640px) {
  .user-listing-view {
    margin: 12px;
  }

  .listing-header-options {
    align-items: stretch;
    flex-direction: column;
    padding: 12px;
  }

  .listing-filter select {
    flex: 1;
    min-width: 0;
  }

  .listing-pagination button {
    flex: 1;
  }
}
</style>
