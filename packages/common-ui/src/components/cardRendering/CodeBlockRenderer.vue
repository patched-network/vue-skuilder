<template>
  <div class="code-block-wrapper pa-2">
    <div class="language-indicator" v-if="language">{{ language }}</div>
    <highlightjs :language="language" :code="code" />
  </div>
</template>

<script setup lang="ts">
import hljs from 'highlight.js/lib/core';
import hljsVuePlugin from '@highlightjs/vue-plugin';
import { getCurrentInstance } from 'vue';

// Import only the languages you need
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import css from 'highlight.js/lib/languages/css';
import html from 'highlight.js/lib/languages/xml';
import bash from 'highlight.js/lib/languages/bash';
import json from 'highlight.js/lib/languages/json';
import go from 'highlight.js/lib/languages/go';
import python from 'highlight.js/lib/languages/python';

// Register languages
hljs.registerLanguage('js', javascript);
hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('ts', typescript);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('css', css);
hljs.registerLanguage('html', html);
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('sh', bash);
hljs.registerLanguage('json', json);
hljs.registerLanguage('go', go);
hljs.registerLanguage('golang', go);
hljs.registerLanguage('python', python);

// Get access to the current component instance
const instance = getCurrentInstance();
if (instance) {
  // Register the component locally
  instance.appContext.app.component('highlightjs', hljsVuePlugin.component);
}

defineProps({
  code: {
    type: String,
    required: true,
  },
  language: {
    type: String,
    default: '',
  },
});
</script>

<style>
/* Import a highlight.js theme */
@import 'highlight.js/styles/github.css';

.code-block-wrapper {
  margin: 1rem 0;
  border-radius: 4px;
  background-color: #f6f8fa;
  overflow: auto;
  position: relative;
}

.language-indicator {
  position: absolute;
  top: 8px;
  right: 10px;
  padding: 2px 8px;
  font-size: 0.75rem;
  color: #666;
  background-color: rgba(255, 255, 255, 0.7);
  border-radius: 4px;
  z-index: 1;
  font-family: monospace;
  text-transform: lowercase;
}
</style>
