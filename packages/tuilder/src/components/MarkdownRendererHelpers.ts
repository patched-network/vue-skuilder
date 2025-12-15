/**
 * Markdown renderer helpers for TUI - ported from common-ui
 * Handles the custom {{ }} component syntax used in vue-skuilder
 *
 * @claude [1023] TODO: These functions are naive copies from @packages/common-ui/src/components/cardRendering/MarkdownRendererHelpers.ts
 * Consider extracting to a shared utility package or re-exporting from common-ui instead of duplicating.
 * Current functions: splitByDelimiters, splitTextToken, containsComponent, isComponent, parseComponentSyntax, parsedComponent, etc.
 */

import { Token, Tokens } from 'marked';

export type MarkedToken = Token;
export type TokenOrComponent = MarkedToken | { type: 'component'; raw: string };

/**
 * Recursively splits text according to the passed delimiters.
 *
 * eg: ("abcde", "b", "d")   => ["a", "bcd", "e"]
 *     ("a[b][c]", "[", "]") => ["a", "[b]", "[c]"]
 *
 * @claude [1023] DUPLICATED from: @packages/common-ui/src/components/cardRendering/MarkdownRendererHelpers.ts
 */
export function splitByDelimiters(text: string, l: string, r: string): string[] {
  if (text.length === 0) return [];

  let ret: string[] = [];

  const left = text.indexOf(l);
  const right = text.indexOf(r, left);

  if (left >= 0 && right > left) {
    ret.push(text.substring(0, left));
    ret.push(text.substring(left, right + r.length));
    ret = ret.concat(splitByDelimiters(text.substring(right + r.length), l, r));
  } else {
    return [text];
  }

  return ret;
}

export function splitTextToken(token: Tokens.Text): Tokens.Text[] {
  if (containsComponent(token)) {
    const textChunks = splitByDelimiters(token.text, '{{', '}}');
    const rawChunks = splitByDelimiters(token.raw, '{{', '}}');

    if (textChunks.length === rawChunks.length) {
      return textChunks.map((_c, i) => ({
        type: 'text' as const,
        text: textChunks[i],
        raw: rawChunks[i],
      }));
    } else {
      throw new Error('Error parsing markdown');
    }
  } else {
    return [token];
  }
}

export function containsComponent(token: MarkedToken): boolean {
  if (token.type === 'text' || token.type === 'paragraph') {
    const raw = 'raw' in token ? token.raw : '';
    const opening = raw.indexOf('{{');
    const closing = raw.indexOf('}}');
    return opening !== -1 && closing !== -1 && closing > opening;
  }
  return false;
}

export function isComponent(token: MarkedToken): boolean {
  if (token.type !== 'text') return false;
  const text = 'text' in token ? token.text : '';
  return text.startsWith('{{') && text.endsWith('}}');
}

/**
 * Parses inline component syntax from a string
 * @example
 * parseComponentSyntax("{{ <badge /> }}") // { componentName: 'badge', props: {} }
 * parseComponentSyntax("{{ <chessBoard fen=\"...\" /> }}") // { componentName: 'chessBoard', props: { fen: '...' } }
 * parseComponentSyntax("{{ Paris }}") // null (not a component, it's a fillIn)
 */
export function parseComponentSyntax(text: string): {
  componentName: string;
  props: Record<string, string>;
} | null {
  if (text.length > 10000) return null;

  const match = text.match(/^\{\{\s*<([\w-]+)((?:\s+[\w-]+="[^"]*")*)\s*\/>\s*\}\}$/);
  if (!match) return null;

  const componentName = match[1];
  const attrsString = match[2];
  const props: Record<string, string> = {};

  if (attrsString) {
    const attrRegex = /\s+([\w-]+)="([^"]*)"/g;
    let attrMatch;
    while ((attrMatch = attrRegex.exec(attrsString)) !== null) {
      props[attrMatch[1]] = attrMatch[2];
    }
  }

  return { componentName, props };
}

/**
 * Parse a component token to extract component info
 * For fillIn blanks ({{ }} or {{ || }}), returns is: 'fillIn'
 */
export function parsedComponent(token: MarkedToken): {
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

  const parsed = parseComponentSyntax(text);
  if (parsed) {
    return {
      is: parsed.componentName,
      text: '',
      props: parsed.props,
    };
  }

  // Backward compatible: {{ }} or {{ || }} -> fillIn component
  return {
    is: 'fillIn',
    text,
    props: {},
  };
}

/**
 * Decode HTML entities that marked might produce
 */
export function decodeBasicEntities(text: string): string {
  return text
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

/**
 * Check if token is a text type (not an inLink text)
 */
export function isText(tok: TokenOrComponent): boolean {
  return (tok as any).inLink === undefined && tok.type === 'text';
}

/**
 * Parse fill-in blank content to extract answer and alternatives
 * Supports: {{ answer }}, {{ answer || alt1 | alt2 }}
 */
export function parseFillInContent(text: string): {
  answer: string;
  alternatives: string[];
  isMultipleChoice: boolean;
} {
  // Remove {{ and }} wrapper
  const inner = text.replace(/^\{\{\s*/, '').replace(/\s*\}\}$/, '');

  // Check for || separator (multiple choice style)
  if (inner.includes('||')) {
    const [answer, ...alts] = inner.split('||').map((s) => s.trim());
    const alternatives = alts.flatMap((a) => a.split('|').map((s) => s.trim()));
    return { answer, alternatives, isMultipleChoice: true };
  }

  // Check for | separator (alternatives)
  if (inner.includes('|')) {
    const parts = inner.split('|').map((s) => s.trim());
    return { answer: parts[0], alternatives: parts.slice(1), isMultipleChoice: false };
  }

  // Plain answer
  return { answer: inner, alternatives: [], isMultipleChoice: false };
}
