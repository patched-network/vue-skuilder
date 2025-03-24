<template>
  <v-container class="about">
    <v-row>
      <v-col>
        <h1 class="text-h2 mb-6">Todo.</h1>

        <p class="text-body-1 mb-4">
          This is a placeholder for the about page. It will be filled in with more information later.
        </p>

        <v-btn :to="'./notes'" variant="text" color="primary"> Release Notes </v-btn>
      </v-col>
    </v-row>
  </v-container>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import { SingleDigitMultiplicationQuestion } from '@/courses/math/questions/multiplication';
import { randomInt } from '@/courses/math/utility';

export default defineComponent({
  name: 'AboutView',
  components: {},
  data() {
    return {
      type: 'Viewable',
      problem: new SingleDigitMultiplicationQuestion([
        {
          a: randomInt(0, 10),
          b: randomInt(0, 10),
        },
      ]),
    };
  },
});
</script>
