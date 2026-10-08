<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { httpClient } from '@/auth/auth.api'
import type { User } from '@/auth/types/user'
import { type Pagination } from '@/types/pagination'

interface ResponseShape {
  users: User[]
  pagination: Pagination
}

const limit = ref<number>(10)

const res = ref<ResponseShape | null>(null)
const users = ref<User[] | null>(null)
const pagination = ref<Pagination | null>(null)
const nextPageBtn = ref<boolean>(true)
const prevPageBtn = ref<boolean>(false)

async function fetchUsers(limit: number, offset: number) {
  try {
    res.value = await httpClient.get<ResponseShape>(
      `/api/users?limit=${limit}&offset=${offset}&sort=login`,
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

function displayCurrentPage(): number {
  if (pagination.value === null) return 0
  const tmp = pagination.value.limit + pagination.value.offset
  if (pagination.value.total < tmp) {
    nextPageBtn.value = false
    return pagination.value.total
  }
  if (tmp == 10) {
    prevPageBtn.value = false
  } else {
    prevPageBtn.value = true
  }
  nextPageBtn.value = true
  return tmp
}

onMounted(async () => {
  await fetchUsers(10, 0)
})
</script>

<template>
  <div class="user-listing-view">
    <div class="listing-header-options">
      <p v-if="pagination">Listing {{ displayCurrentPage() }} of {{ pagination.total }} users</p>
      <label for="limit">Users per page:</label>
      <select
        v-model="limit"
        @change="fetchUsers(limit, 0)"
      >
        <option value="10">10</option>
        <option value="20">20</option>
        <option value="50">50</option>
      </select>
      <button
        @click="fetchUsers(limit, currentPage())"
        :disabled="!nextPageBtn"
      >
        Next Page
      </button>
      <button
        @click="fetchUsers(limit, currentPage() - limit)"
        :disabled="!prevPageBtn"
      >
        Previous Page
      </button>
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
      >
        <td>{{ user.id }}</td>
        <td>{{ user.login }}</td>
        <td>{{ user.email }}</td>
        <td :class="`user-role-${user.role}`">{{ user.role }}</td>
      </tr>
    </table>
  </div>
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
