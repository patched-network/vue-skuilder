/**
 * MdTokenRenderer - Recursive token renderer for TUI markdown
 * Mirrors the Vue MdTokenRenderer.vue component architecture
 *
 * @claude [1023] NOTE: This is a React port of @packages/common-ui/src/components/cardRendering/MdTokenRenderer.vue
 * Significant architectural similarities but framework-specific implementation (React vs Vue).
 * Core token rendering logic and patterns follow the Vue implementation.
 * Consider: If supporting multiple frameworks long-term, abstract rendering logic to framework-agnostic layer.
 */

import React from 'react';
import { Box, Text, Newline } from 'ink';
import { Token, Tokens } from 'marked';
import {
  MarkedToken,
  TokenOrComponent,
  isText,
  isComponent,
  containsComponent,
  splitTextToken,
  parsedComponent,
  decodeBasicEntities,
  parseFillInContent,
} from './MarkdownRendererHelpers.js';

// Component registry type
export type TUIComponentRegistry = Record<
  string,
  React.FC<{ text: string; props: Record<string, string> }>
>;

interface MdTokenRendererProps {
  token: TokenOrComponent;
  last?: boolean;
  components?: TUIComponentRegistry;
}

// Default fillIn component for TUI
const TUIFillIn: React.FC<{ text: string }> = ({ text }) => {
  const { answer, isMultipleChoice } = parseFillInContent(text);

  // Empty blank placeholder
  if (!answer || answer.trim() === '' || answer.trim() === '||') {
    return (
      <Text backgroundColor={isMultipleChoice ? 'green' : 'blue'} color="white">
        {'  _____  '}
      </Text>
    );
  }

  // Hidden answer indicator
  return (
    <Text backgroundColor="blue" color="white">
      {' [____] '}
    </Text>
  );
};

