import { Token, MarkedToken, Tokens } from 'marked';
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

function splitText(
  text: string,
  leftBound: string,
  rightBound: string
): {
  left: string;
  middle: string;
  right: string;
} {
  const leftSplit = text.split(leftBound);
  const left = leftSplit[0];

  const rightSplit = leftSplit[1].split(rightBound);
  const middle = rightSplit[0];
  const right = rightSplit[1];

  return { left, middle, right };
}

export function splitTextToken(token: Tokens.Text): Tokens.Text[] {
  if (containsComponent(token)) {
    const textChunks = splitByDelimiters(token.text, '{{', '}}');
    const rawChunks = splitByDelimiters(token.raw, '{{', '}}');

    if (textChunks.length === rawChunks.length) {
      return textChunks.map((c, i) => {
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
