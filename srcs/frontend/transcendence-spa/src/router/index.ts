import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import("@/auth/LoginView.vue"),
    },
    {
      path: '/',
      name: 'home',
      component: () => import("@/app/HomeView.vue"),
    },
    {
      path: '/test',
      name: 'Componenttest',
      component: () => import("@/app/components/ComponentCatalouge.vue"),
    }

  ],
})

export default router
