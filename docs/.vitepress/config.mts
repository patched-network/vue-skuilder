import { defineConfig } from 'vitepress';
import path from 'path';

// https://vitepress.dev/reference/site-config
export default defineConfig({
  vite: {
    resolve: {
      alias: {
        '@vue-skuilder/courseware': path.resolve(__dirname, '../../packages/courseware/src'),
        '@vue-skuilder/common-ui': path.resolve(__dirname, '../../packages/common-ui/src'),
        '@vue-skuilder/platform-ui': path.resolve(__dirname, '../../packages/platform-ui/src'),
      },
    },
    optimizeDeps: {
      exclude: ['@vue-skuilder/courseware', '@vue-skuilder/common-ui', '@vue-skuilder/platform-ui', '@vue-skuilder/db'],
    },
    ssr: {
      noExternal: ['@vojtechlanka/vue-tags-input'],
    },
  },
  title: 'skuilder',
  description: 'modern tooling for adaptive tutoring systems and SRS++',
  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    nav: [
      // { text: 'Home', link: '/' },
      // { text: 'Examples', link: '/markdown-examples' }
    ],

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
