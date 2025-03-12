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
      {{ snack.text }}
      <v-btn icon variant="text" @click="close()">
        <v-icon>mdi-close</v-icon>
      </v-btn>
    </v-snackbar>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import { Status } from '@vue-skuilder/common';

interface SnackbarOptions {
  text: string;
  status: Status;
  timeout?: number;
}

let globalSnackbarInstance: {
  addSnack: (snack: SnackbarOptions) => void;
} | null = null;

export function alertUser(msg: SnackbarOptions) {
  // Try getting the instance through DOM first
  const element = document.getElementById('SnackbarService');
  if (element) {
    // Vue 3 way to access component instance
    const snackBarService = globalSnackbarInstance;
    if (snackBarService) {
      snackBarService.addSnack(msg);
      return;
    }
  }
  console.error('SnackbarService not found');
}

const SnackbarService = defineComponent({
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
    globalSnackbarInstance = this;
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

export default SnackbarService;
</script>