const MdTokenRenderer: React.FC<MdTokenRendererProps> = ({
  token,
  last = false,
  components = {},
}) => {
  const getComponent = (name: string): React.FC<any> | null => {
    if (name === 'fillIn') {
      return TUIFillIn;
    }
    return components[name] || null;
  };

  // Helper to render child tokens recursively
  const renderChildren = (tokens: Token[] | undefined, passLast = false): React.ReactNode[] => {
    if (!tokens) return [];
    return tokens.map((subTok, j) => (
      <MdTokenRenderer
        key={j}
        token={subTok as MarkedToken}
        last={passLast && j === tokens.length - 1}
        components={components}
      />
    ));
  };

  // Text token handling
  if (isText(token)) {
    const textToken = token as Tokens.Text;

    // No nested tokens - check for components or plain text
    if (!textToken.tokens || textToken.tokens.length === 0) {
      if (isComponent(token)) {
        // Component syntax: {{ <componentName /> }}
        // KNOWN LIMITATION: Components cannot be the final token (matching Vue behavior)
        if (!last) {
          const parsed = parsedComponent(token);
          const Component = getComponent(parsed.is);

          if (Component) {
            return <Component text={parsed.text} props={parsed.props} />;
          }
          return <Text color="red">[Unknown component: {parsed.is}]</Text>;
        }
        return null;
      }

      if (containsComponent(token)) {
        // Text contains embedded components - split and render
        const splitTokens = splitTextToken(textToken);
        return (
          <Text>
            {splitTokens.map((subTok, j) => (
              <MdTokenRenderer key={j} token={subTok} components={components} />
            ))}
          </Text>
        );
      }

      // Plain text
      return <Text>{decodeBasicEntities(textToken.text)}</Text>;
    }

    // Has nested tokens - render them
    return <Text>{renderChildren(textToken.tokens)}</Text>;
  }

  // Heading tokens
  if (token.type === 'heading') {
    const headingToken = token as Tokens.Heading;
    const colors: Record<number, string> = {
      1: 'cyan',
      2: 'blue',
      3: 'magenta',
      4: 'yellow',
      5: 'green',
      6: 'white',
    };

    return (
      <Box marginY={1}>
        <Text bold color={colors[headingToken.depth] || 'white'}>
          {headingToken.depth <= 2 && '# '}
          {renderChildren(headingToken.tokens)}
        </Text>
      </Box>
    );
  }

  // Strong (bold)
  if (token.type === 'strong') {
    const strongToken = token as Tokens.Strong;
    return <Text bold>{renderChildren(strongToken.tokens)}</Text>;
  }

  // Emphasis (italic)
  if (token.type === 'em') {
    const emToken = token as Tokens.Em;
    // Terminals often don't support italic, use color instead
    return <Text color="yellow">{renderChildren(emToken.tokens)}</Text>;
  }

  // Paragraph
  if (token.type === 'paragraph') {
    const paraToken = token as Tokens.Paragraph;

    if (containsComponent(token)) {
      // Split paragraph to handle embedded components
      const textChunks = splitByDelimitersForParagraph(paraToken.raw);
      return (
        <Box marginY={1}>
          <Text>
            {textChunks.map((chunk, j) => {
              if (chunk.startsWith('{{') && chunk.endsWith('}}')) {
                const fakeToken: Tokens.Text = { type: 'text', text: chunk, raw: chunk };
                return (
                  <MdTokenRenderer
                    key={j}
                    token={fakeToken}
                    last={last && j === textChunks.length - 1}
                    components={components}
                  />
                );
              }
              return <Text key={j}>{chunk}</Text>;
            })}
          </Text>
        </Box>
      );
    }

    return (
      <Box marginY={1}>
        <Text>{renderChildren(paraToken.tokens, last)}</Text>
      </Box>
    );
  }

  // Link
  if (token.type === 'link') {
    const linkToken = token as Tokens.Link;
    return (
      <Text color="blue" underline>
        {renderChildren(linkToken.tokens)}
        <Text dimColor> ({linkToken.href})</Text>
      </Text>
    );
  }

  // Unordered list
  if (token.type === 'list' && !(token as Tokens.List).ordered) {
    const listToken = token as Tokens.List;
    return (
      <Box flexDirection="column" marginY={1}>
        {listToken.items.map((item, j) => (
          <MdTokenRenderer key={j} token={item as MarkedToken} components={components} />
        ))}
      </Box>
    );
  }

  // Ordered list
  if (token.type === 'list' && (token as Tokens.List).ordered) {
    const listToken = token as Tokens.List;
    return (
      <Box flexDirection="column" marginY={1}>
        {listToken.items.map((item, j) => (
          <Box key={j}>
            <Text>{j + 1}. </Text>
            <MdTokenRenderer token={item as MarkedToken} components={components} />
          </Box>
        ))}
      </Box>
    );
  }

  // List item
  if (token.type === 'list_item') {
    const itemToken = token as Tokens.ListItem;
    return (
      <Box marginLeft={2}>
        <Text>{'• '}</Text>
        <Box flexDirection="column">{renderChildren(itemToken.tokens)}</Box>
      </Box>
    );
  }

  // Image
  if (token.type === 'image') {
    const imgToken = token as Tokens.Image;
    return <Text color="gray">[Image: {imgToken.title || imgToken.text || imgToken.href}]</Text>;
  }

  // Horizontal rule
  if (token.type === 'hr') {
    return (
      <Box marginY={1}>
        <Text dimColor>{'─'.repeat(40)}</Text>
      </Box>
    );
  }

  // Line break
  if (token.type === 'br') {
    return <Newline />;
  }

  // Strikethrough
  if (token.type === 'del') {
    const delToken = token as Tokens.Del;
    return <Text strikethrough>{renderChildren(delToken.tokens)}</Text>;
  }

  // Table
  if (token.type === 'table') {
    const tableToken = token as Tokens.Table;
    return (
      <Box flexDirection="column" marginY={1}>
        <Box>
          {tableToken.header.map((h, j) => (
            <Box key={j} width={15}>
              <Text bold>{h.text}</Text>
            </Box>
          ))}
        </Box>
        <Text dimColor>{'─'.repeat(tableToken.header.length * 15)}</Text>
        {tableToken.rows.map((row, r) => (
          <Box key={r}>
            {row.map((cell, c) => (
              <Box key={c} width={15}>
                <Text>{cell.text}</Text>
              </Box>
            ))}
          </Box>
        ))}
      </Box>
    );
  }

  // HTML (skip for TUI - cannot render safely in terminal)
  if (token.type === 'html') {
    // Note: Stripping HTML tags with regex is insufficient for security
    // (vulnerable to tag nesting, unclosed tags, etc.). Since this is a TUI
    // rendering to terminal (not browser DOM), we simply skip HTML tokens.
    // Any text content should already be in markdown text tokens.
    return null;
  }

  // Code block
  if (token.type === 'code') {
    const codeToken = token as Tokens.Code;
    return (
      <Box flexDirection="column" marginY={1} borderStyle="single" borderColor="gray" paddingX={1}>
        {codeToken.lang && <Text dimColor>{'// ' + codeToken.lang}</Text>}
        <Text color="green">{codeToken.text}</Text>
      </Box>
    );
  }

  // Inline code
  if (token.type === 'codespan') {
    const codeToken = token as Tokens.Codespan;
    return (
      <Text backgroundColor="gray" color="black">
        {' ' + codeToken.text + ' '}
      </Text>
    );
  }

  // Blockquote
  if (token.type === 'blockquote') {
    const quoteToken = token as Tokens.Blockquote;
    return (
      <Box marginY={1} marginLeft={2}>
        <Text color="cyan">│ </Text>
        <Box flexDirection="column">{renderChildren(quoteToken.tokens)}</Box>
      </Box>
    );
  }

  // Escape sequence
  if (token.type === 'escape') {
    const escToken = token as Tokens.Escape;
    return <Text>{escToken.text}</Text>;
  }

  // Space token (paragraph break)
  if (token.type === 'space') {
    return <Newline />;
  }

  // Unknown token type - render raw if available
  if ('raw' in token && token.raw) {
    return <Text>{token.raw}</Text>;
  }

  return null;
};

// Helper to split paragraph content for component handling
function splitByDelimitersForParagraph(text: string): string[] {
  const result: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    const openIdx = remaining.indexOf('{{');
    if (openIdx === -1) {
      result.push(remaining);
      break;
    }

    const closeIdx = remaining.indexOf('}}', openIdx);
    if (closeIdx === -1) {
      result.push(remaining);
      break;
    }

    if (openIdx > 0) {
      result.push(remaining.substring(0, openIdx));
    }
    result.push(remaining.substring(openIdx, closeIdx + 2));
    remaining = remaining.substring(closeIdx + 2);
  }

  return result.filter((s) => s.length > 0);
}

export default MdTokenRenderer;
