import { getCurrentUser } from '@vue-skuilder/common-ui';
import { useAuthRedirectStore } from './stores/useAuthRedirectStore';
import { isRegistrationEnabled } from './utils/registrationGuard';
import { createRouter, createWebHistory } from 'vue-router';

// Eager: landing and auth-flow views (needed for first paint / common entry)
import Home from './views/Home.vue';
import Login from './views/Login.vue';
import SignUp from './views/SignUp.vue';

// Lazy: everything else — each becomes its own chunk
const About = () => import('./views/About.vue');
const AdminDashboard = () => import('./views/AdminDashboard.vue');
const Classrooms = () => import('./views/Classrooms.vue');
const ClassroomCtrlPanel = () => import('./components/Classrooms/ClassroomCtrlPanel.vue');
const JoinCode = () => import('./components/Classrooms/JoinCode.vue');
const Courses = () => import('./views/Courses.vue');
const CourseRouter = () => import('./components/Courses/CourseRouter.vue');
const CourseEditor = () => import('@vue-skuilder/edit-ui').then((m) => m.CourseEditor);
const ELOModerator = () => import('./components/Courses/EloModeration.vue');
const TagInformation = () => import('./components/Courses/TagInformation.vue');
const Stats = () => import('./components/User/UserStats.vue');
const Study = () => import('./views/Study.vue');
const User = () => import('./views/User.vue');
const ReleaseNotes = () => import('./views/ReleaseNotes.vue');
const VerifyEmailView = () => import('./views/VerifyEmail.vue');
const RequestPasswordResetView = () => import('./views/RequestPasswordReset.vue');
const ResetPasswordView = () => import('./views/ResetPassword.vue');
const MarkdownRenderer = () => import('@vue-skuilder/common-ui').then((m) => m.MarkdownRenderer);
const DataInputFormTester = () => import('./dev/DataInputFormTester.vue');

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
      beforeEnter: () => {
        if (!isRegistrationEnabled()) {
          return { name: 'home' };
        }
      },
    },
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
