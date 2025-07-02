import { createRouter, createWebHistory } from 'vue-router';
import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'browse',
    component: () => import('../views/BrowseView.vue'),
  },
  {
    path: '/course-editor',
    name: 'course-editor',
    component: () => import('../views/CourseEditorView.vue'),
  },
  {
    path: '/bulk-import',
    name: 'bulk-import',
    component: () => import('../views/BulkImportView.vue'),
  },
  {
    path: '/create-card',
    name: 'create-card',
    component: () => import('../views/CreateCardView.vue'),
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;
