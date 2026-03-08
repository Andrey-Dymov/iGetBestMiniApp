import { createRouter, createWebHistory } from 'vue-router'
import ComparisonListView from '../views/ComparisonListView.vue'
import ComparisonResultsView from '../views/ComparisonResultsView.vue'

const router = createRouter({
  history: createWebHistory('/iGetBestMiniApp/'),
  routes: [
    {
      path: '/',
      name: 'comparisons',
      component: ComparisonListView,
      meta: { title: 'Сравнения' },
    },
    {
      path: '/comparisons/:id',
      name: 'comparison',
      component: ComparisonResultsView,
      meta: { title: 'Сравнение' },
    },
  ],
})

export default router
