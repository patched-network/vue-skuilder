<template>
  <v-row column align="center" justify="center">
    <CardViewer :view="views[viewIndex]" :data="data" :course_id="'[browsing]'" :card_id="'[browsing]'" />
    <br /><br />
    <div v-if="!suppressSpinner" class="text-subtitle-1 pa-2">
      <v-btn v-if="spinner" icon variant="outlined" color="primary" @click="decrementView">
        <v-icon>mdi-chevron-left</v-icon>
      </v-btn>
      {{ views[viewIndex].name }}
      <v-btn v-if="spinner" icon variant="outlined" color="primary" @click="incrementView">
        <v-icon>mdi-chevron-right</v-icon>
      </v-btn>
    </div>
  </v-row>
</template>

<script lang="ts">
import { ViewData } from '@vue-skuilder/common';
import { defineComponent, PropType } from 'vue';
import { useCardPreviewModeStore, ViewComponent, CardViewer } from '../index';

export default defineComponent({
  name: 'CardBrowser',

  components: {
    CardViewer,
  },

  props: {
    views: {
      type: Array as PropType<Array<ViewComponent>>,
      required: true,
    },
    data: {
      type: Array as PropType<ViewData[]>,
      required: true,
    },
    suppressSpinner: {
      type: Boolean,
      default: false,
    },
  },

  data() {
    return {
      viewIndex: 0,
      previewMode: useCardPreviewModeStore(),
    };
  },

  computed: {
    spinner(): boolean {
      return this.views.length > 1;
    },
  },

  created() {
    console.log(`[CardBrowser] Card browser created. Cards now in 'prewviewMode'`);
    this.previewMode.setPreviewMode(true);
  },

  unmounted() {
    console.log(`[CardBrowser] Card browser unmounted. Cards no longer in 'prewviewMode'`);
    this.previewMode.setPreviewMode(false);
  },

  methods: {
    incrementView() {
      this.viewIndex++;
      this.viewIndex = (this.viewIndex + this.views.length) % this.views.length;
    },

    decrementView() {
      this.viewIndex--;
      this.viewIndex = (this.viewIndex + this.views.length) % this.views.length;
    },
  },
});
</script>
