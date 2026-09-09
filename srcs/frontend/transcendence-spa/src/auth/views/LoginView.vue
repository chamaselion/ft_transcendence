<template>
  <h1>Login</h1>
  <ul v-if="users.length">
    <li v-for="user in users" :key="user.id">
      {{ user.firstName }} {{ user.lastName }}
    </li>
  </ul>

</template>

<script setup lang="ts">

  import { HttpClient, type HttpClientConfig } from '@/auth/auth.api'
  import { ref, onMounted } from 'vue'
  import type { Root, User } from '@/auth/temp.users'

  const users = ref<User[]>([])

  let testConf: HttpClientConfig = {
    baseUrl: 'https://dummyjson.com',
  };


  onMounted(async () => {
    try {
      const httpClient = new HttpClient(testConf)
      const response = await httpClient.get<Root>('/users')
      console.log('Response:', response)
      console.log('Total users', response.total)
      users.value = response.users
    } catch (e) {
      console.error(e)
    } finally {
      console.log('Test completed')
    }
  })
</script>

