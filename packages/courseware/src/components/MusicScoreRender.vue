<template>
  <div ref="container"></div>
</template>

<script lang="ts">
import { defineComponent, ref, onMounted, watch } from 'vue';
import abcjs from 'abcjs';

export default defineComponent({
  name: 'MusicScoreRenderer',

  props: {
    abcString: {
      type: String,
      required: true,
    },
  },

  setup(props) {
    const container = ref<HTMLDivElement>();

    const render = () => {
      if (container.value) {
        abcjs.renderAbc(container.value, props.abcString, { responsive: 'resize' });
      }
    };

    onMounted(render);
    watch(() => props.abcString, render);

    return { container };
  },
});
</script>

<style scoped>
div {
  width: 100%;
}
</style>
