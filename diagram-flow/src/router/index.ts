import { createRouter, createWebHistory } from 'vue-router';

const routes = [
  { path: '/', component: () => import('../views/editor/Index.vue') },
  { path: '/view', component: () => import('../views/view/Index.vue') },
];

const router = createRouter({
  history: createWebHistory('/'),
  routes,
});

export default router;
