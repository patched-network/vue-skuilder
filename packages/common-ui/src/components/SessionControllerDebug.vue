<template>
  <v-card v-if="sessionController" class="session-debug ma-2" elevation="2">
    <v-card-title class="text-caption bg-grey-darken-3">
      Session Controller Debug
      <v-spacer></v-spacer>
      <v-icon size="small">mdi-bug</v-icon>
    </v-card-title>

    <v-card-text class="pa-2">
      <v-row dense>
        <!-- Review Queue -->
        <v-col cols="12" md="4">
          <div class="debug-section">
            <div class="debug-header">
              <v-icon size="x-small" class="mr-1">mdi-calendar-check</v-icon>
              <strong>Review Queue</strong>
            </div>
            <div class="debug-stats">
              <span class="text-caption">Length: {{ debugInfo.reviewQueue.length }}</span>
              <span class="text-caption ml-2">Dequeued: {{ debugInfo.reviewQueue.dequeueCount }}</span>
            </div>
            <div v-if="debugInfo.reviewQueue.items.length > 0" class="debug-items">
              <div
                v-for="(item, idx) in debugInfo.reviewQueue.items.slice(0, 5)"
                :key="idx"
                class="debug-item"
              >
                <span class="text-caption">{{ idx }}: {{ item.courseID }}::{{ item.cardID }}</span>
                <span class="text-caption text-grey ml-1">({{ item.status }})</span>
              </div>
              <div v-if="debugInfo.reviewQueue.items.length > 5" class="text-caption text-grey">
                ... +{{ debugInfo.reviewQueue.items.length - 5 }} more
              </div>
            </div>
            <div v-else class="text-caption text-grey">
              (empty)
            </div>
          </div>
        </v-col>

        <!-- New Cards Queue -->
        <v-col cols="12" md="4">
          <div class="debug-section">
            <div class="debug-header">
              <v-icon size="x-small" class="mr-1">mdi-file-document-plus</v-icon>
              <strong>New Cards Queue</strong>
            </div>
            <div class="debug-stats">
              <span class="text-caption">Length: {{ debugInfo.newQueue.length }}</span>
              <span class="text-caption ml-2">Dequeued: {{ debugInfo.newQueue.dequeueCount }}</span>
            </div>
            <div v-if="debugInfo.newQueue.items.length > 0" class="debug-items">
              <div
                v-for="(item, idx) in debugInfo.newQueue.items.slice(0, 5)"
                :key="idx"
                class="debug-item"
              >
                <span class="text-caption">{{ idx }}: {{ item.courseID }}::{{ item.cardID }}</span>
                <span class="text-caption text-grey ml-1">({{ item.status }})</span>
              </div>
              <div v-if="debugInfo.newQueue.items.length > 5" class="text-caption text-grey">
                ... +{{ debugInfo.newQueue.items.length - 5 }} more
              </div>
            </div>
            <div v-else class="text-caption text-grey">
              (empty)
            </div>
          </div>
        </v-col>

        <!-- Failed Cards Queue -->
        <v-col cols="12" md="4">
          <div class="debug-section">
            <div class="debug-header">
              <v-icon size="x-small" class="mr-1">mdi-alert-circle</v-icon>
              <strong>Failed Cards Queue</strong>
            </div>
            <div class="debug-stats">
              <span class="text-caption">Length: {{ debugInfo.failedQueue.length }}</span>
              <span class="text-caption ml-2">Dequeued: {{ debugInfo.failedQueue.dequeueCount }}</span>
            </div>
            <div v-if="debugInfo.failedQueue.items.length > 0" class="debug-items">
              <div
                v-for="(item, idx) in debugInfo.failedQueue.items.slice(0, 5)"
                :key="idx"
                class="debug-item"
              >
                <span class="text-caption">{{ idx }}: {{ item.courseID }}::{{ item.cardID }}</span>
                <span class="text-caption text-grey ml-1">({{ item.status }})</span>
              </div>
              <div v-if="debugInfo.failedQueue.items.length > 5" class="text-caption text-grey">
                ... +{{ debugInfo.failedQueue.items.length - 5 }} more
              </div>
            </div>
            <div v-else class="text-caption text-grey">
              (empty)
            </div>
          </div>
        </v-col>
      </v-row>

      <!-- Hydrated Cards Cache -->
      <v-row dense>
        <v-col cols="12">
          <v-divider class="my-2"></v-divider>
          <div class="debug-section">
            <div class="debug-header">
              <v-icon size="x-small" class="mr-1">mdi-database</v-icon>
              <strong>Hydrated Cards Cache</strong>
            </div>
            <div class="debug-stats">
              <span class="text-caption">Cached: {{ debugInfo.hydratedCache.count }}</span>
              <span class="text-caption ml-2">Failed Cache: {{ debugInfo.hydratedCache.failedCacheSize }}</span>
            </div>
            <div v-if="debugInfo.hydratedCache.items.length > 0" class="debug-items">
              <div
                v-for="(item, idx) in debugInfo.hydratedCache.items.slice(0, 8)"
                :key="idx"
                class="debug-item d-inline-block mr-3"
              >
                <span class="text-caption">{{ item.courseID }}::{{ item.cardID }}</span>
              </div>
              <div v-if="debugInfo.hydratedCache.items.length > 8" class="text-caption text-grey">
                ... +{{ debugInfo.hydratedCache.items.length - 8 }} more
              </div>
            </div>
            <div v-else class="text-caption text-grey">
              (empty)
            </div>
          </div>
        </v-col>
      </v-row>
    </v-card-text>
  </v-card>
