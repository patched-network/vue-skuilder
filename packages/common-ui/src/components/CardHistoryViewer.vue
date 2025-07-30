<template>
  <div class="card-history-viewer">
    <h3 v-if="userId">Card History for User: {{ userId }}</h3>
    <div v-if="loading">Loading...</div>
    <div v-else-if="error" class="error-message">{{ error }}</div>
    <div v-else>
      <v-data-table
        :headers="headers"
        :items="history"
        class="elevation-1"
      >
        <template v-slot:item.hasNegativeInterval="{ item }">
          <v-chip
            :color="item.hasNegativeInterval ? 'error' : 'success'"
            :text-color="'white'"
            small
          >
            {{ item.hasNegativeInterval ? 'INVALID' : 'Valid' }}
          </v-chip>
        </template>
        
        <template v-slot:item.intervalFromPrevious="{ item }">
          <span 
            :class="{ 'negative-interval': item.hasNegativeInterval }"
          >
            {{ item.intervalFromPrevious !== undefined ? item.intervalFromPrevious : '-' }}
          </span>
        </template>

        <template v-slot:item.formattedTimeStamp="{ item }">
          <span 
            :class="{ 'invalid-timestamp': item.hasNegativeInterval }"
          >
            {{ item.formattedTimeStamp }}
          </span>
        </template>
      </v-data-table>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, PropType } from 'vue';
import { UserDBInterface, UserDBReader, CardHistory, CardRecord, getCardHistoryID } from '@vue-skuilder/db';
import moment, { Moment } from 'moment';

interface FormattedRecord extends CardRecord {
  formattedTimeStamp: string;
  intervalFromPrevious?: number;
  hasNegativeInterval?: boolean;
  timeSpentSeconds: number;
}

export default defineComponent({
  name: 'CardHistoryViewer',
  props: {
    cardId: {
      type: String,
      required: true,
    },
    courseId: {
      type: String,
      required: true,
    },
    userId: {
      type: String,
      required: true,
    },
    userDB: {
      type: Object as PropType<UserDBReader>,
      required: true,
    },
  },
  data() {
    return {
      history: [] as FormattedRecord[],
      loading: false,
      error: null as string | null,
      headers: [
        { title: 'Timestamp', key: 'formattedTimeStamp' },
        { title: 'Interval (min)', key: 'intervalFromPrevious' },
        { title: 'Time Spent (s)', key: 'timeSpentSeconds' },
        { title: 'Valid', key: 'hasNegativeInterval' },
      ],
    };
  },
  watch: {
    cardId: {
      immediate: true,
      handler(newCardId) {
        if (newCardId && this.userDB) {
          this.fetchHistory();
        }
      },
    },
    userDB: {
      handler(newUserDB) {
        if (newUserDB && this.cardId) {
          this.fetchHistory();
        }
      },
    },
  },
  methods: {
    async fetchHistory() {
      this.loading = true;
      this.error = null;
      try {
        const cardHistoryID = getCardHistoryID(this.courseId, this.cardId);
        const historyDoc: CardHistory<CardRecord> = await this.userDB.get(cardHistoryID);
        
        // Sort records by timestamp and format them
        const sortedRecords = [...historyDoc.records].sort((a, b) => 
          moment(a.timeStamp).valueOf() - moment(b.timeStamp).valueOf()
        );
        
        this.history = sortedRecords.map((record, index) => {
          const currentTime = moment(record.timeStamp);
          const formatted: FormattedRecord = {
            ...record,
            formattedTimeStamp: currentTime.format('YYYY-MM-DD HH:mm:ss'),
            timeSpentSeconds: Math.round(record.timeSpent / 1000),
          };
          
          // Calculate interval from previous record
          if (index > 0) {
            const previousTime = moment(sortedRecords[index - 1].timeStamp);
            const intervalMinutes = currentTime.diff(previousTime, 'minutes', true);
            formatted.intervalFromPrevious = Math.round(intervalMinutes * 100) / 100;
            formatted.hasNegativeInterval = intervalMinutes < 0;
          }
          
          return formatted;
        });
      } catch (e) {
        this.error = 'Error fetching card history.';
        console.error(e);
      } finally {
        this.loading = false;
      }
    },
  },
});
</script>

<style scoped>
.error-message {
  color: #f44336;
  padding: 16px;
  background-color: #ffebee;
  border-radius: 4px;
  margin: 8px 0;
}

.negative-interval {
  color: #f44336;
  font-weight: bold;
  background-color: #ffebee;
  padding: 2px 4px;
  border-radius: 3px;
}

.invalid-timestamp {
  color: #f44336;
  font-weight: bold;
}

.card-history-viewer {
  margin: 16px 0;
}
</style>
