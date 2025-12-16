/**
 * TUI Component Registry
 *
 * Custom components that can be embedded in markdown via {{ <componentName /> }} syntax.
 * These are TUI equivalents of the Vue components used in common-ui.
 *
 * Usage in markdown:
 *   {{ <badge type="success" /> }}
 *   {{ <hint text="Click here" /> }}
 *
 * Components receive:
 *   - text: raw text content (for fillIn-style components)
 *   - props: parsed attributes from the component syntax
 */

import React from 'react';
import { Text, Box } from 'ink';
import { TUIComponentRegistry } from './MdTokenRenderer.js';
import { parseFillInContent } from './MarkdownRendererHelpers.js';

/**
 * FillIn blank component - displays a blank for fill-in-the-blank questions
 * Syntax: {{ }} or {{ answer }} or {{ answer || alt1 | alt2 }}
 */
export const FillInComponent: React.FC<{ text: string; props: Record<string, string> }> = ({
  text,
}) => {
  const { answer, isMultipleChoice } = parseFillInContent(text);

  // Empty blank placeholder
  if (!answer || answer.trim() === '' || answer.trim() === '||') {
    return (
      <Text backgroundColor={isMultipleChoice ? 'green' : 'blue'} color="white">
        {'  _____  '}
      </Text>
    );
  }

  // Has answer - show hidden placeholder
  return (
    <Text backgroundColor="blue" color="white">
      {' [____] '}
    </Text>
  );
};

/**
 * Badge component - displays a styled badge/tag
 * Syntax: {{ <badge type="success" label="Done" /> }}
 */
export const BadgeComponent: React.FC<{ text: string; props: Record<string, string> }> = ({
  props,
}) => {
  const label = props.label || props.text || 'Badge';
  const type = props.type || 'default';

  const colors: Record<string, string> = {
    success: 'green',
    error: 'red',
    warning: 'yellow',
    info: 'blue',
    default: 'gray',
  };

  return (
    <Text backgroundColor={colors[type] || 'gray'} color="white">
      {` ${label} `}
    </Text>
  );
};

/**
 * Hint component - displays a hint or tooltip text
 * Syntax: {{ <hint text="This is helpful" /> }}
 */
export const HintComponent: React.FC<{ text: string; props: Record<string, string> }> = ({
  props,
}) => {
  const hintText = props.text || props.hint || '';

  return (
    <Text color="cyan" dimColor>
      {'💡 ' + hintText}
    </Text>
  );
};

/**
 * Highlight component - highlights text with a background color
 * Syntax: {{ <highlight color="yellow">text</highlight> }}
 */
export const HighlightComponent: React.FC<{ text: string; props: Record<string, string> }> = ({
  props,
}) => {
  const color = props.color || 'yellow';
  const content = props.text || '';

  return (
    <Text backgroundColor={color} color="black">
      {` ${content} `}
    </Text>
  );
};

/**
 * Emoji component - displays an emoji with optional label
 * Syntax: {{ <emoji name="checkmark" /> }}
 */
export const EmojiComponent: React.FC<{ text: string; props: Record<string, string> }> = ({
  props,
}) => {
  const emojis: Record<string, string> = {
    checkmark: '✓',
    cross: '✗',
    star: '★',
    heart: '♥',
    warning: '⚠',
    info: 'ℹ',
    question: '?',
    lightbulb: '💡',
    fire: '🔥',
    rocket: '🚀',
  };

  const name = props.name || 'star';
  const emoji = emojis[name] || name;

  return <Text>{emoji}</Text>;
};

/**
 * Divider component - displays a horizontal divider
 * Syntax: {{ <divider /> }} or {{ <divider width="20" /> }}
 */
export const DividerComponent: React.FC<{ text: string; props: Record<string, string> }> = ({
  props,
}) => {
  const width = parseInt(props.width || '30', 10);

  return (
    <Box marginY={1}>
      <Text dimColor>{'─'.repeat(width)}</Text>
    </Box>
  );
};

/**
 * Default TUI component registry
 * Add new components here to make them available in markdown
 */
export const defaultTUIComponents: TUIComponentRegistry = {
  fillIn: FillInComponent,
  badge: BadgeComponent,
  hint: HintComponent,
  highlight: HighlightComponent,
  emoji: EmojiComponent,
  divider: DividerComponent,
};

/**
 * Create a custom component registry by merging with defaults
 */
export function createComponentRegistry(
  customComponents: TUIComponentRegistry = {}
): TUIComponentRegistry {
  return {
    ...defaultTUIComponents,
    ...customComponents,
  };
}