</template>

<script lang="ts">
import { defineComponent, PropType, computed, ref, onMounted, onUnmounted } from 'vue';
import { SessionController } from '@vue-skuilder/db';

interface QueueDebugInfo {
  length: number;
  dequeueCount: number;
  items: Array<{ courseID: string; cardID: string; status: string }>;
}

interface HydratedCacheInfo {
  count: number;
  failedCacheSize: number;
  items: Array<{ courseID: string; cardID: string }>;
}

export interface SessionDebugInfo {
  reviewQueue: QueueDebugInfo;
  newQueue: QueueDebugInfo;
  failedQueue: QueueDebugInfo;
  hydratedCache: HydratedCacheInfo;
}

export default defineComponent({
  name: 'SessionControllerDebug',

  props: {
    sessionController: {
      type: Object as PropType<SessionController<any> | null>,
      required: true,
    },
  },

  setup(props) {
    const refreshTrigger = ref(0);
    let pollInterval: NodeJS.Timeout | null = null;

    onMounted(() => {
      // Poll every 500ms to update debug display
      pollInterval = setInterval(() => {
        refreshTrigger.value++;
      }, 500);
    });

    onUnmounted(() => {
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    });

    const debugInfo = computed((): SessionDebugInfo => {
      // Create dependency on refreshTrigger to force updates
      refreshTrigger.value;

      if (!props.sessionController) {
        return {
          reviewQueue: { length: 0, dequeueCount: 0, items: [] },
          newQueue: { length: 0, dequeueCount: 0, items: [] },
          failedQueue: { length: 0, dequeueCount: 0, items: [] },
          hydratedCache: { count: 0, failedCacheSize: 0, items: [] },
        };
      }

      return props.sessionController.getDebugInfo();
    });

    return {
      debugInfo,
    };
  },
});
</script>

<style scoped>
.session-debug {
  font-family: 'Courier New', monospace;
  font-size: 0.75rem;
  max-height: 400px;
  overflow-y: auto;
}

.debug-section {
  padding: 8px;
  background-color: rgba(255, 255, 255, 0.05);
  border-radius: 4px;
  min-height: 120px;
}

.debug-header {
  display: flex;
  align-items: center;
  margin-bottom: 4px;
  padding-bottom: 4px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.debug-stats {
  margin-bottom: 8px;
  display: flex;
  gap: 8px;
}

.debug-items {
  margin-top: 4px;
  padding-left: 8px;
}

.debug-item {
  padding: 2px 0;
  border-left: 2px solid rgba(255, 255, 255, 0.2);
  padding-left: 6px;
  margin-bottom: 2px;
}
</style>
