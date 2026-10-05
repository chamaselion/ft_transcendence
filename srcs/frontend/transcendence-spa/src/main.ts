import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { useAuthStore } from '@/stores/auth'

import App from './App.vue'
import router from './router'

const app = createApp(App)


app.use(createPinia())

const authStore = useAuthStore()
authStore.checkForAuthentication()

app.use(router)

app.mount('#app')
