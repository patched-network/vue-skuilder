<template>
  <span v-if="radioType" class="text-h5 underline"
    >&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span
  >
  <user-input-string v-else id="input" :icon="false" type="text" :value="processedText" />
</template>

<script lang="ts">
import { defineComponent, ref, computed, onMounted } from 'vue';
import UserInputString from '@/base-course/Components/UserInput/UserInputString.vue';

export default defineComponent({
  name: 'FillInInput',

  components: {
    UserInputString,
  },

  props: {
    text: {
      type: String,
      required: true,
    },
  },

  setup(props) {
    // State
    const inputType = ref<'text' | 'radio'>('text');
    const processedText = ref('');

    // Computed
    const radioType = computed(() => {
      return props.text.split('||').length > 1;
    });

    // Process text on mount
    onMounted(() => {
      console.log(`fillinCreated w/ text: ${props.text}`);

      // Remove mustache syntax
      processedText.value = props.text.substring(2, props.text.length - 2);

      console.log(`fillin text trimmed to: ${processedText.value}`);

      const split = processedText.value.split('||');
      if (split.length > 1) {
        inputType.value = 'radio';
      }
    });

    return {
      inputType,
      radioType,
      processedText,
    };
  },
});
</script>

<style scoped>
#input {
  display: inline-block;
  min-width: 4em;
  text-align: center;
}

.underline {
  text-decoration: underline;
  text-decoration-style: solid 14px;
}
</style>
