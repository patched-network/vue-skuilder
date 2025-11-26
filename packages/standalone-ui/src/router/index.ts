import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router';
import HomeView from '../views/HomeView.vue';
import StudyView from '../views/StudyView.vue';
import ProgressView from '../views/ProgressView.vue';
import BrowseView from '../views/BrowseView.vue';
import UserStatsView from '../views/UserStatsView.vue';
import UserSettingsView from '../views/UserSettingsView.vue';
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
    path: '/browse',
    name: 'browse',
    component: BrowseView,
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
  {
    path: '/u/:username',
    name: 'UserSettings',
    component: UserSettingsView,
  },
  {
    path: '/u/:username/stats',
    name: 'UserStats', 
    component: UserStatsView,
  },
  {
    path: '/courses/:courseId/tags/:tagId',
    name: 'tag-viewer',
    component: () => import('../views/TagViewer.vue'),
    props: true,
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;
