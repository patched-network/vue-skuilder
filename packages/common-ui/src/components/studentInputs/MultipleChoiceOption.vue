<template>
  <v-card :class="`${className}`" @mouseover="select" @click="submitThisOption">
    <markdown-renderer :md="content" />
  </v-card>
</template>

<script lang="ts">
import { defineComponent, defineAsyncComponent, PropType } from 'vue';

export default defineComponent({
  name: 'MultipleChoiceOption',

  components: {
    MarkdownRenderer: defineAsyncComponent(() => import('@/components/cardRendering/MarkdownRenderer.vue')),
  },

  props: {
    content: {
      type: String,
      required: true,
    },
    selected: {
      type: Boolean,
      required: true,
    },
    number: {
      type: Number,
      required: true,
    },
    setSelection: {
      type: Function as PropType<(selection: number) => void>,
      required: true,
    },
    submit: {
      type: Function as PropType<() => void>,
      required: true,
    },
    markedWrong: {
      type: Boolean,
      required: true,
    },
  },

  computed: {
    className(): string {
      let color: string;

      switch (this.number) {
        case 0:
          color = 'bg-red';
          break;
        case 1:
          color = 'bg-purple';
          break;
        case 2:
          color = 'bg-indigo';
          break;
        case 3:
          color = 'bg-light-blue';
          break;
        case 4:
          color = 'bg-teal';
          break;
        case 5:
          color = 'bg-deep-orange';
          break;
        default:
          color = 'bg-grey';
          break;
      }

      if (this.selected && !this.markedWrong) {
        return `choice selected ${color} lighten-3 elevation-8`;
      } else if (!this.selected && !this.markedWrong) {
        return `choice not-selected ${color} lighten-4 elevation-1`;
      } else if (this.selected && this.markedWrong) {
        return `choice selected grey lighten-2 elevation-8`;
      } else if (!this.selected && this.markedWrong) {
        return 'choice not-selected grey lighten-2 elevation-0';
      } else {
        throw new Error(
          `'selected' and 'markedWrong' props in MultipleChoiceOption are in an impossible configuration.`
        );
      }
    },
  },

  methods: {
    select(): void {
      this.setSelection(this.number);
    },

    submitThisOption(): void {
      if (this.markedWrong) {
        return;
      } else {
        this.select();
        this.submit();
      }
    },
  },
});
</script>

<style scoped>
.choice {
  text-align: center;
  display: inline-block;
  border-radius: 4px;
  padding-left: 15px;
  padding-right: 15px;
  padding-top: 5px;
  padding-bottom: 5px;
  margin: 10px;
  min-width: 75px; /* prevent tiny click-btns on, eg, one-letter answers */
  transition: all 0.2s ease-in-out;
}

.selected {
  transform: translateY(-10px) /* rotate(3deg) */ scale(1.15);
  z-index: 1;
}

.not-selected {
  z-index: 0;
}
</style>
