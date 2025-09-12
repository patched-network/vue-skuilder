<template>
  <div class="embedded-fill-in-editor">
    <div class="editor-panel">
      <div class="editor-header">
        <h4>Markdown Source</h4>
        <button @click="copyToClipboard" class="copy-button" title="Copy to clipboard">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
          </svg>
          Copy
        </button>
      </div>
      <textarea 
        v-model="markdownSource" 
        class="editor-textarea"
        placeholder="Enter fill-in markdown with {{mustache}} syntax..."
        rows="6"
      />
    </div>
    <div class="preview-panel">
      <div class="preview-header">
        <h4>Live Preview</h4>
        <div v-if="copyStatus" class="copy-status">{{ copyStatus }}</div>
      </div>
      <div class="preview-content">
        <fill-in-view 
          v-if="markdownSource.trim()" 
          :data="viewData" 
          @emit-response="handleResponse"
        />
        <div v-else class="empty-state">
          Enter markdown above to see the live preview
        </div>
        <div v-if="lastResponse" class="response-display">
          <p><strong>Last Response:</strong></p>
          <pre>{{ JSON.stringify(lastResponse, null, 2) }}</pre>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import FillInView from '@vue-skuilder/courseware/default/questions/fillIn/fillIn.vue'

interface Props {
  initialValue?: string;
}

const props = withDefaults(defineProps<Props>(), {
  initialValue: "The capital of France is {{Paris}}."
})

// Reactive state
const markdownSource = ref(props.initialValue)
const copyStatus = ref('')
const lastResponse = ref(null)

// Convert markdown to ViewData format expected by fillIn.vue
const viewData = computed(() => [{
  Input: markdownSource.value
}])

// Handle card responses (when user interacts with the fill-in)
const handleResponse = (response: any) => {
  console.log('Fill-in response:', response)
  lastResponse.value = {
    isCorrect: response.isCorrect,
    performance: response.performance,
    timestamp: new Date().toISOString()
  }
}

// Copy markdown source to clipboard
const copyToClipboard = async () => {
  try {
    await navigator.clipboard.writeText(markdownSource.value)
    copyStatus.value = 'Copied!'
    setTimeout(() => {
      copyStatus.value = ''
    }, 2000)
  } catch (err) {
    console.error('Failed to copy:', err)
    copyStatus.value = 'Copy failed'
    setTimeout(() => {
      copyStatus.value = ''
    }, 2000)
  }
}
</script>

<style scoped>
.embedded-fill-in-editor {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
  border: 1px solid var(--vp-c-border);
  border-radius: 12px;
  background: var(--vp-c-bg-soft);
  padding: 1.5rem;
  margin: 1.5rem 0;
  min-height: 400px;
}

@media (max-width: 768px) {
  .embedded-fill-in-editor {
    grid-template-columns: 1fr;
    gap: 1rem;
  }
}

.editor-panel, .preview-panel {
  display: flex;
  flex-direction: column;
}

.editor-header, .preview-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.75rem;
}

.editor-header h4, .preview-header h4 {
  margin: 0;
  color: var(--vp-c-text-1);
  font-size: 1rem;
  font-weight: 600;
}

.copy-button {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-border);
  color: var(--vp-c-text-2);
  padding: 0.5rem 0.75rem;
  border-radius: 6px;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s;
}

.copy-button:hover {
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-1);
  border-color: var(--vp-c-brand-1);
}

.copy-status {
  font-size: 0.875rem;
  color: var(--vp-c-brand-1);
  font-weight: 500;
}

.editor-textarea {
  flex: 1;
  width: 100%;
  padding: 1rem;
  border: 1px solid var(--vp-c-border);
  border-radius: 8px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  font-family: var(--vp-font-family-mono);
  font-size: 0.9rem;
  line-height: 1.5;
  resize: vertical;
  min-height: 120px;
}

.editor-textarea:focus {
  outline: none;
  border-color: var(--vp-c-brand-1);
  box-shadow: 0 0 0 2px var(--vp-c-brand-soft);
}

.editor-textarea::placeholder {
  color: var(--vp-c-text-3);
}

.preview-content {
  flex: 1;
  border: 1px solid var(--vp-c-border);
  border-radius: 8px;
  background: var(--vp-c-bg);
  padding: 1rem;
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