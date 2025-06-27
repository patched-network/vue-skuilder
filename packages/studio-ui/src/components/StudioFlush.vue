<template>
  <v-btn
    color="success"
    :loading="flushing"
    :disabled="flushing"
    @click="handleFlush"
  >
    <v-icon start>mdi-content-save</v-icon>
    Flush to Static
  </v-btn>

  <!-- Flush status dialog -->
  <v-dialog v-model="showDialog" max-width="600" persistent>
    <v-card>
      <v-card-title>
        <v-icon :color="dialogIcon.color" class="me-2">{{ dialogIcon.icon }}</v-icon>
        {{ dialogTitle }}
      </v-card-title>
      
      <v-card-text>
        <div v-if="flushing">
          <v-progress-linear indeterminate class="mb-4" />
          <p>{{ flushStatus }}</p>
        </div>
        
        <div v-else-if="flushError">
          <v-alert type="error" class="mb-4">
            {{ flushError }}
          </v-alert>
          <p>The flush operation failed. Please check the console for more details.</p>
        </div>
        
        <div v-else>
          <v-alert type="success" class="mb-4">
            Course successfully saved to static files!
          </v-alert>
          <p>Your changes have been packed and saved to the course directory.</p>
        </div>
      </v-card-text>
      
      <v-card-actions>
        <v-spacer />
        <v-btn 
          v-if="!flushing" 
          color="primary" 
          @click="showDialog = false"
        >
          Close
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';

interface Props {
  courseId: string;
}

const props = defineProps<Props>();

// Flush state
const flushing = ref(false);
const flushError = ref<string | null>(null);
const flushStatus = ref('');
const showDialog = ref(false);

// Computed properties for dialog display
const dialogTitle = computed(() => {
  if (flushing.value) return 'Saving Course...';
  if (flushError.value) return 'Save Failed';
  return 'Course Saved';
});

const dialogIcon = computed(() => {
  if (flushing.value) return { icon: 'mdi-loading', color: 'primary' };
  if (flushError.value) return { icon: 'mdi-alert-circle', color: 'error' };
  return { icon: 'mdi-check-circle', color: 'success' };
});

// Flush operation
async function handleFlush() {
  flushing.value = true;
  flushError.value = null;
  showDialog.value = true;
  
  try {
    flushStatus.value = 'Connecting to CLI...';
    
    // TODO: Implement actual flush functionality
    // This will need to communicate with the CLI process to trigger packing
    // Options:
    // 1. HTTP endpoint in CLI
    // 2. File-based communication
    // 3. WebSocket connection
    
    // Simulate flush process for now
    await simulateFlush();
    
  } catch (error) {
    console.error('Flush failed:', error);
    flushError.value = error instanceof Error ? error.message : 'Unknown error occurred';
  } finally {
    flushing.value = false;
  }
}

// Temporary simulation of flush process
async function simulateFlush() {
  const steps = [
    'Validating course data...',
    'Exporting from database...',
    'Processing attachments...',
    'Generating static files...',
    'Writing to course directory...'
  ];
  
  for (const step of steps) {
    flushStatus.value = step;
    await new Promise(resolve => setTimeout(resolve, 800));
  }
}
</script>