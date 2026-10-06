import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { httpClient } from '@/auth/auth.api'
import type { User, Root } from '@/auth/types/user'

export const useUserStore = defineStore('user', () => {
  const user = ref<User | null>(null)
  const isAuthenticated = computed(() => user.value !== null)
  const userId = computed(() => user.value?.id ?? null)

  async function fetchCurrentUser(): Promise<User | null> {
    try {
      const res = await httpClient.get<Root>('me')
      if (res && res.loggedIn && res.user) {
        user.value = res.user
      } else {
        user.value = null
      }
      return user.value
    } catch {
      user.value = null
      return null
    }
  }

  function setUser(newUser: User | null) {
    user.value = newUser
  }

  function clearUser() {
    user.value = null
  }

  return {
    user,
    userId,
    isAuthenticated,
    fetchCurrentUser,
    setUser,
    clearUser,
  }
})
