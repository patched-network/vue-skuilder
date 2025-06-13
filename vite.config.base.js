import { resolve } from 'path';

const isDev = process.env.NODE_ENV !== 'production';

console.info(`[VITE] shared config loaded in ${isDev ? 'development' : 'production'} mode`);

/**
 * Creates shared alias mappings for monorepo packages
 * @param {string} rootDir - Path to the monorepo root directory
 * @returns {Object} Alias configuration object
 */
export function createBaseAliases(rootDir = process.cwd()) {
  return {
    // Inter-package aliases using actual package names from imports
    '@vue-skuilder/db': isDev
      ? resolve(rootDir, './packages/db/src') // Dev: source directory
      : resolve(rootDir, './packages/db/dist/index.mjs'), // Prod: ES module build
    '@vue-skuilder/common': isDev
      ? resolve(rootDir, './packages/common/src') // Dev: source directory
      : resolve(rootDir, './packages/common/dist/index.mjs'),
    '@vue-skuilder/common-ui': isDev
      ? resolve(rootDir, './packages/common-ui/src') // Dev: source directory
      : resolve(rootDir, './packages/common-ui/dist/common-ui.es.js'),
    '@vue-skuilder/courses': isDev
      ? resolve(rootDir, './packages/courses/src') // Dev: source directory
      : resolve(rootDir, './packages/courses/dist/index.mjs'),
    '@vue-skuilder/express': isDev
      ? resolve(rootDir, './packages/express/src') // Dev: source directory
      : resolve(rootDir, './packages/express/dist/index.mjs'), // Assuming ESM build, adjust if different
    '@vue-skuilder/platform-ui': isDev
      ? resolve(rootDir, './packages/platform-ui/src') // App, resolve to src dir
      : resolve(rootDir, './packages/platform-ui/dist'), // App, resolve to dist dir
    '@vue-skuilder/standalone-ui': isDev
      ? resolve(rootDir, './packages/standalone-ui/src') // App, resolve to src dir
      : resolve(rootDir, './packages/standalone-ui/dist'), // App, resolve to dist dir
    '@vue-skuilder/e2e-db': isDev
      ? resolve(rootDir, './packages/e2e-db/src') // Dev: source directory
      : resolve(rootDir, './packages/e2e-db/dist/index.js'), // Assuming CJS build for tests
    '@vue-skuilder/cli': isDev
      ? resolve(rootDir, './packages/cli/src') // Dev: source directory
      : resolve(rootDir, './packages/cli/dist/cli.js'), // Assuming CJS build
    '@vue-skuilder/client': isDev
      ? resolve(rootDir, './packages/client/src') // Dev: source directory
      : resolve(rootDir, './packages/client/dist/index.js'), // Assuming CJS build

    // Intra-package aliases for internal imports (matching tsconfig.base.json)
    // These always point to src directories, as they are used for internal package resolution
    // or by other packages in dev mode when they override the @vue-skuilder/* alias
    '@db': resolve(rootDir, './packages/db/src'),
    '@common': resolve(rootDir, './packages/common/src'),
    '@cui': resolve(rootDir, './packages/common-ui/src'),
    '@courses': resolve(rootDir, './packages/courses/src'),
    '@express': resolve(rootDir, './packages/express/src'),
    '@pui': resolve(rootDir, './packages/platform-ui/src'), // App, resolve to src dir
    '@sui': resolve(rootDir, './packages/standalone-ui/src'), // App, resolve to src dir
    '@e2e-db': resolve(rootDir, './packages/e2e-db/src'),
    '@cli': resolve(rootDir, './packages/cli/src'),
    '@client': resolve(rootDir, './packages/client/src'),
  };
}

/**
 * Creates shared Vite resolve configuration
 * @param {string} rootDir - Path to the monorepo root directory
 * @param {Object} localAliases - Package-specific aliases to merge
 * @returns {Object} Vite resolve configuration
 */
export function createBaseResolve(rootDir = process.cwd(), localAliases = {}) {
  return {
    alias: {
      ...createBaseAliases(rootDir),
      ...localAliases,
    },
    extensions: ['.js', '.ts', '.json', '.vue'],
    dedupe: [
      'vue',
      'vuetify',
      'vue-router',
      'pinia',
      '@vue-skuilder/db',
      '@vue-skuilder/common',
      '@vue-skuilder/common-ui',
      '@vue-skuilder/courses',
    ],
  };
}
