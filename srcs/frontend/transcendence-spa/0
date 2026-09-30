import { defineStore } from 'pinia'
import { httpClient } from '@/auth/auth.api'
import { type Root, type User } from '@/auth/types/user'


export const useAuthStore = defineStore('auth', {
  state: ()  => ({
    user: {} as User,
    isAuthenticated: false
  }),

  getters: {
  },

  actions: {
    invalidate() {
      this.user = {} as User;
      this.isAuthenticated = false;
    },
    setStoreToApiResponse(response: Root) {
      this.user = response.user;
      this.isAuthenticated = true;
    },
    async checkForAuthentication() {
      if (this.user && this.user.id) {
        this.isAuthenticated = true;
      } else {
        try {
          const res = await httpClient.get<Root>('me')
          console.log('Authentication check response:', res)
          this.setStoreToApiResponse(res)
        } catch {
          this.invalidate()
        }
      }
    },
    async logout() {
      try {
        await httpClient.post('logout')
        this.invalidate()
      } catch (error) {
        console.error('Logout failed:', error)
      }
    }
  },
});


