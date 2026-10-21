import { useAuthStore } from '@/stores/auth'
import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/auth/views/LoginView.vue'),
    },
    {
      path: '/',
      name: 'home',
      component: () => import('@/app/HomeView.vue'),
    },
    {
      path: '/editor/:id?',
      name: 'editor',
      component: () => import('@/app/EditorView.vue'),
    },
    {
      path: '/test',
      name: 'Componenttest',
      component: () => import('@/app/components/ComponentCatalouge.vue'),
    },
    {
      path: '/register',
      name: 'register',
      component: () => import('@/auth/views/RegisterView.vue'),
    },
    {
      name: 'oauth-consent',
      path: '/auth/oauth/:provider/consent',
      component: () => import('@/auth/views/OAuthConsentView.vue'),
    },
    {
      name: 'oauth-callback',
      path: '/auth/oauth/:provider/callback',
      component: () => import('@/auth/views/OAuthCallbackView.vue'),
    },
    {
      path: '/profile',
      name: 'Profile',
      component: () => import('@/app/ProfileView.vue'),
    },
    {
      path: '/admin',
      name: 'Admin',
      component: () => import('@/app/AdminView.vue'),
    },
  ],
})

router.beforeEach(async (to) => {
  const authStore = useAuthStore()

  if (to.name === 'Admin') {
    if (authStore.isAdmin()) return true
    else return { name: 'home' }
  }
  return true
})

export default router
