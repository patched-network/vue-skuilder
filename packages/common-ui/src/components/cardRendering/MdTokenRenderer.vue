<template>
  <span v-if="isText(token)">
    <span v-if="!token.tokens || token.tokens.length === 0">
      <span v-if="isComponent(token)">
        <!--
          KNOWN LIMITATION: Components cannot be the final token of the entire markdown document
          The v-if="!last" check prevents rendering when this is the last token overall
          Components CAN be the last token in a paragraph (just not the whole document)
          Reason unclear but necessary historically - Chesterton's Fence applies
          Workaround: Add trailing whitespace, punctuation, or newline after component
          See: "MarkdownRenderer - Known Limitations" test group
        -->
        <component
          v-if="!last && getComponent(parsedComponent(token).is)"
          :is="getComponent(parsedComponent(token).is)"
          :text="parsedComponent(token).text"
          v-bind="parsedComponent(token).props"
        />
        <span v-else-if="!last && !getComponent(parsedComponent(token).is)" class="error--text">
          [Unknown component: {{ parsedComponent(token).is }}]
        </span>
      </span>
      <span v-else-if="containsComponent(token)">
        <md-token-renderer v-for="(subTok, j) in splitTextToken(token)" :key="j" :token="subTok" />
      </span>
      <span v-else>{{ decodeBasicEntities(token.text) }}</span>
    </span>
    <span v-else-if="token.tokens && token.tokens.length !== 0">
      <md-token-renderer v-for="(subTok, j) in token.tokens" :key="j" :token="subTok" />
    </span>
  </span>

  <span v-else-if="token.type === 'heading'">
    <h1 v-if="token.depth === 1" class="text-h2">
      <md-token-renderer v-for="(subTok, j) in token.tokens" :key="j" :token="subTok" />
    </h1>
    <h2 v-else-if="token.depth === 2" class="text-h3">
      <md-token-renderer v-for="(subTok, j) in token.tokens" :key="j" :token="subTok" />
    </h2>
    <h3 v-else-if="token.depth === 3" class="text-h4">
      <md-token-renderer v-for="(subTok, j) in token.tokens" :key="j" :token="subTok" />
    </h3>
    <h4 v-else-if="token.depth === 4">
      <md-token-renderer v-for="(subTok, j) in token.tokens" :key="j" :token="subTok" />
    </h4>
    <h5 v-else-if="token.depth === 5">
      <md-token-renderer v-for="(subTok, j) in token.tokens" :key="j" :token="subTok" />
    </h5>
    <h6 v-else-if="token.depth === 6">
      <md-token-renderer v-for="(subTok, j) in token.tokens" :key="j" :token="subTok" />
    </h6>
  </span>

  <strong v-else-if="token.type === 'strong'">
    <md-token-renderer v-for="(subTok, j) in token.tokens" :key="j" :token="subTok" />
  </strong>

  <p v-else-if="token.type === 'paragraph'" class="text-h5">
    <span v-if="containsComponent(token)">
      <md-token-renderer
        v-for="(splitTok, j) in splitParagraphToken(token)"
        :key="j"
        :token="splitTok"
        :last="last && token.tokens.length === 1 && j === splitParagraphToken(token).length - 1"
      />
    </span>
    <template v-else>
      <md-token-renderer
        v-for="(subTok, j) in token.tokens"
        :key="j"
        :token="subTok"
        :last="last && token.tokens.length === 1"
      />
    </template>
  </p>

  <a v-else-if="token.type === 'link'" :href="token.href" :title="token.title">
    <md-token-renderer v-for="(subTok, j) in token.tokens" :key="j" :token="subTok" />
  </a>

  <ul v-else-if="token.type === 'list' && token.ordered === false">
    <md-token-renderer v-for="(item, j) in token.items" :key="j" :token="item" />
  </ul>

  <ol v-else-if="token.type === 'list' && token.ordered === true">
    <md-token-renderer v-for="(item, j) in token.items" :key="j" :token="item" />
  </ol>

  <li v-else-if="token.type === 'list_item'">
    <md-token-renderer v-for="(subTok, j) in token.tokens" :key="j" :token="subTok" />
  </li>

  <img v-else-if="token.type === 'image'" :src="token.href" :alt="token.title" />
  <hr v-else-if="token.type === 'hr'" />
  <br v-else-if="token.type === 'br'" />
  <del v-else-if="token.type === 'del'" />

  <table v-else-if="token.type === 'table'" :align="token.align">
    <thead>
      <th v-for="(h, j) in token.header" :key="j">{{ h.text }}</th>
    </thead>
    <tbody>
      <tr v-for="(row, r) in token.rows" :key="r">
        <td v-for="(cell, c) in row" :key="c">{{ cell.text }}</td>
      </tr>
    </tbody>
  </table>

  <span v-else-if="token.type === 'html'" v-html="token.raw"></span>

  <code-block-renderer v-else-if="token.type === 'code'" :code="token.text" :language="token.lang" />
  <!-- <highlightjs v-else-if="token.type === 'code'" class="hljs_render pa-2" :language="token.lang" :code="token.text" /> -->

  <code v-else-if="token.type === 'codespan'" class="codespan" v-html="token.text"></code>

  <blockquote v-else-if="token.type === 'blockquote'">
    <md-token-renderer v-for="(subTok, j) in token.tokens" :key="j" :token="subTok" />
  </blockquote>

  <span v-else-if="token.type === 'escape'">{{ token.text }}</span>

  <em v-else-if="token.type === 'em'">
    <md-token-renderer v-for="(subTok, j) in token.tokens" :key="j" :token="subTok" />
  </em>
