import { defineConfig } from 'vitepress';
import path from 'path';
import { fileURLToPath, URL } from 'node:url';
import llmstxt from 'vitepress-plugin-llms';

// https://vitepress.dev/reference/site-config
export default defineConfig({
  base: '/vue-skuilder/',
  vite: {
    plugins: [llmstxt()],
    resolve: {
      alias: [
        // Override VitePress default VPHero component with our custom one
        {
          find: /^.*\/VPHero\.vue$/,
          replacement: fileURLToPath(
            new URL('./theme/components/CustomVPHero.vue', import.meta.url)
          ),
        },
        // Style aliases MUST come first (most specific paths)
        {
          find: '@vue-skuilder/courseware/style',
          replacement: path.resolve(__dirname, '../../packages/courseware/dist/assets/index.css'),
        },
        {
          find: '@vue-skuilder/common-ui/style',
          replacement: path.resolve(__dirname, '../../packages/common-ui/dist/assets/index.css'),
        },
        // Inter-package aliases (less specific)
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
        {
          find: '@vue-skuilder/db',
          replacement: path.resolve(__dirname, '../../packages/db/src'),
        },
        {
          find: '@vue-skuilder/common',
          replacement: path.resolve(__dirname, '../../packages/common/src'),
        },
        // Intra-package aliases (matching vite.config.base.js)
        {
          find: '@courseware',
          replacement: path.resolve(__dirname, '../../packages/courseware/src'),
        },
        {
          find: '@cui',
          replacement: path.resolve(__dirname, '../../packages/common-ui/src'),
        },
        {
          find: '@common',
          replacement: path.resolve(__dirname, '../../packages/common/src'),
        },
        {
          find: '@db',
          replacement: path.resolve(__dirname, '../../packages/db/src'),
        },
      ],
    },
    optimizeDeps: {
      include: [
        'vuetify',
        'vuetify/components',
        'vuetify/directives',
        '@mdi/font/css/materialdesignicons.css',
        'pinia',
        'vue-router',
      ],
      exclude: [
        '@vue-skuilder/courseware',
        '@vue-skuilder/common-ui',
        '@vue-skuilder/platform-ui',
        '@vue-skuilder/db',
        '@vue-skuilder/common',
      ],
    },
    ssr: {
      noExternal: [
        '@vojtechlanka/vue-tags-input',
        'vuetify',
        '@vue-skuilder/common-ui',
        '@vue-skuilder/courseware',
      ],
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
    editLink: {
      pattern: 'https://github.com/patched-network/vue-skuilder/edit/master/docs/:path',
    },
    lastUpdated: {
      formatOptions: {
        dateStyle: 'medium',
      },
    },
    logo: '/logo.svg',

    sidebar: [
      {
        items: [
          { text: 'Introduction', link: '/introduction' },
          {
            text: 'Learn',
            collapsed: false,
            items: [
              // { text: 'Main Study Loop', link: '/study-loop' },
              { text: 'System Overview', link: '/learn/architecture' },
              { text: 'Authoring Cards', link: '/learn/cards' },
              { text: 'Data Layer', link: '/learn/data-layer' },
              { text: 'Application Layer', link: '/learn/apps' },
              { text: 'Pedagogy Defaults', link: '/learn/pedagogy' },
            ],
          },
          {
            text: 'Do',
            collapsed: false,
            items: [
              { text: 'Quickstart', link: '/do/quickstart' },
              { text: 'Adding Content', link: '/do/studio-mode' },
              { text: 'Creating Custom Cards', link: '/do/custom-cards' },
              { text: 'Themes', link: '/do/theming' },
              { text: 'Connect Agents [wip]', link: '/do/mcp' },
            ],
          },
        ],
      },
      {
        items: [
          { text: 'CLI Reference', link: '/cli' },
          { text: 'Default Cards References', link: '/default-cards' },
        ],
      },
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/patched-network/vue-skuilder' },
      {
        //'pn-logo.svg',
        icon: {
          svg: `<?xml version="1.0" encoding="UTF-8"?>
              <svg version="1.1" xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
              <path d="M0 0 C66 0 132 0 200 0 C200 66 200 132 200 200 C134 200 68 200 0 200 C0 134 0 68 0 0 Z " fill="#FF6B55" transform="translate(0,0)"/>
              <path d="M0 0 C7.70155892 7.52652349 10.86387678 13.35057156 11.1875 24.0625 C10.95680102 33.7422448 8.4718688 40.90459196 1.70703125 47.92578125 C-5.28296349 54.21817173 -11.22441388 55.42250067 -20.62890625 55.12890625 C-25.38133186 54.54959223 -29.17339586 53.16218653 -33.25 50.6875 C-33.25 50.0275 -33.25 49.3675 -33.25 48.6875 C-34.57 48.0275 -35.89 47.3675 -37.25 46.6875 C-37.2593457 47.61087158 -37.26869141 48.53424316 -37.27832031 49.4855957 C-37.32234734 52.91344506 -37.38396107 56.34004051 -37.45751953 59.76733398 C-37.48573541 61.25028942 -37.50694702 62.73339543 -37.52099609 64.21655273 C-37.5424192 66.34957997 -37.58905782 68.48079606 -37.640625 70.61328125 C-37.66157227 71.89630127 -37.68251953 73.17932129 -37.70410156 74.5012207 C-38.25 77.6875 -38.25 77.6875 -40.12402344 79.63745117 C-42.25 80.6875 -42.25 80.6875 -44.875 80.5625 C-47.25 79.6875 -47.25 79.6875 -49.25 76.6875 C-49.50396729 74.13397217 -49.50396729 74.13397217 -49.50878906 71.04199219 C-49.51509338 69.88358826 -49.52139771 68.72518433 -49.52789307 67.53167725 C-49.5238446 66.2785675 -49.51979614 65.02545776 -49.515625 63.734375 C-49.51753845 62.44565491 -49.5194519 61.15693481 -49.52142334 59.8291626 C-49.52437247 57.09878758 -49.52008667 54.3685434 -49.51074219 51.63818359 C-49.49939292 48.15365447 -49.50587939 44.66943501 -49.51788712 41.18491745 C-49.52689755 37.84721256 -49.52056606 34.50958866 -49.515625 31.171875 C-49.51967346 29.92686218 -49.52372192 28.68184937 -49.52789307 27.39910889 C-49.46888314 16.43815559 -47.8407388 9.8564396 -40.25 1.6875 C-29.4603387 -8.10084804 -11.88314423 -8.45531417 0 0 Z " fill="#FFFCFB" transform="translate(70.25,81.3125)"/>
              <path d="M0 0 C0.33 1.65 0.66 3.3 1 5 C1.53109375 4.65066406 2.0621875 4.30132812 2.609375 3.94140625 C3.66898438 3.25884766 3.66898438 3.25884766 4.75 2.5625 C5.44609375 2.11003906 6.1421875 1.65757813 6.859375 1.19140625 C13.40783365 -2.45326508 23.12850565 -2.03805333 30.328125 -0.50390625 C36.51924313 1.96417462 42.07664696 6.94813625 44.93383789 12.96728516 C47.44551186 20.56393805 47.49072541 28.14837332 47.44604492 36.06103516 C47.43743788 38.39182219 47.46653973 40.72022919 47.49804688 43.05078125 C47.49965694 44.54166594 47.49908508 46.03255494 47.49609375 47.5234375 C47.51294472 48.56097672 47.51294472 48.56097672 47.53013611 49.61947632 C47.48119608 53.00072513 47.19412212 54.74358553 45.12915039 57.47119141 C43 59 43 59 40.4375 58.9375 C37.71251315 57.88942813 36.69933615 57.36287494 35 55 C34.70472699 52.42872666 34.58274933 50.08721472 34.59375 47.515625 C34.58291382 46.78180603 34.57207764 46.04798706 34.56091309 45.29193115 C34.52664812 42.94453172 34.51106912 40.59761652 34.5 38.25 C34.4853522 35.17141445 34.4514705 32.09389678 34.40625 29.015625 C34.40927124 28.31745667 34.41229248 27.61928833 34.41540527 26.89996338 C34.33893521 21.82902308 33.31477075 18.42301405 31 14 C25.36627167 9.77470375 19.81641318 9.42076003 13 10 C9.45045402 10.89561828 6.74757342 12.25242658 4.125 14.875 C1.64668096 19.55626929 1.84246965 24.63790403 1.7890625 29.8203125 C1.76101812 31.33985497 1.73235386 32.8593861 1.703125 34.37890625 C1.66174163 36.75992806 1.62482694 39.14073232 1.59863281 41.52197266 C1.57108054 43.83018765 1.52524527 46.13745955 1.4765625 48.4453125 C1.47330963 49.15785187 1.47005676 49.87039124 1.46670532 50.60452271 C1.39399097 53.52047869 1.33468064 55.52516515 -0.37353516 57.94873047 C-2.72499275 59.46860084 -4.26039028 59.41094146 -7 59 C-8.63198853 57.81141663 -8.63198853 57.81141663 -10 56 C-10.38095093 53.56468201 -10.38095093 53.56468201 -10.38818359 50.64233398 C-10.40236832 49.00064491 -10.40236832 49.00064491 -10.4168396 47.32579041 C-10.41076691 46.14449051 -10.40469421 44.96319061 -10.3984375 43.74609375 C-10.40130768 42.53429947 -10.40417786 41.32250519 -10.40713501 40.07398987 C-10.40917771 37.51099175 -10.40363358 34.94797812 -10.39111328 32.38500977 C-10.37504972 28.44968026 -10.39096328 24.51537575 -10.41015625 20.58007812 C-10.40817413 18.09374772 -10.4043311 15.60741796 -10.3984375 13.12109375 C-10.40451019 11.93776962 -10.41058289 10.7544455 -10.4168396 9.53526306 C-10.40738312 8.44395584 -10.39792664 7.35264862 -10.38818359 6.22827148 C-10.38579681 5.26469223 -10.38341003 4.30111298 -10.38095093 3.30833435 C-10.25523712 2.54658401 -10.12952332 1.78483368 -10 1 C-6.1496895 -1.56687367 -4.41430237 -0.83288724 0 0 Z " fill="#FFFBFA" transform="translate(134,77)"/>
              <path d="M0 0 C5.78877434 4.09449892 8.85412516 7.97900063 10.5625 14.8125 C11.37396681 21.0723868 9.57159303 26.36659543 6.5625 31.8125 C3.18418066 35.69666395 -1.05179165 38.4887253 -6.171875 39.18359375 C-13.31116363 39.34080606 -18.0046336 38.60389542 -23.4375 33.8125 C-29.10493365 27.85442873 -28.78910585 22.13051595 -28.71484375 14.16796875 C-28.23749233 8.39268891 -25.49572625 5.65830061 -21.375 2 C-15.2922764 -2.52968779 -7.02710512 -2.4275454 0 0 Z " fill="#FF6B56" transform="translate(60.4375,87.1875)"/>
              <path d="M0 0 C2.375 1 2.375 1 4 3 C4.58042964 6.92403137 4.25095663 10.24713011 3 14 C-0.21616524 15.60808262 -3.52155272 15.60375416 -7 15 C-9.5625 12.875 -9.5625 12.875 -11 10 C-11 6.36924173 -10.41176127 4.57951586 -8.3125 1.625 C-5.2855819 -0.50202353 -3.63144937 -0.52958637 0 0 Z " fill="#FFF8F7" transform="translate(104,122)"/>
              </svg>
        `,
        },
        link: 'https://patched.network',
      },
    ],
  },
});
