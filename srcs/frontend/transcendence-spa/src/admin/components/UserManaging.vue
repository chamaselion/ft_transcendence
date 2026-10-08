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

  <div
    v-for="user in users"
    :key="user.id"
  >
    <p>{{ user.login }} - {{ user.email }}</p>
  </div>
</template>
