<template>
  <div>
    <h2>Stats!</h2>
    One day: {{ scheduledReviews[0] }}
    <br />
    Seven day: {{ scheduledReviews[1] }}
    <br />
    Thirty Day: {{ scheduledReviews[2] }}
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { User } from '@vue-skuilder/db';
import { getCurrentUser } from '@vue-skuilder/common-ui';

const user = ref<User | null>(null);
const scheduledReviews = ref<number[]>([]);

onMounted(async () => {
  user.value = await getCurrentUser();

  // Using Promise.all to handle all forecasts concurrently
  const days = [1, 7, 30];
  const forecasts = await Promise.all(days.map((d) => user.value!.getReviewsForcast(d)));
  scheduledReviews.value = forecasts.map((f) => f.length);
});
</script>

<style scoped></style>
