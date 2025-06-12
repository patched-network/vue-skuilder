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
      ? resolve(rootDir, './packages/db/src')
      : resolve(rootDir, './packages/db/dist'),
    '@vue-skuilder/common': isDev
      ? resolve(rootDir, './packages/common/src')
      : resolve(rootDir, './packages/common/dist'),
    '@vue-skuilder/common-ui': isDev
      ? resolve(rootDir, './packages/common-ui/src')
      : resolve(rootDir, './packages/common-ui/dist'),
    '@vue-skuilder/courses': isDev
      ? resolve(rootDir, './packages/courses/src')
      : resolve(rootDir, './packages/courses/dist'),
    '@vue-skuilder/express': isDev
      ? resolve(rootDir, './packages/express/src')
      : resolve(rootDir, './packages/express/dist'),
    '@vue-skuilder/platform-ui': isDev
      ? resolve(rootDir, './packages/platform-ui/src')
      : resolve(rootDir, './packages/platform-ui/dist'),
    '@vue-skuilder/standalone-ui': isDev
      ? resolve(rootDir, './packages/standalone-ui/src')
      : resolve(rootDir, './packages/standalone-ui/dist'),
    '@vue-skuilder/e2e-db': isDev
      ? resolve(rootDir, './packages/e2e-db/src')
      : resolve(rootDir, './packages/e2e-db/dist'),
    '@vue-skuilder/cli': isDev
      ? resolve(rootDir, './packages/cli/src')
      : resolve(rootDir, './packages/cli/dist'),
    '@vue-skuilder/client': isDev
      ? resolve(rootDir, './packages/client/src')
      : resolve(rootDir, './packages/client/dist'),

    // Intra-package aliases for internal imports (matching tsconfig.base.json)
    '@db': resolve(rootDir, './packages/db/src'),
    '@common': resolve(rootDir, './packages/common/src'),
    '@cui': resolve(rootDir, './packages/common-ui/src'),
    '@courses': resolve(rootDir, './packages/courses/src'),
    '@express': resolve(rootDir, './packages/express/src'),
    '@pui': resolve(rootDir, './packages/platform-ui/src'),
    '@sui': resolve(rootDir, './packages/standalone-ui/src'),
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
