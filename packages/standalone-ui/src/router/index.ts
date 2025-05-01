import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router';
import HomeView from '../views/HomeView.vue';
import StudyView from '../views/StudyView.vue';
import ProgressView from '../views/ProgressView.vue';
import { UserLogin, UserRegistration } from '@vue-skuilder/common-ui';

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
  {
    path: '/login',
    name: 'login',
    component: UserLogin,
  },
  {
    path: '/register',
    alias: '/signup',
    name: 'Register',
    component: UserRegistration,
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;
