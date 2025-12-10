import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'signin',
      component: () => import('../pages/SigninApp.page.vue')
    },
    {
      path: '/home',
      name: 'home',
      component: () => import('../pages/HomeApp.page.vue')
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
      path: '/sessions/:slug',
      name: 'session-draft',
      component: () => import('../pages/SessionDraft.page.vue')
    },
    {
      path: '/sessions/:slug/select-target',
      name: 'session-select-target',
      component: () => import('../pages/SessionSelectTarget.page.vue')
    },
    {
      path: '/clients',
      name: 'clients',
      component: () => import('../pages/ClientList.page.vue')
    },
    {
      path: '/clients/:id/:tab',
      name: 'client',
      component: () => import('../pages/ClientDetails.page.vue')
    },
    {
      path: '/client/:id/targets/new',
      name: 'new-client-target',
      component: () => import('../pages/AddTarget.page.vue')
    },
    {
      path: '/client/:id/targets/:target_id/edit',
      name: 'edit-client-target',
      component: () => import('../pages/EditClientTarget.page.vue')
    },
    {
      path: '/profile',
      name: 'profile',
      component: () => import('../pages/ProfileApp.page.vue')
    }
  ]
})

export default router
