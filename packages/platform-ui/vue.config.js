const TerserPlugin = require('terser-webpack-plugin');
const webpack = require('webpack');
const path = require('path');
const { defineConfig } = require('@vue/cli-service');
const { VuetifyPlugin } = require('webpack-plugin-vuetify');

module.exports = defineConfig({
  lintOnSave: false,
  // [ ] #vue3: remove this commented line after migration done
  // transpileDependencies: ['vuetify'], // Add this line for Vuetify 2.x... and remove for vuetify 3
  transpileDependencies: true,
  pluginOptions: {
    vuetify: {
      // https://github.com/vuetifyjs/vuetify-loader/tree/master/packages/vuetify-loader
      autoImport: true,
    },
  },
  configureWebpack: (config) => {
    console.log('[config] NODE_ENV:', process.env.NODE_ENV);
    console.log('[config] VUE_APP_MOCK:', process.env.VUE_APP_MOCK);

    if (process.env.NODE_ENV === 'production') {
      config.optimization.minimizer[0] = new TerserPlugin(terserOptions);
    } else {
      console.log('[config] Setting up source maps and aliases');
      config.devtool = 'source-map';
      if (process.env.VUE_APP_MOCK) {
        console.log('[config] Using mocks');

        const courseDB = path.resolve(__dirname, 'src/db/courseDB.mock.ts');
        const courseAPI = path.resolve(__dirname, 'src/db/courseAPI.mock.ts');
        const db = path.resolve(__dirname, 'src/db/index.mock.ts');
        const store = path.resolve(__dirname, 'src/store.mock.ts');

        console.log('[config] courseDB:', courseDB);
        console.log('[config] courseAPI:', courseAPI);
        console.log('[config] db:', db);
        console.log('[config] store:', store);

        console.log('[config] prior aliases:', JSON.stringify(config.resolve.alias));

        config.resolve.alias = {
          '@/db/courseDB$': path.resolve(__dirname, 'src/db/courseDB.mock.ts'),
          '@/db/courseAPI$': path.resolve(__dirname, 'src/db/courseAPI.mock.ts'),
          '@/db$': path.resolve(__dirname, 'src/db/index.mock.ts'),
          '@/store$': path.resolve(__dirname, 'src/store.mock.ts'),
          '@/realthing$': path.resolve(__dirname, 'src/realthing.mock.ts'),
          ...config.resolve.alias,
        };
      } else {
        console.log('[config] Using real data sources');
      }
    }

    // Add webpack 5 polyfills
    config.resolve.fallback = {
      util: require.resolve('util/'),
      timers: require.resolve('timers-browserify'),
      stream: require.resolve('stream-browserify'),
      assert: require.resolve('assert/'),
      buffer: require.resolve('buffer/'),
    };

    config.plugins = [
      ...(config.plugins || []),
      new VuetifyPlugin({ autoImport: true }), // Add Vuetify plugin
      new webpack.ProvidePlugin({
        process: 'process/browser',
        Buffer: ['buffer', 'Buffer'],
      }),
    ];
  },

  css: {
    loaderOptions: {
      sass: {
        // This is optional but recommended for Vuetify 2.x
        implementation: require('sass'),
        sassOptions: {
          fiber: false,
        },
      },
    },
  },

  publicPath: process.env.NODE_ENV === 'production' ? '/' : '/',
  pwa: {
    name: 'Skuilder',
  },
});

const terserOptions = {
  terserOptions: {
    keep_classnames: true,
  },
  test: [],
  extractComments: false,
  sourceMap: true,
  cache: true,
  parallel: true,
};
