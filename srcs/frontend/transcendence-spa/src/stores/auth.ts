import { defineStore } from 'pinia'
import { httpClient } from '@/auth/auth.api'
import type { Root, User } from '@/auth/types/user'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: undefined as User | undefined,
    isAuthenticated: false,
    authChecked: false,
  }),

  getters: {},

  actions: {
    invalidate() {
      this.user = {} as User
      this.isAuthenticated = false
      this.authChecked = true
    },
    setStoreToApiResponse(response: Root) {
      this.user = response.user
      this.isAuthenticated = true
      this.authChecked = true
    },
    async checkForAuthentication() {
      if (this.user && this.user.id) {
        this.isAuthenticated = true
        this.authChecked = true
      } else {
        try {
          const res = await httpClient.get<Root>('me')
          console.log('Authentication check response:', res)
          this.setStoreToApiResponse(res)
        } catch {
          this.invalidate()
        } finally {
          this.authChecked = true
        }
      }
    },
    async logout() {
      try {
        await httpClient.post('logout', {})
        this.invalidate()
      } catch (error) {
        console.error('Logout failed:', error)
      }
    },
  },
})
