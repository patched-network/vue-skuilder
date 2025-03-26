declare module 'vuetify/lib' {
  import Vuetify from 'vuetify';
  export default Vuetify;
}

declare module 'vuetify/types' {
  import Vue from 'vue';
  interface Vue {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    $vuetify: any;
  }
}
