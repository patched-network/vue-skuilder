/**
 * Public entry for `@vue-skuilder/platform-ui` consumed as a library.
 *
 * This declares the intended consumable surface for hosting apps (e.g. diffdoc)
 * that want the multi-tenant Skuilder shell with their own branding + routes.
 *
 * NOTE: a library build target is not yet wired in `vite.config.js`. This entry
 * is type-checked and is the agreed API surface, but `build:lib` + a
 * consumed-lib smoke test land in the follow-up PR (which is what makes a lib
 * build trustworthy — the existing E2E only exercises pui-as-an-app). Until
 * then the default app entry remains `src/main.ts`.
 */
export { createPlatformApp } from './createPlatformApp';
export type { PlatformAppOptions, PlatformApp } from './createPlatformApp';

export { createAppRouter, platformRoutes } from './router';
export type { CreateAppRouterOptions } from './router';

// The root shell component + default theme, exposed so a host can compose or
// re-theme rather than replace the shell.
export { default as PlatformAppRoot } from './App.vue';
export { default as defaultVuetify } from './plugins/vuetify';

export type { Environment } from './ENVIRONMENT_VARS';
