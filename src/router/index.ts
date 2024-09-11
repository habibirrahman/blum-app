import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'signin',
      component: () => import('../pages/Signin.page.vue')
    },
    {
      path: '/home',
      name: 'home',
      component: () => import('../pages/Home.page.vue')
    },
    {
      path: '/pre-session-record/:slug',
      name: 'pre-session-record',
      component: () => import('../pages/PreSessionRecord.page.vue')
    },
    {
      path: '/session-record/:slug',
      name: 'session-record',
      component: () => import('../pages/SessionRecord.page.vue')
    },
    {
      path: '/client',
      name: 'clients',
      component: () => import('../pages/Clients.page.vue')
    },
    {
      path: '/client/:id/:tab',
      name: 'client',
      component: () => import('../pages/Client.page.vue')
    },
    {
      path: '/profile',
      name: 'profile',
      component: () => import('../pages/Profile.page.vue')
    },
    {
      path: '/about',
      name: 'about',
      // route level code-splitting
      // this generates a separate chunk (About.[hash].js) for this route
      // which is lazy-loaded when the route is visited.
      component: () => import('../pages/About.page.vue')
    }
  ]
})

export default router
