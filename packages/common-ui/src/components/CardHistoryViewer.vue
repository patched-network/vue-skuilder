<template>
  <div class="card-history-viewer">
    <h3 v-if="userId">Card History for User: {{ userId }}</h3>
    <div v-if="loading">Loading...</div>
    <div v-else-if="error" class="error-message">{{ error }}</div>
    <div v-else-if="cardHistory">
      <v-card class="mb-4">
        <v-card-title>Summary</v-card-title>
        <v-list-item>
          <v-list-item-content>
            <v-list-item-title
              >Best Interval: {{ cardHistory.bestInterval }} seconds ({{ bestIntervalHumanized }})</v-list-item-title
            >
            <v-list-item-subtitle>The to-date largest interval between successful card reviews.</v-list-item-subtitle>
          </v-list-item-content>
        </v-list-item>
        <v-list-item>
          <v-list-item-content>
            <v-list-item-title>Lapses: {{ cardHistory.lapses }}</v-list-item-title>
            <v-list-item-subtitle>The number of times that a card has been failed in review.</v-list-item-subtitle>
          </v-list-item-content>
        </v-list-item>
        <v-list-item>
          <v-list-item-content>
            <v-list-item-title>Streak: {{ cardHistory.streak }}</v-list-item-title>
            <v-list-item-subtitle>The number of consecutive successful impressions on this card.</v-list-item-subtitle>
          </v-list-item-content>
        </v-list-item>
      </v-card>
      <v-data-table :headers="headers" :items="history" class="elevation-1"></v-data-table>
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
  userFriendlyInterval?: string;
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
      cardHistory: null as CardHistory<CardRecord> | null,
      bestIntervalHumanized: '',
      loading: false,
      error: null as string | null,
      headers: [
        { title: 'Timestamp', key: 'formattedTimeStamp' },
        { title: 'Interval', key: 'userFriendlyInterval' },
        { title: 'Time Spent (s)', key: 'timeSpentSeconds' },
        { title: 'Correct?', key: 'isCorrect' },
        { title: 'Performance', key: 'performance' },
        { title: 'Prior Attempts', key: 'priorAttemps' },
        { title: 'User Answer', key: 'userAnswer' },
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
        this.cardHistory = historyDoc;
        this.bestIntervalHumanized = moment.duration(historyDoc.bestInterval, 'seconds').humanize();

        // Sort records by timestamp and format them
        const sortedRecords = [...historyDoc.records].sort(
          (a, b) => moment(a.timeStamp).valueOf() - moment(b.timeStamp).valueOf()
        );

        this.history = sortedRecords.map((record, index) => {
          const currentTime = moment(record.timeStamp);
          const formatted: FormattedRecord = {
            ...record,
            formattedTimeStamp: currentTime.format('YYYY-MM-DD HH:mm:ss'),
            timeSpentSeconds: Math.round(record.timeSpent / 1000),
            isCorrect: (record as any).isCorrect,
            performance: (record as any).performance,
            priorAttemps: (record as any).priorAttemps,
            userAnswer: (record as any).userAnswer,
          };

          // Calculate interval from previous record
          if (index > 0) {
            const previousTime = moment(sortedRecords[index - 1].timeStamp);
            const intervalSeconds = currentTime.diff(previousTime, 'seconds', true);
            formatted.intervalFromPrevious = Math.round(intervalSeconds * 100) / 100;
            formatted.userFriendlyInterval = `${formatted.intervalFromPrevious} sec (${moment.duration(intervalSeconds, 'seconds').humanize()})`;
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
