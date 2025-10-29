import { MarkedToken, Tokens } from 'marked';
import * as marked from 'marked';

/**
 * recursively splits text according to the passed delimiters.
 *
 * eg: ("abcde", "b", "d")   => ["a", "bcd", "e"]
 *     ("a[b][c]", "[", "]") => ["a", "[b]", "[c]"]
 *
 * it does not check that the delimiters are well formed in the text
 * @param text the text to be split
 * @param l the left delimiter
 * @param r the right delimiter
 * @returns the split result
 */
export function splitByDelimiters(text: string, l: string, r: string): string[] {
  if (text.length === 0) return [];

  let ret: string[] = [];

  const left = text.indexOf(l);
  const right = text.indexOf(r, left);

  if (left >= 0 && right > left) {
    // pre-delimited characters
    ret.push(text.substring(0, left));
    // delimited section
    ret.push(text.substring(left, right + r.length));
    // recurse on remaining text
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
      return textChunks.map((_c, i) => {
        return {
          type: 'text',
          text: textChunks[i],
          raw: rawChunks[i],
        };
      });
    } else {
      throw new Error(`Error parsing markdown`);
    }
  } else {
    return [token];
  }
}

export type TokenOrComponent = MarkedToken | { type: 'component'; raw: string };

export function splitParagraphToken(token: Tokens.Paragraph): TokenOrComponent[] {
  let ret: MarkedToken[] = [];

  if (containsComponent(token)) {
    const textChunks = splitByDelimiters(token.text, '{{', '}}');
    const rawChunks = splitByDelimiters(token.raw, '{{', '}}');
    if (textChunks.length === rawChunks.length) {
      for (let i = 0; i < textChunks.length; i++) {
        const textToken = {
          type: 'text',
          text: textChunks[i],
          raw: rawChunks[i],
        } as Tokens.Text;

        if (isComponent(textToken)) {
          ret.push(textToken);
        } else {
          marked.lexer(rawChunks[i]).forEach((t) => {
            if (t.type === 'paragraph') {
              ret = ret.concat(t.tokens as MarkedToken[]);
            } else {
              ret.push(t as MarkedToken);
            }
          });
        }
      }
      return ret;
    } else {
      throw new Error(`Error parsing Markdown`);
    }
  } else {
    ret.push(token);
  }
  return ret;
}

export function containsComponent(token: MarkedToken) {
  if (token.type === 'text' || token.type === 'paragraph') {
    const opening = token.raw.indexOf('{{');
    const closing = token.raw.indexOf('}}');

    if (opening !== -1 && closing !== -1 && closing > opening) {
      return true;
    } else {
      return false;
    }
  } else {
    return false;
  }
}

export function isComponent(token: MarkedToken) {
  return token.type === 'text' && token.text.startsWith('{{') && token.text.endsWith('}}');
}

/**
 * Parses inline component syntax from a string
 * @param text - String containing component syntax, e.g., "{{ <badge /> }}" or " <badge prop="value" /> "
 * @returns Object with componentName and props, or null if not valid component syntax
 *
 * @example
 * parseComponentSyntax("{{ <badge /> }}") // { componentName: 'badge', props: {} }
 * parseComponentSyntax("{{ <chessBoard fen=\"...\" size=\"large\" /> }}") // { componentName: 'chessBoard', props: { fen: '...', size: 'large' } }
 * parseComponentSyntax("{{ Paris }}") // null (not a component)
 */
export function parseComponentSyntax(text: string): {
  componentName: string;
  props: Record<string, string>;
} | null {
  // Try to parse full syntax: {{ <component-name attr="value" /> }}
  const match = text.match(/^\{\{\s*<([\w-]+)\s*(.*?)\s*\/>\s*\}\}$/);

  if (!match) {
    return null;
  }

  const componentName = match[1]; // e.g., "badge", "chessBoard"
  const attrsString = match[2]; // e.g., 'fen="..." size="large"'
  const props: Record<string, string> = {};

  // Parse attributes: key="value"
  const attrRegex = /([\w-]+)="([^"]*)"/g;
  let attrMatch;

  while ((attrMatch = attrRegex.exec(attrsString)) !== null) {
    props[attrMatch[1]] = attrMatch[2];
  }

  return { componentName, props };
}

/**
 * Checks if delimited content (content between {{ }}) is an inline component vs a fillIn blank
 * @param delimitedContent - Content between {{ and }}, e.g., " <badge /> " or "Paris" or " choice1 || choice2 "
 * @returns true if this is an inline component, false if it's a fillIn blank
 *
 * @example
 * isInlineComponent("<badge />") // true
 * isInlineComponent("<chessBoard fen=\"...\" />") // true
 * isInlineComponent("Paris") // false (fillIn blank)
 * isInlineComponent("choice || alt1 | alt2") // false (fillIn with options)
 */
export function isInlineComponent(delimitedContent: string): boolean {
  const trimmed = delimitedContent.trim();
  // Match: <componentName /> or <componentName prop="value" prop2="value2" />
  return /^<[\w-]+(\s+[\w-]+="[^"]*")*\s*\/?>$/.test(trimmed);
}

/**
 * Parses component syntax from a MarkedToken
 * Convenience wrapper around parseComponentSyntax for token-based usage
 * @param token - MarkedToken with text or raw property
 * @returns Object with componentName and props, or null if not valid component syntax
 */
export function parseComponentToken(token: MarkedToken): {
  componentName: string;
  props: Record<string, string>;
} | null {
  const text = (token as any).text || (token as any).raw;
  return parseComponentSyntax(text);
}
