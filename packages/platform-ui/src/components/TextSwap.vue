<template>
  <transition appear name="fade" mode="out-in">
    <a :key="index" @click="next()">{{ text[index] }}</a>
  </transition>
</template>

<script lang="ts">
import { defineComponent } from 'vue';

export interface ITextSwap {
  next: () => void;
  text: string[];
  index: number;
}

export default defineComponent({
  name: 'TextSwap',

  props: {
    text: {
      type: Array as () => string[],
      required: true,
    },
  },

  data() {
    return {
      index: 0,
    };
  },

  methods: {
    next() {
      if (this.text.length > 1) {
        const previous = this.index;
        // this.index = -1; // triggering animation
        // this.index = previous;
        while (this.index === previous) {
          this.index = Math.floor(Math.random() * this.text.length);
        }
      }
    },
  },
});
</script>

<style scoped>
a {
  color: inherit;
  text-decoration: underline;
  text-decoration-color: #aaa;
  text-decoration-style: dotted;
  text-underline-offset: 2px;
  text-underline-position: below;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.5s ease;
}
.fade-enter,
.fade-leave-to {
  opacity: 0;
}
</style>
