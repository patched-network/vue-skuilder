/**
 * MarkdownRenderer - Token-based markdown renderer for TUI
 * Mirrors the Vue MarkdownRenderer.vue component architecture
 *
 * Uses marked.js for tokenization, then renders tokens via MdTokenRenderer
 *
 * @claude [1023] NOTE: This is a React port of @packages/common-ui/src/components/cardRendering/MarkdownRenderer.vue
 * Architecture pattern mirrors Vue: marked.lexer() → token array → MdTokenRenderer for each token
 * Consider: Abstract the marked.js integration and token pipeline to be framework-agnostic.
 */

import React from 'react';
import { Box } from 'ink';
import * as marked from 'marked';
import MdTokenRenderer, { TUIComponentRegistry } from './MdTokenRenderer.js';
import { MarkedToken } from './MarkdownRendererHelpers.js';

interface MarkdownRendererProps {
  content: string;
  components?: TUIComponentRegistry;
}

/**
 * Extended token type that can include audio references
 * (matching the SkldrToken type from the Vue version)
 */
type SkldrToken =
  | marked.Token
  | {
      type: false;
      audio: string;
    };

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, components = {} }) => {
  // Use marked lexer to tokenize the markdown
  const tokens: SkldrToken[] = marked.lexer(content);

  return (
    <Box flexDirection="column">
      {tokens.map((token, i) => {
        // Handle typed tokens via MdTokenRenderer
        if (token.type) {
          return (
            <MdTokenRenderer
              key={i}
              token={token as MarkedToken}
              last={i === tokens.length - 1}
              components={components}
            />
          );
        }

        // Handle audio tokens (TUI can't play audio, show indicator)
        if ('audio' in token && token.audio) {
          return (
            <Box key={i}>
              {/* Audio not supported in TUI - could integrate with system player */}
            </Box>
          );
        }

        return null;
      })}
    </Box>
  );
};

export default MarkdownRenderer;
