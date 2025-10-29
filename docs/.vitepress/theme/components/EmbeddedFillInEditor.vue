<template>
  <div class="embedded-fill-in-editor">
    <div class="editor-panel">
      <div class="editor-header">
        <h4>Markdown Source:</h4>
        <div class="editor-buttons">
          <button @click="resetToOriginal" class="reset-button" title="Reset to original">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path
                d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"
              />
            </svg>
            Reset
          </button>
          <button @click="copyToClipboard" class="copy-button" title="Copy to clipboard">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path
                d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"
              />
            </svg>
            Copy
          </button>
        </div>
      </div>
      <textarea
        ref="textareaRef"
        v-model="markdownSource"
        class="editor-textarea"
        placeholder="Enter fill-in markdown with {{mustache}} syntax..."
        @input="autoResize"
      />
    </div>
    <div class="preview-panel">
      <div class="preview-header">
        <h4>Rendered Card:</h4>
        <div v-if="copyStatus" class="copy-status">{{ copyStatus }}</div>
      </div>
      <div class="preview-content">
        <fill-in-view v-if="markdownSource.trim()" :data="viewData" @emit-response="handleResponse" />
        <div v-else class="empty-state">Enter markdown above to see the live preview</div>
        <div v-if="lastResponse" class="response-display">
          <p><strong>Last Response:</strong></p>
          <pre>{{ JSON.stringify(lastResponse, null, 2) }}</pre>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick, watch, provide } from 'vue';
import FillInView from '@vue-skuilder/courseware/default/questions/fillIn/fillIn.vue';

interface Props {
  initialValue?: string;
  inlineComponents?: Record<string, any>;
}

const props = withDefaults(defineProps<Props>(), {
  initialValue: 'The capital of France is {{Paris}}.',
  inlineComponents: () => ({}),
});

// Provide inline components to child components (MarkdownRenderer, etc.)
provide('markdownComponents', props.inlineComponents);

// Reactive state
const originalValue = ref(props.initialValue); // Store original for reset
const markdownSource = ref(props.initialValue);
const copyStatus = ref('');
const lastResponse = ref(null);
const textareaRef = ref<HTMLTextAreaElement | null>(null);

// Convert markdown to ViewData format expected by fillIn.vue
const viewData = computed(() => [
  {
    Input: markdownSource.value,
  },
]);

// Handle card responses (when user interacts with the fill-in)
const handleResponse = (response: any) => {
  console.log('Fill-in response:', response);
  lastResponse.value = {
    isCorrect: response.isCorrect,
    performance: response.performance,
    timestamp: new Date().toISOString(),
  };
};

// Auto-resize textarea to fit content
const autoResize = () => {
  nextTick(() => {
    if (textareaRef.value) {
      // Reset height to auto to get the correct scrollHeight
      textareaRef.value.style.height = 'auto';
      // Set height to scrollHeight (content height) with minimum
      textareaRef.value.style.height = Math.max(textareaRef.value.scrollHeight, 60) + 'px';
    }
  });
};

// Reset to original value
const resetToOriginal = () => {
  markdownSource.value = originalValue.value;
  lastResponse.value = null; // Clear any previous response
  copyStatus.value = 'Reset!';
  setTimeout(() => {
    copyStatus.value = '';
  }, 1500);
  // Resize after reset
  nextTick(() => autoResize());
};

// Copy markdown source to clipboard
const copyToClipboard = async () => {
  try {
    await navigator.clipboard.writeText(markdownSource.value);
    copyStatus.value = 'Copied!';
    setTimeout(() => {
      copyStatus.value = '';
    }, 2000);
  } catch (err) {
    console.error('Failed to copy:', err);
    copyStatus.value = 'Copy failed';
    setTimeout(() => {
      copyStatus.value = '';
    }, 2000);
  }
};

// Initialize auto-resize on mount and when content changes
onMounted(() => {
  autoResize();
});

// Watch for changes in markdownSource to trigger resize
watch(markdownSource, () => {
  autoResize();
});
</script>

<style scoped>
.embedded-fill-in-editor {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0;
  border: 1px solid var(--vp-c-border);
  border-radius: 12px;
  background: var(--vp-c-bg-soft);
  padding: 0;
  margin: 1.5rem 0;
}

.editor-panel,
.preview-panel {
  display: flex;
  flex-direction: column;
}

.editor-header,
.preview-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0;
  padding: 0.75rem 1.5rem 0.5rem 1.5rem;
  position: relative;
}

.editor-header h4,
.preview-header h4 {
  margin: 0;
  color: var(--vp-c-text-2);
  font-size: 0.875rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.editor-buttons {
  display: flex;
  height: 100%;
  gap: 0rem;
  position: absolute;
  right: 0rem;
  top: 0rem;
}

.copy-button,
.reset-button {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  border: 1px solid var(--vp-c-border);
  border-top: none;
  border-bottom: none;
  border-right: none;
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-2);
  padding: 0.375rem 0.625rem;
  font-size: 0.8rem;
  cursor: pointer;
  transition: all 0.2s;
  height: 100%;
}

/* First button (reset) gets left border */
.reset-button {
  border-left: 2px solid var(--vp-c-border);
  border-right: 1px solid var(--vp-c-border);
}

/* Last button (copy) gets right border and rounded top-right corner */
.copy-button {
  border-right: 1px solid var(--vp-c-border);
  border-top-right-radius: 12px;
}

.copy-button:hover,
.reset-button:hover {
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-1);
  border-color: var(--vp-c-brand-1);
}

.copy-status {
  font-size: 0.8rem;
  color: var(--vp-c-brand-1);
  font-weight: 500;
  height: 100%;
  right: 1rem;
}

.editor-textarea {
  width: 100%;
  padding: 1rem 1.5rem;
  border: none;
  border-top: 1px solid var(--vp-c-border);
  border-bottom: 1px solid var(--vp-c-border);
  border-radius: 0;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  font-family: var(--vp-font-family-mono);
  font-size: 0.9rem;
  line-height: 1.5;
  resize: none;
  min-height: 60px;
  height: auto;
  overflow: hidden;
}

.editor-textarea:focus {
  outline: none;
  border-top-color: var(--vp-c-brand-1);
  box-shadow: inset 0 2px 0 var(--vp-c-brand-1);
}

.editor-textarea::placeholder {
  color: var(--vp-c-text-3);
}

.preview-content {
  flex: 1;
  border: none;
  border-top: 1px solid var(--vp-c-border);
  border-radius: 0 0 12px 12px;
  background: var(--vp-c-bg);
  padding: 1rem 1.5rem 1.5rem 1.5rem;
  min-height: 120px;
  display: flex;
  flex-direction: column;
}

.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  color: var(--vp-c-text-3);
  font-style: italic;
  text-align: center;
}

.response-display {
  margin-top: 1rem;
  padding: 0.75rem;
  background: var(--vp-c-bg-alt);
  border-radius: 6px;
  border: 1px solid var(--vp-c-divider);
}

.response-display p {
  margin: 0 0 0.5rem 0;
  font-size: 0.875rem;
  color: var(--vp-c-text-2);
  font-weight: 500;
}

.response-display pre {
  margin: 0;
  font-family: var(--vp-font-family-mono);
  font-size: 0.8rem;
  color: var(--vp-c-text-1);
  white-space: pre-wrap;
  word-break: break-word;
}

/* Ensure the fill-in component fits nicely */
:deep(.fill-in-view) {
  flex: 1;
}
</style>
