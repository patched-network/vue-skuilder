import Vue from 'vue';
import { Store } from 'vuex';
import { AppState } from '@/store';

export default class SkldrVue extends Vue {
  public $store: Store<AppState>;
}
