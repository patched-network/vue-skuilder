import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router';
import HomeView from '../views/HomeView.vue';
import StudyView from '../views/StudyView.vue';
import ProgressView from '../views/ProgressView.vue';

const routes: Array<RouteRecordRaw> = [
  {
    path: '/',
    name: 'home',
    component: HomeView,
  },
  {
    path: '/study',
    name: 'study',
    component: StudyView,
  },
  {
    path: '/progress',
    name: 'progress',
    component: ProgressView,
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;
