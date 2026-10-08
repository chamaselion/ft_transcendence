<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { httpClient } from '@/auth/auth.api'
import type { User } from '@/auth/types/user'
import type { Pagination } from '@/types/pagination'

interface ResponseShape {
  users: User[]
  Pagination: Pagination
}

const res = ref<ResponseShape | null>(null)
const users = ref<User[] | null>(null)

onMounted(async () => {
  // Example of making an HTTP request to fetch user data
  try {
    res.value = await httpClient.get<ResponseShape>('/api/users')
    users.value = res.value.users
  } catch (error) {
    console.error('Failed to fetch users:', error)
  }
})
</script>

<template>
  <div>
    <h1>This is the Admin User Management</h1>
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
</template>

<style scoped>
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
