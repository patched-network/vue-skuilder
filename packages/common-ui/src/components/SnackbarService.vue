<template>
  <div>
    <v-snackbar
      v-for="snack in snacks"
      :key="snacks.indexOf(snack)"
      v-model="show[snacks.indexOf(snack)]"
      :timeout="snack.timeout"
      location="bottom right"
      :color="getColor(snack)"
    >
      <div class="d-flex align-center justify-space-between w-100">
        <span>{{ snack.text }}</span>
        <v-btn icon variant="text" @click="close()">
          <v-icon>mdi-close</v-icon>
        </v-btn>
      </div>
    </v-snackbar>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import { Status } from '@vue-skuilder/common';
import { SnackbarOptions, setInstance } from './SnackbarService';

export default defineComponent({
  name: 'SnackbarService',

  data() {
    return {
      /**
       * A history of snacks served in this session.
       *
       * Possible future work: write these to localstorage/pouchdb
       * for persistance
       */
      snacks: [] as SnackbarOptions[],
      show: [] as boolean[],
    };
  },
  mounted() {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    setInstance(this);
  },

  methods: {
    addSnack(snack: SnackbarOptions): void {
      this.snacks.push(snack);
      this.show.push(true);
    },

    close(): void {
      this.show.pop();
      this.show.push(false);
    },

    getColor(snack: SnackbarOptions): string | undefined {
      if (snack.status === Status.ok) {
        return 'success';
      } else if (snack.status === Status.error) {
        return 'error';
      } else if (snack.status === Status.warning) {
        return 'yellow';
      }
      return undefined;
    },
  },
});
</script>
