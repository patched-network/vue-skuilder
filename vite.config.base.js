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
    // Package-specific aliases (matching tsconfig.base.json)
    '@db': isDev
      ? resolve(rootDir, './packages/db/src')
      : resolve(rootDir, './packages/db/dist'),
    '@common': isDev
      ? resolve(rootDir, './packages/common/src')
      : resolve(rootDir, './packages/common/dist'),
    '@cui': isDev
      ? resolve(rootDir, './packages/common-ui/src')
      : resolve(rootDir, './packages/common-ui/dist'),
    '@courses': isDev
      ? resolve(rootDir, './packages/courses/src')
      : resolve(rootDir, './packages/courses/dist'),
    '@express': isDev
      ? resolve(rootDir, './packages/express/src')
      : resolve(rootDir, './packages/express/dist'),
    '@pui': isDev
      ? resolve(rootDir, './packages/platform-ui/src')
      : resolve(rootDir, './packages/platform-ui/dist'),
    '@sui': isDev
      ? resolve(rootDir, './packages/standalone-ui/src')
      : resolve(rootDir, './packages/standalone-ui/dist'),
    '@e2e-db': isDev
      ? resolve(rootDir, './packages/e2e-db/src')
      : resolve(rootDir, './packages/e2e-db/dist'),
    '@cli': isDev
      ? resolve(rootDir, './packages/cli/src')
      : resolve(rootDir, './packages/cli/dist'),
    '@client': isDev
      ? resolve(rootDir, './packages/client/src')
      : resolve(rootDir, './packages/client/dist'),
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