</template>

<script setup lang="ts">
import {
  containsComponent as _containsComponent,
  isComponent as _isComponent,
  splitParagraphToken as _splitParagraphToken,
  splitTextToken as _splitTextToken,
  TokenOrComponent,
} from './MarkdownRendererHelpers';
import CodeBlockRenderer from './CodeBlockRenderer.vue';
import FillInInput from '../../components/studentInputs/fillInInput.vue';
import { MarkedToken, Tokens } from 'marked';
import { markRaw, inject } from 'vue';
import { PropType } from 'vue';

// Inject custom components provided at app level (defaults to empty object)
const providedComponents = inject<Record<string, any>>('markdownComponents', {});

// Register components to be used in the template
// In Vue 3 with <script setup>, components used via :is must be explicitly registered
// Merge built-in components with injected custom components
const components = {
  fillIn: markRaw(FillInInput),
  ...providedComponents,
};

// Define component props
defineProps({
  token: {
    type: Object as PropType<TokenOrComponent>,
    required: true,
  },
  last: {
    type: Boolean,
    required: false,
    default: false,
  },
});

// Methods
function isComponent(token: MarkedToken): boolean {
  return _isComponent(token);
}

function containsComponent(token: MarkedToken): boolean {
  return _containsComponent(token);
}

function splitTextToken(token: MarkedToken): Tokens.Text[] {
  return _splitTextToken(token);
}

function splitParagraphToken(token: Tokens.Paragraph): TokenOrComponent[] {
  return _splitParagraphToken(token);
}

function parsedComponent(token: MarkedToken): {
  is: string;
  text: string;
  props: Record<string, string>;
} {
  let text = '';
  if ('text' in token && typeof token.text === 'string') {
    text = token.text;
  } else if ('raw' in token && typeof token.raw === 'string') {
    text = token.raw;
  }

  // Try to parse new syntax: {{ <component-name attr="value" /> }}
  // Matches component name and optional attributes
  const match = text.match(/^\{\{\s*<([\w-]+)\s*(.*?)\s*\/>\s*\}\}$/);

  if (match) {
    const componentName = match[1]; // e.g., "chessBoard", "fillIn"
    const attrsString = match[2]; // e.g., 'fen="..." size="..."'
    const props: Record<string, string> = {};

    // Parse attributes: key="value"
    // Regex explanation: captures key-value pairs where value is in double quotes
    const attrRegex = /([\w-]+)="([^"]*)"/g;
    let attrMatch;

    while ((attrMatch = attrRegex.exec(attrsString)) !== null) {
      props[attrMatch[1]] = attrMatch[2];
    }

    // New syntax found - return component name, empty text, and props
    return {
      is: componentName,
      text: '',
      props,
    };
  }

  // Backward compatible: {{ }} or {{ || }} -> fillIn component
  return {
    is: 'fillIn',
    text,
    props: {},
  };
}

function getComponent(componentName: string) {
  const component = components[componentName as keyof typeof components];

  if (!component) {
    console.warn(
      `[MarkdownRenderer] Unknown component: "${componentName}". Available components: ${Object.keys(components).join(', ')}`
    );
    return null;
  }

  return component;
}

function decodeBasicEntities(text: string): string {
  return text
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function isText(tok: TokenOrComponent): boolean {
  return (tok as any).inLink === undefined && tok.type === 'text';
}

// Make these functions and objects available to the template
defineExpose({
  isComponent,
  containsComponent,
  splitTextToken,
  splitParagraphToken,
  parsedComponent,
  decodeBasicEntities,
  isText,
  components,
  getComponent,
});
</script>

<style lang="css" scoped>
blockquote {
  border-left: 3px teal solid;
  padding-left: 8px;
}

.codespan {
  padding-left: 3px;
  padding-right: 3px;
  margin-left: 1px;
  margin-right: 1px;
}

p {
  margin-bottom: 15px;
  margin-top: 15px;
}
</style>
