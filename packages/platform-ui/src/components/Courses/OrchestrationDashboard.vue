<template>
  <v-expansion-panels v-if="isAdmin" class="my-3">
    <v-expansion-panel>
      <v-expansion-panel-title>
        <v-icon start>mdi-chart-line</v-icon>
        Orchestration Dashboard
        <v-chip v-if="loading" size="small" class="ml-2">Loading...</v-chip>
      </v-expansion-panel-title>
      <v-expansion-panel-text>
        <v-card flat>
          <v-card-text>
            <!-- Update Controls -->
            <div class="mb-4">
              <v-btn
                color="primary"
                :loading="updating"
                :disabled="updating"
                @click="triggerUpdate"
              >
                <v-icon start>mdi-refresh</v-icon>
                Trigger Period Update
              </v-btn>
              <span v-if="lastUpdate" class="ml-3 text-caption">
                Last update: {{ new Date(lastUpdate).toLocaleString() }}
              </span>
            </div>

            <!-- Strategy Weights Table -->
            <v-card v-if="weights.length > 0" class="mb-4">
              <v-card-title>Current Strategy Weights</v-card-title>
              <v-card-text>
                <v-table density="compact">
                  <thead>
                    <tr>
                      <th>Strategy</th>
                      <th>Implementation</th>
                      <th>Weight</th>
                      <th>Confidence</th>
                      <th>Samples</th>
                      <th>Static</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="w in weights" :key="w.strategyId">
                      <td>{{ w.strategyName }}</td>
                      <td><code class="text-caption">{{ w.implementingClass }}</code></td>
                      <td>
                        <v-chip
                          v-if="w.learnable"
                          size="small"
                          :color="getWeightColor(w.learnable.weight)"
                        >
                          {{ w.learnable.weight.toFixed(2) }}
                        </v-chip>
                        <span v-else class="text-caption text-medium-emphasis">—</span>
                      </td>
                      <td>
                        <v-progress-linear
                          v-if="w.learnable"
                          :model-value="w.learnable.confidence * 100"
                          height="8"
                          :color="getConfidenceColor(w.learnable.confidence)"
                        />
                        <span v-else class="text-caption text-medium-emphasis">—</span>
                      </td>
                      <td>
                        <span v-if="w.learnable" class="text-caption">
                          {{ w.learnable.sampleSize }}
                        </span>
                        <span v-else class="text-caption text-medium-emphasis">—</span>
                      </td>
                      <td>
                        <v-icon v-if="w.staticWeight" size="small" color="warning">
                          mdi-lock
                        </v-icon>
                      </td>
                      <td>
                        <v-btn
                          v-if="w.learnable"
                          size="x-small"
                          variant="text"
                          @click="showStrategyDetails(w.strategyId)"
                        >
                          Details
                        </v-btn>
                      </td>
                    </tr>
                  </tbody>
                </v-table>
              </v-card-text>
            </v-card>

            <!-- Strategy Details Dialog -->
            <v-dialog v-model="detailsDialog" max-width="1000">
              <v-card v-if="selectedStrategy">
                <v-card-title>
                  {{ selectedStrategy.strategyName }}
                  <v-chip size="small" class="ml-2">{{ selectedStrategy.strategyId }}</v-chip>
                </v-card-title>

                <v-card-text>
                  <!-- Current State -->
                  <v-card class="mb-4" variant="outlined">
                    <v-card-title class="text-subtitle-1">Current State</v-card-title>
                    <v-card-text>
                      <v-row>
                        <v-col cols="3">
                          <div class="text-caption text-medium-emphasis">Peak Weight</div>
                          <div class="text-h6">{{ selectedStrategyState?.currentWeight?.weight.toFixed(3) || '—' }}</div>
                        </v-col>
                        <v-col cols="3">
                          <div class="text-caption text-medium-emphasis">Confidence</div>
                          <div class="text-h6">{{ (selectedStrategyState?.currentWeight?.confidence * 100).toFixed(1) || '—' }}%</div>
                        </v-col>
                        <v-col cols="3">
                          <div class="text-caption text-medium-emphasis">Samples</div>
                          <div class="text-h6">{{ selectedStrategyState?.currentWeight?.sampleSize || 0 }}</div>
                        </v-col>
                        <v-col cols="3">
                          <div class="text-caption text-medium-emphasis">Gradient</div>
                          <div class="text-h6" :class="getGradientColor(selectedStrategyState?.regression?.gradient)">
                            {{ selectedStrategyState?.regression?.gradient.toFixed(4) || '—' }}
                          </div>
                        </v-col>
                      </v-row>
                      <v-row v-if="selectedStrategyState?.regression">
                        <v-col cols="4">
                          <div class="text-caption text-medium-emphasis">R²</div>
                          <div class="text-body-2">{{ selectedStrategyState.regression.rSquared.toFixed(3) }}</div>
                        </v-col>
                        <v-col cols="4">
                          <div class="text-caption text-medium-emphasis">Intercept</div>
                          <div class="text-body-2">{{ selectedStrategyState.regression.intercept.toFixed(3) }}</div>
                        </v-col>
                        <v-col cols="4">
                          <div class="text-caption text-medium-emphasis">Last Computed</div>
                          <div class="text-body-2">{{ new Date(selectedStrategyState.regression.computedAt).toLocaleString() }}</div>
                        </v-col>
                      </v-row>
                    </v-card-text>
                  </v-card>

                  <!-- Weight History -->
                  <v-card v-if="selectedStrategyState?.history?.length" class="mb-4" variant="outlined">
                    <v-card-title class="text-subtitle-1">Weight Trajectory (last 10)</v-card-title>
                    <v-card-text>
                      <v-table density="compact">
                        <thead>
                          <tr>
                            <th>Timestamp</th>
                            <th>Weight</th>
                            <th>Confidence</th>
                            <th>Gradient</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr v-for="(h, i) in selectedStrategyState.history.slice(-10).reverse()" :key="i">
                            <td class="text-caption">{{ new Date(h.timestamp).toLocaleString() }}</td>
                            <td>
                              <v-chip size="x-small" :color="getWeightColor(h.weight)">
                                {{ h.weight.toFixed(3) }}
                              </v-chip>
                            </td>
                            <td>
                              <v-progress-linear
                                :model-value="h.confidence * 100"
                                height="6"
                                :color="getConfidenceColor(h.confidence)"
                              />
                            </td>
                            <td :class="getGradientColor(h.gradient)">
                              {{ h.gradient.toFixed(4) }}
                            </td>
                          </tr>
                        </tbody>
                      </v-table>
                    </v-card-text>
                  </v-card>

                  <!-- Scatter Plot Data Preview -->
                  <v-card v-if="scatterData?.data?.length" variant="outlined">
                    <v-card-title class="text-subtitle-1">
                      Recent Observations ({{ scatterData.observations }})
                      <v-chip size="small" class="ml-2">Last 7 days</v-chip>
                    </v-card-title>
                    <v-card-text>
                      <div v-if="scatterData.regression" class="mb-2">
                        <strong>Regression:</strong>
                        outcome = {{ scatterData.regression.gradient.toFixed(4) }} × deviation +
                        {{ scatterData.regression.intercept.toFixed(4) }}
                        (R² = {{ scatterData.regression.rSquared.toFixed(3) }})
                      </div>
                      <v-table density="compact">
                        <thead>
                          <tr>
                            <th>User</th>
                            <th>Deviation</th>
                            <th>Outcome</th>
                            <th>Period End</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr v-for="(d, i) in scatterData.data.slice(0, 20)" :key="i">
                            <td class="text-caption">{{ d.userId.substring(0, 8) }}...</td>
                            <td>
                              <v-chip size="x-small" :color="d.deviation > 0 ? 'blue' : 'orange'">
                                {{ d.deviation.toFixed(3) }}
                              </v-chip>
                            </td>
                            <td>
                              <v-chip size="x-small" :color="d.outcome > 0.7 ? 'green' : 'red'">
                                {{ d.outcome.toFixed(3) }}
                              </v-chip>
                            </td>
                            <td class="text-caption">{{ new Date(d.periodEnd).toLocaleString() }}</td>
                          </tr>
                        </tbody>
                      </v-table>
                      <div v-if="scatterData.data.length > 20" class="text-caption text-center mt-2">
                        Showing 20 of {{ scatterData.data.length }} observations
                      </div>
                    </v-card-text>
                  </v-card>
                </v-card-text>

                <v-card-actions>
                  <v-spacer />
                  <v-btn @click="detailsDialog = false">Close</v-btn>
                </v-card-actions>
              </v-card>
            </v-dialog>

            <!-- Error Display -->
            <v-alert v-if="error" type="error" class="mt-4">
              {{ error }}
            </v-alert>
          </v-card-text>
        </v-card>
      </v-expansion-panel-text>
    </v-expansion-panel>
  </v-expansion-panels>
