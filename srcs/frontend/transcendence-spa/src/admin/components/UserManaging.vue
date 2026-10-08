<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { httpClient } from '@/auth/auth.api'
import type { User } from '@/auth/types/user'
import { type Pagination } from '@/types/pagination'

interface ResponseShape {
  users: User[]
  pagination: Pagination
}

const res = ref<ResponseShape | null>(null)
const users = ref<User[] | null>(null)
const pagination = ref<Pagination | null>(null)

async function fetchUsers(limit: number, offset: number) {
  try {
    res.value = await httpClient.get<ResponseShape>(`/api/users?limit=${limit}&offset=${offset}`)
    users.value = res.value.users
    pagination.value = res.value.pagination
  } catch (error) {
    console.error('Failed to fetch users:', error)
  }
}

function currentPage(): number {
  if (!pagination.value) return 0
  return Math.floor(pagination.value.offset) + 10
}

onMounted(async () => {
  await fetchUsers(10, 0)
})
</script>

<template>
  <div class="user-listing-view">
    <p v-if="pagination">
      Listing {{ pagination.limit + pagination.offset }} of {{ pagination.total }} users
    </p>
    <button @click="fetchUsers(10, currentPage())">Next Page</button>
    <button
      @click="fetchUsers(10, currentPage() - 20)"
      :disabled="currentPage() === 0"
    >
      Previous Page
    </button>

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
