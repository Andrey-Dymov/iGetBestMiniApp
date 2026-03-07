import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory('/iGetBestMiniApp/'),
  routes: [
    {
      path: '/',
      name: 'comparisons',
      component: () => import('../views/ComparisonListView.vue'),
      meta: { title: 'Сравнения' },
    },
    {
      path: '/comparisons/:id',
      name: 'comparison',
      component: () => import('../views/ComparisonResultsView.vue'),
      meta: { title: 'Сравнение' },
    },
  ],
})

export default router
