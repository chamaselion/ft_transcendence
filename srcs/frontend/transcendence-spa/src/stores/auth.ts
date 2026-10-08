import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { httpClient } from '@/auth/auth.api'
import type { Root, User } from '@/auth/types/user'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const isAuthenticated = computed(() => user.value !== null)
  const userId = computed(() => user.value?.id ?? null)

  function setUser(newUser: User | null) {
    user.value = newUser
  }

  function invalidate() {
    user.value = null
  }

  function isAdmin(): boolean {
    return user.value?.role === 'admin'
  }

  function setStoreToApiResponse(response: Root) {
    if (response && response.loggedIn && response.user) {
      user.value = response.user
    } else {
      invalidate()
    }
  }

  async function checkForAuthentication(force = false): Promise<User | null> {
    if (!force && user.value && user.value.id) {
      return user.value
    }
    try {
      const res = await httpClient.get<Root>('me')
      setStoreToApiResponse(res)
      return user.value
    } catch {
      invalidate()
      return null
    }
  }

  async function logout() {
    try {
      await httpClient.post('logout', {})
    } catch (error) {
      console.error('Logout failed:', error)
    } finally {
      invalidate()
    }
  }

  return {
    user,
    userId,
    isAuthenticated,
    isAdmin,
    setUser,
    clearUser: invalidate,
    invalidate,
    setStoreToApiResponse,
    checkForAuthentication,
    fetchCurrentUser: checkForAuthentication,
    logout,
  }
})
