<template>
  <HeatMap :activityRecords="activityRecords" />
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import { HeatMap, ActivityRecord } from '@vue-skuilder/common-ui';
import { CardHistory, CardRecord } from '@vue-skuilder/db';
import { getCurrentUser } from '@/stores/useAuthStore';

export default defineComponent({
  name: 'HeatMapWrapper',
  components: { HeatMap },

  data() {
    return {
      activityRecords: [] as ActivityRecord[],
    };
  },

  async created() {
    const history = await (await getCurrentUser()).getHistory();

    // Transform history records into the format expected by HeatMap
    const allRecords: ActivityRecord[] = [];
    for (let i = 0; i < history.length; i++) {
      if (history[i] && history[i]!.records) {
        history[i]!.records.forEach((record: CardRecord) => {
          allRecords.push({
            timeStamp: record.timeStamp,
            ...record,
          });
        });
      }
    }

    this.activityRecords = allRecords;
  },
});
</script>
