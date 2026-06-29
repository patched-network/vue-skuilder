import 'roboto-fontface/css/roboto/roboto-fontface.css';
import { createApp, type App as VueApp, type Plugin } from 'vue';
import { createPinia, type Pinia } from 'pinia';
import type { Router, RouteRecordRaw } from 'vue-router';

import App from './App.vue';
import defaultVuetify from './plugins/vuetify';
import { createAppRouter } from './router';
import ENV, { type Environment } from './ENVIRONMENT_VARS';

// styles from component library packages
import '@vue-skuilder/courseware/style';
import '@vue-skuilder/common-ui/style';

// `db` import and initialization
import { initializeDataLayer } from '@vue-skuilder/db';

export interface PlatformAppOptions {
  /**
   * Mount target. May be a CSS selector or an Element. Defaults to '#app'
   * (overridable per-call in {@link PlatformApp.mount}).
   */
  el?: string | Element;
  /**
   * Data-layer environment overrides (CouchDB / Express URLs). Merged over the
   * ambient `window.__SKUILDER_ENV__` / process.env-derived defaults, so a host
   * need only specify what differs.
   */
  env?: Partial<Environment>;
  /**
   * Vuetify instance — the branding seam. Defaults to the built-in eduQuilt
   * theme. A consuming app (e.g. diffdoc) passes its own themed
   * `createVuetify(...)` here.
   */
  vuetify?: Plugin;
  /**
   * Routes appended after the built-in platform routes — the primary UI
   * extension seam for consuming apps (e.g. diffdoc's drift-queue views).
   */
  extraRoutes?: RouteRecordRaw[];
  /**
   * Inline components made available to MarkdownRenderer via the
   * `markdownComponents` provide. Defaults to `{}`.
   */
  markdownComponents?: Record<string, unknown>;
}

export interface PlatformApp {
  app: VueApp;
  router: Router;
  pinia: Pinia;
  /** Mount the app. `el` defaults to {@link PlatformAppOptions.el} ?? '#app'. */
  mount: (el?: string | Element) => void;
}

/**
 * Construct (but do not necessarily mount) the platform-ui application.
 *
 * This is the consumable entry point for the multi-tenant Skuilder shell.
 * `src/main.ts` is now a thin default host that calls this with no options;
 * external apps import `createPlatformApp` from the package entry and supply
 * their own `env` / `vuetify` (branding) / `extraRoutes`.
 *
 * Note: PWA service-worker registration is intentionally NOT performed here —
 * it is an app-shell concern handled by `main.ts` (`./registerServiceWorker`),
 * so library consumers do not inherit eduQuilt's service worker.
 */
export async function createPlatformApp(options: PlatformAppOptions = {}): Promise<PlatformApp> {
  const env: Environment = { ...ENV, ...options.env };

  await initializeDataLayer({
    type: 'couch',
    options: {
      COUCHDB_SERVER_PROTOCOL: env.COUCHDB_SERVER_PROTOCOL,
      COUCHDB_SERVER_URL: env.COUCHDB_SERVER_URL,
    },
  });

  const pinia = createPinia();
  const app = createApp(App);

  // Dynamically import { allCourseWare } and register all built-in courses.
  // As of the courseware tree-shaking refactor, `allCourseWare` starts empty;
  // platform-ui historically depended on all subcourses being available, so
  // we eagerly load them all here. See packages/courseware/src/index.ts.
  const {
    allCourseWare: Courses,
    defaultCourse,
    loadAllSubcourses,
  } = await import('@vue-skuilder/courseware');
  if (!Courses.courses.find((c) => c.name === defaultCourse.name)) {
    Courses.courses.push(defaultCourse);
  }
  await loadAllSubcourses();

  // Register all view components globally
  const viewComponents = Courses.allViewsRaw();
  Object.entries(viewComponents).forEach(([name, component]) => {
    app.component(name, component);
  });

  const router = createAppRouter({ extraRoutes: options.extraRoutes });

  app.use(router);
  app.use(options.vuetify ?? defaultVuetify);
  app.use(pinia);

  // Dynamically import piniaPlugin
  const { piniaPlugin } = await import('@vue-skuilder/common-ui');
  app.use(piniaPlugin, { pinia });

  // Provide inline markdown components for MarkdownRenderer
  // Enables custom Vue components in markdown via {{ <component-name /> }} syntax
  // See docs: https://patched-network.github.io/vue-skuilder/do/inline-components
  app.provide('markdownComponents', options.markdownComponents ?? {});

  return {
    app,
    router,
    pinia,
    mount: (el: string | Element = options.el ?? '#app') => {
      app.mount(el);
    },
  };
}
