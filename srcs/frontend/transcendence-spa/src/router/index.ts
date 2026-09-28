import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import("@/auth/views/LoginView.vue"),
    },
    {
      path: '/',
      name: 'home',
      component: () => import("@/app/HomeView.vue"),
    },
    {
      path: '/editor',
      name: 'editor',
      component: () => import("@/app/EditorView.vue"),
    },
    {
      path: '/test',
      name: 'Componenttest',
      component: () => import("@/app/components/ComponentCatalouge.vue"),
    },
    {
      path: '/register',
      name: 'register',
      component: () => import("@/auth/views/RegisterView.vue"),
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import("@/auth/views/SettingsView.vue"),
    }

  ],
})

export default router
