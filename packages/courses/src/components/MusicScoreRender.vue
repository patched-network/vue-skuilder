<template>
  <div id="abc"></div>
</template>

<script lang="ts">
import abc from 'abcjs';
import { defineComponent } from 'vue';

export default defineComponent({
  name: 'MusicScoreRenderer',

  props: {
    abcString: {
      type: String,
      required: true
    }
  },

  mounted() {
    abc.renderAbc('abc', this.abcString);
  }
});
</script>

<style>
#abc {
  width: 100%;
  height: 100%;
}
</style>
