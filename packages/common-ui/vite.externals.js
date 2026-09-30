// Dependencies common-ui's builds leave as bare imports. Shared by the main
// build (vite.config.js) and the admin entry (vite.config.admin.js).

export const external = [
  'vue',
  'vue-router',
  'vuetify',
  'pinia',
  '@vue-skuilder/db',
  '@vue-skuilder/common',
  '@vojtechlanka/vue-tags-input',
  'vuedraggable',
  'sortablejs',
  'moment',
];

// Global variables to use in UMD build for externalized deps
export const globals = {
  vue: 'Vue',
  'vue-router': 'VueRouter',
  vuetify: 'Vuetify',
  pinia: 'Pinia',
  '@vue-skuilder/db': 'VueSkuilderDb',
  '@vue-skuilder/common': 'VueSkuilderCommon',
  '@vojtechlanka/vue-tags-input': 'VueTagsInput',
  vuedraggable: 'VueDraggable',
  sortablejs: 'Sortable',
};
