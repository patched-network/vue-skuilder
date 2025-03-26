// packages/common-ui/cypress.config.ts
import { defineConfig } from 'cypress';
import { defineConfig as defineViteConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';

export default defineConfig({
  component: {
    devServer: {
      framework: 'vue',
      bundler: 'vite',
      viteConfig: defineViteConfig({
        plugins: [vue()],
        resolve: {
          alias: {
            '@': './src',
          },
        },
      }),
    },
    specPattern: 'cypress/component/**/*.cy.{js,jsx,ts,tsx}',
    supportFile: 'cypress/support/component.js',
    indexHtmlFile: 'cypress/support/component-index.html', // Add this line
  },
});
