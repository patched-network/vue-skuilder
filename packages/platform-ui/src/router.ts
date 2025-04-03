import { MarkdownRenderer } from '@vue-skuilder/common-ui';
import { createRouter, createWebHistory } from 'vue-router';
import ClassroomCtrlPanel from './components/Classrooms/ClassroomCtrlPanel.vue';
import JoinCode from './components/Classrooms/JoinCode.vue';
import CourseRouter from './components/Courses/CourseRouter.vue';
import ELOModerator from './components/Courses/EloModeration.vue';
import TagInformation from './components/Courses/TagInformation.vue';
import CourseEditor from './components/Edit/CourseEditor.vue';
import Stats from './components/User/UserStats.vue';
import About from './views/About.vue';
import Admin from './views/Admin.vue';
import Classrooms from './views/Classrooms.vue';
import Courses from './views/Courses.vue';
import Home from './views/Home.vue';
import Login from './views/Login.vue';
import ReleaseNotes from './views/ReleaseNotes.vue';
import SignUp from './views/SignUp.vue';
import Study from './views/Study.vue';
import User from './views/User.vue';
import UIMocks from '@/mocks/UIMocks.vue';
import { ENV } from '@vue-skuilder/common';
import DataInputFormTester from './dev/DataInputFormTester.vue';

const router = createRouter({
  history: createWebHistory(),
  // mode: 'history', // deprecated in Vue 3 / Vue Router 4

  routes: [
    // {
    //   path: '/debug/:component',
    //   name: 'componentPreviews',
    //   component: components[component]
    // }
    // todo:
    //
    // beforeEnter: () => authenticateAdmin ?
    //
    // const components: Component[] = [];
    {
      path: '/dif/:pathMatch(.*)',
      name: 'testThePathComponent',
      component: DataInputFormTester,
      props: true,
    },
    {
      path: '/md',
      component: MarkdownRenderer,
    },
    {
      path: '/',
      alias: ['/home'],
      name: 'home',
      component: Home,
    },
    {
      path: '/about',
      name: 'about',
      component: About,
    },
    {
      path: '/login',
      name: 'login',
      component: Login,
    },
    {
      path: '/signup',
      name: 'signup',
      component: SignUp,
    },
    {
      path: '/notes',
      component: ReleaseNotes,
    },
    {
      path: '/edit/:course',
      props: true,
      component: CourseEditor,
    },
    {
      path: '/study',
      name: 'study',
      component: Study,
    },
    {
      path: '/study/:focusCourseID',
      component: Study,
      props: true,
    },
    {
      path: '/random',
      name: 'random',
      alias: ['/r'],
      props: {
        randomPreview: true,
      },
      component: Study,
    },
    {
      path: '/classrooms',
      name: 'classrooms',
      component: Classrooms,
    },
    {
      path: '/classrooms/:_id',
      props: true,
      alias: '/c/:_id',
      component: ClassroomCtrlPanel,
    },
    {
      path: '/classrooms/:_id/code',
      props: true,
      alias: '/c/:_id',
      component: JoinCode,
    },
    {
      path: '/courses',
      alias: ['/quilts', '/q'],
      component: Courses,
    },
    {
      path: '/courses/:query',
      props: true,
      alias: ['/quilts/:query', '/q/:query'],
      component: CourseRouter,
    },
    {
      path: '/courses/:courseId/elo',
      props: true,
      alias: ['/quilts/:courseId/elo', '/q/:courseId/elo'],
      component: ELOModerator,
    },
    {
      path: '/courses/:_courseId/tags/:_id',
      props: true,
      alias: ['/quilts/:_courseId/tags/:_id', '/q/:_courseId/tags/:_id'],
      component: TagInformation,
    },
    {
      path: '/courses/:previewCourseID/preview',
      props: true,
      alias: ['/quilts/:previewCourseID/preview', '/q/:previewCourseID/preview'],
      component: Study,
    },
    {
      path: '/admin',
      component: Admin,
    },
    {
      path: '/user/:_id',
      alias: '/u/:_id',
      props: true,
      component: User,
      children: [
        {
          path: 'new',
          component: User,
        }, //,
        // {
        //   path: '/stats',
        //   component: Stats,
        // },
      ],
    },
    {
      path: '/user/:_id/stats',
      props: true,
      alias: ['/u/:_id/stats'],
      component: Stats,
    },
    {
      path: '/uimocks',
      component: ENV.MOCK ? UIMocks : Home,
    },
  ],
});

router.beforeEach((to, from, next) => {
  // paths that should be handled by the server, not the SPA
  const apiPaths = ['/express', '/couch'];

  if (apiPaths.some((path) => to.path.startsWith(path))) {
    // Return false to cancel navigation and let the browser handle the request
    return false;
  }

  // Continue with navigation for all other routes
  next();
});

export default router;
