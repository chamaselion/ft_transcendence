<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { httpClient } from '@/auth/auth.api'
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
    console.error('Failed to fetch users:', error)
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
      <label for="limit">Users per page:</label>
      <select
        v-model="limit"
        @change="fetchUsers(limit, 0)"
      >
        <option :value="10">10</option>
        <option :value="20">20</option>
        <option :value="50">50</option>
      </select>
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
      <label for="sort">Sort by:</label>
      <select
        v-model="sortOption"
        @change="fetchUsers(limit, 0)"
      >
        <option value="createdAt">Created At</option>
        <option value="login">Username</option>
        <option value="email">Email</option>
      </select>
    </div>

    <table>
      <tr>
        <td>User ID</td>
        <td>Username</td>
        <td>Email</td>
        <td>Role</td>
      </tr>
      <tr
        v-for="user in users"
        :key="user.id"
        class="user-listing"
        @click="openModal(user)"
      >
        <td>{{ user.id }}</td>
        <td>{{ user.login }}</td>
        <td>{{ user.email }}</td>
        <td :class="`user-role-${user.role}`">{{ user.role }}</td>
      </tr>
    </table>
  </div>

  <UserManagmentModal
    v-if="lastClickedUser"
    :key="lastClickedUser.id"
    :user="lastClickedUser"
    @close="closeModal"
  />
</template>

<style scoped>
.listing-header-options {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
  background-color: var(--bg-subtle);
  padding: 12px;
  border-radius: 8px;
}

.user-listing-view {
  margin: 12px 24px;
}

table {
  width: 100%;
  border-collapse: collapse;
}

td {
  border: 1px solid #ddd;
  padding: 8px;
}

.user-listing:hover {
  background-color: var(--bg-subtle);
}

th {
  padding-top: 12px;
  padding-bottom: 12px;
  text-align: left;
  color: var(--text-primary);
}

.user-role-admin {
  color: red;
}
.user-role-user {
  color: blue;
}
</style>
