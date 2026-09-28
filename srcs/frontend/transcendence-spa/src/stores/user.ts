import { httpClient } from '@/auth/auth.api'
import { Root, User } from '@/auth/types/user'
import { ref, computed } from 'vue'
import { defineStore } from 'pinia'

const root = ref<Root>({ loggedIn: false })
const user = ref<User>({
  id: '',
  login: '',
  email: '',
  role: '',
})

const isLoggedIn = computed(() => root.value.loggedIn)
const currentUser = computed(() => user.value)

export const useUserStore = defineStore('user', () => {
  if (root.value.loggedIn && !user.value.id) {

  }
});