</template>

<script lang="ts">
import { defineComponent, PropType } from 'vue';
import axios from 'axios';

interface LearnableWeight {
  weight: number;
  confidence: number;
  sampleSize: number;
}

interface StrategyWeight {
  strategyId: string;
  strategyName: string;
  implementingClass: string;
  learnable: LearnableWeight | null;
  staticWeight: boolean;
}

interface StrategyState {
  strategyId: string;
  currentWeight: LearnableWeight;
  regression: {
    gradient: number;
    intercept: number;
    rSquared: number;
    sampleSize: number;
    computedAt: string;
  };
  history: Array<{
    timestamp: string;
    weight: number;
    confidence: number;
    gradient: number;
  }>;
}

interface ScatterData {
  observations: number;
  data: Array<{
    userId: string;
    deviation: number;
    outcome: number;
    periodEnd: string;
  }>;
  regression: {
    gradient: number;
    intercept: number;
    rSquared: number;
  } | null;
}

export default defineComponent({
  name: 'OrchestrationDashboard',

  props: {
    courseId: {
      type: String as PropType<string>,
      required: true,
    },
    isAdmin: {
      type: Boolean,
      default: false,
    },
  },

  data() {
    return {
      loading: false,
      updating: false,
      error: null as string | null,
      weights: [] as StrategyWeight[],
      lastUpdate: null as string | null,
      detailsDialog: false,
      selectedStrategy: null as StrategyWeight | null,
      selectedStrategyState: null as StrategyState | null,
      scatterData: null as ScatterData | null,
    };
  },

  async created() {
    if (this.isAdmin) {
      await this.loadWeights();
    }
  },

  methods: {
    async loadWeights() {
      this.loading = true;
      this.error = null;
      try {
        const response = await axios.get(`/orchestration/${this.courseId}/weights`);
        this.weights = response.data.weights;
      } catch (e: unknown) {
        this.error = `Failed to load weights: ${e instanceof Error ? e.message : String(e)}`;
      } finally {
        this.loading = false;
      }
    },

    async triggerUpdate() {
      this.updating = true;
      this.error = null;
      try {
        const response = await axios.post(`/orchestration/${this.courseId}/update`);
        this.lastUpdate = new Date().toISOString();

        // Reload weights after update
        await this.loadWeights();

        // Show success message with details
        const { strategiesUpdated, outcomesProcessed } = response.data;
        alert(`Update complete!\n${strategiesUpdated} strategies updated\n${outcomesProcessed} outcomes processed`);
      } catch (e: unknown) {
        const errorMsg =
          e && typeof e === 'object' && 'response' in e
            ? (e as { response?: { data?: { error?: string } } }).response?.data?.error
            : e instanceof Error
              ? e.message
              : String(e);
        this.error = `Failed to trigger update: ${errorMsg}`;
      } finally {
        this.updating = false;
      }
    },

    async showStrategyDetails(strategyId: string) {
      this.selectedStrategy = this.weights.find((w) => w.strategyId === strategyId) || null;
      this.selectedStrategyState = null;
      this.scatterData = null;
      this.detailsDialog = true;

      try {
        // Load strategy history
        const historyResponse = await axios.get(
          `/orchestration/${this.courseId}/strategy/${strategyId}/history`
        );
        this.selectedStrategyState = historyResponse.data;

        // Load scatter data
        const scatterResponse = await axios.get(
          `/orchestration/${this.courseId}/strategy/${strategyId}/scatter`
        );
        this.scatterData = scatterResponse.data;
      } catch (e: unknown) {
        this.error = `Failed to load strategy details: ${e instanceof Error ? e.message : String(e)}`;
      }
    },

    getWeightColor(weight: number): string {
      if (weight < 0.5) return 'red';
      if (weight < 0.8) return 'orange';
      if (weight < 1.2) return 'green';
      if (weight < 1.5) return 'blue';
      return 'purple';
    },

    getConfidenceColor(confidence: number): string {
      if (confidence < 0.3) return 'red';
      if (confidence < 0.6) return 'orange';
      if (confidence < 0.8) return 'blue';
      return 'green';
    },

    getGradientColor(gradient: number | undefined): string {
      if (!gradient) return '';
      if (gradient > 0.01) return 'text-green';
      if (gradient < -0.01) return 'text-red';
      return 'text-grey';
    },
  },
});
</script>

<style scoped>
.text-green {
  color: rgb(var(--v-theme-success));
}

.text-red {
  color: rgb(var(--v-theme-error));
}

.text-grey {
  color: rgb(var(--v-theme-medium-emphasis));
}
</style>
