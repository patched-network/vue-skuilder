import { defineConfig } from 'vitepress';
import path from 'path';
import { fileURLToPath, URL } from 'node:url';

// https://vitepress.dev/reference/site-config
export default defineConfig({
  base: '/vue-skuilder/',
  vite: {
    resolve: {
      alias: [
        // Override VitePress default VPHero component with our custom one
        {
          find: /^.*\/VPHero\.vue$/,
          replacement: fileURLToPath(
            new URL('./theme/components/CustomVPHero.vue', import.meta.url)
          ),
        },
        // Existing project aliases
        {
          find: '@vue-skuilder/courseware',
          replacement: path.resolve(__dirname, '../../packages/courseware/src'),
        },
        {
          find: '@vue-skuilder/common-ui',
          replacement: path.resolve(__dirname, '../../packages/common-ui/src'),
        },
        {
          find: '@vue-skuilder/platform-ui',
          replacement: path.resolve(__dirname, '../../packages/platform-ui/src'),
        },
      ],
    },
    optimizeDeps: {
      exclude: [
        '@vue-skuilder/courseware',
        '@vue-skuilder/common-ui',
        '@vue-skuilder/platform-ui',
        '@vue-skuilder/db',
      ],
    },
    ssr: {
      noExternal: ['@vojtechlanka/vue-tags-input'],
    },
  },
  title: 'skuilder',
  description: 'modern tooling for adaptive tutoring systems and SRS++',
  head: [['link', { rel: 'icon', type: 'image/svg+xml', href: './logo.svg' }]],
  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    nav: [
      // { text: 'Home', link: '/' },
      // { text: 'Examples', link: '/markdown-examples' }
    ],
    logo: '/logo.svg',

    sidebar: [
      {
        items: [
          { text: 'Introduction', link: '/introduction' },
          { text: 'Quickstart', link: '/quickstart' },
        ],
      },
    ],

    socialLinks: [{ icon: 'github', link: 'https://github.com/patched-network/vue-skuilder' }],
  },
});
