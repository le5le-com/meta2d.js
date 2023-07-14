import { createRouter, createWebHistory } from 'vue-router';

const routes = [
  { path: '/', component: () => import('./views/Index.vue') },
  { path: '/preview', component: () => import('./views/Preview.vue') },
];

const router = createRouter({
  history: createWebHistory('/'),
  routes,
});

export default router;
