import { MarkdownRenderer, getCurrentUser } from '@vue-skuilder/common-ui';
import { useAuthRedirectStore } from './stores/useAuthRedirectStore';
import { createRouter, createWebHistory } from 'vue-router';
import ClassroomCtrlPanel from './components/Classrooms/ClassroomCtrlPanel.vue';
import JoinCode from './components/Classrooms/JoinCode.vue';
import CourseRouter from './components/Courses/CourseRouter.vue';
import ELOModerator from './components/Courses/EloModeration.vue';
import TagInformation from './components/Courses/TagInformation.vue';
import { CourseEditor } from '@vue-skuilder/edit-ui';
import Stats from './components/User/UserStats.vue';
import About from './views/About.vue';
import AdminDashboard from './views/AdminDashboard.vue';
import Classrooms from './views/Classrooms.vue';
import Courses from './views/Courses.vue';
import Home from './views/Home.vue';
import Login from './views/Login.vue';
import ReleaseNotes from './views/ReleaseNotes.vue';
import VerifyEmailView from './views/VerifyEmail.vue';
import RequestPasswordResetView from './views/RequestPasswordReset.vue';
import ResetPasswordView from './views/ResetPassword.vue';
// import SignUp from './views/SignUp.vue';
import Study from './views/Study.vue';
import User from './views/User.vue';
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
    // Suppress signup for now
    //
    // {
    //   path: '/signup',
    //   name: 'signup',
    //   component: SignUp,
    // },
    {
      path: '/verify',
      name: 'verify',
      component: VerifyEmailView,
    },
    {
      path: '/request-reset',
      name: 'request-reset',
      component: RequestPasswordResetView,
    },
    {
      path: '/reset-password',
      name: 'reset-password',
      component: ResetPasswordView,
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
      path: '/classrooms/:classroomId',
      props: true,
      alias: '/c/:classroomId',
      component: ClassroomCtrlPanel,
    },
    {
      path: '/classrooms/:classroomId/code',
      props: true,
      alias: '/c/:classroomId',
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
      path: '/courses/:courseId/tags/:tagId',
      props: true,
      alias: ['/quilts/:courseId/tags/:tagId', '/q/:courseId/tags/:tagId'],
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
      component: AdminDashboard,
      meta: { requiresAdmin: true },
    },
    {
      path: '/user/:username',
      alias: '/u/:username',
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
  ],
});

router.beforeEach(async (to, _from, next) => {
  // paths that should be handled by the server, not the SPA
  const apiPaths = ['/express', '/couch'];

  if (apiPaths.some((path) => to.path.startsWith(path))) {
    // Return false to cancel navigation and let the browser handle the request
    return false;
  }

  if (to.meta.requiresAdmin) {
    try {
      const user = await getCurrentUser();
      if (user && user.getUsername() === 'admin') {
        next();
      } else {
        const redirectStore = useAuthRedirectStore();
        let reason: 'admin-required' | 'auth-required' | 'auth-failed';

        if (user) {
          // User is logged in but not admin
          reason = 'admin-required';
        } else {
          // User is not logged in
          reason = 'auth-required';
        }

        // Set context in store (fallback for refresh)
        redirectStore.setPendingRedirect(to.fullPath, reason);

        // Navigate with history state (primary method)
        next({
          name: 'login',
          state: {
            redirect: to.fullPath,
            reason,
            timestamp: Date.now(),
          },
        });
      }
    } catch {
      const redirectStore = useAuthRedirectStore();
      const reason = 'auth-failed';

      // Set context in store (fallback for refresh)
      redirectStore.setPendingRedirect(to.fullPath, reason);

      // Navigate with history state (primary method)
      next({
        name: 'login',
        state: {
          redirect: to.fullPath,
          reason,
          timestamp: Date.now(),
        },
      });
    }
  } else {
    next();
  }
});

export default router;
