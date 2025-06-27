import React from 'react';
import { Box, Text } from 'ink';

interface MarkdownRendererProps {
  content: string;
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  // Simple markdown parsing for terminal display
  // Handles basic formatting that works well in terminals
  const parseMarkdown = (text: string): React.ReactNode[] => {
    const lines = text.split('\n');
    const elements: React.ReactNode[] = [];

    lines.forEach((line, index) => {
      // Empty lines
      if (line.trim() === '') {
        elements.push(<Box key={`empty-${index}`} height={1} />);
        return;
      }

      // Headers
      if (line.startsWith('# ')) {
        elements.push(
          <Text key={index} bold color="cyan">
            {line.substring(2)}
          </Text>
        );
        return;
      }

      if (line.startsWith('## ')) {
        elements.push(
          <Text key={index} bold color="blue">
            {line.substring(3)}
          </Text>
        );
        return;
      }

      if (line.startsWith('### ')) {
        elements.push(
          <Text key={index} bold>
            {line.substring(4)}
          </Text>
        );
        return;
      }

      // Lists
      if (line.match(/^\s*[-*+]\s/)) {
        const indent = line.match(/^\s*/)?.[0].length || 0;
        const content = line.replace(/^\s*[-*+]\s/, '');
        elements.push(
          <Box key={index} marginLeft={Math.floor(indent / 2)}>
            <Text>• {content}</Text>
          </Box>
        );
        return;
      }

      // Numbered lists
      if (line.match(/^\s*\d+\.\s/)) {
        const indent = line.match(/^\s*/)?.[0].length || 0;
        const content = line.replace(/^\s*\d+\.\s/, '');
        const number = line.match(/\d+/)?.[0] || '1';
        elements.push(
          <Box key={index} marginLeft={Math.floor(indent / 2)}>
            <Text>{number}. {content}</Text>
          </Box>
        );
        return;
      }

      // Code blocks (simplified - just show as monospace)
      if (line.startsWith('```')) {
        elements.push(
          <Text key={index} color="gray">
            {line}
          </Text>
        );
        return;
      }

      // Regular text with inline formatting
      elements.push(
        <Text key={index}>
          {parseInlineFormatting(line)}
        </Text>
      );
    });

    return elements;
  };

  // Parse inline markdown formatting
  const parseInlineFormatting = (text: string): React.ReactNode[] => {
    const parts: React.ReactNode[] = [];
    let remaining = text;
    let partIndex = 0;

    while (remaining.length > 0) {
      // Bold text **text**
      const boldMatch = remaining.match(/\*\*(.*?)\*\*/);
      if (boldMatch && boldMatch.index !== undefined) {
        // Add text before the match
        if (boldMatch.index > 0) {
          parts.push(remaining.substring(0, boldMatch.index));
        }
        // Add bold text
        parts.push(
          <Text key={`bold-${partIndex++}`} bold>
            {boldMatch[1]}
          </Text>
        );
        remaining = remaining.substring(boldMatch.index + boldMatch[0].length);
        continue;
      }

      // Italic text *text*
      const italicMatch = remaining.match(/\*(.*?)\*/);
      if (italicMatch && italicMatch.index !== undefined) {
        // Add text before the match
        if (italicMatch.index > 0) {
          parts.push(remaining.substring(0, italicMatch.index));
        }
        // Add italic text (use color since terminals don't always support italic)
        parts.push(
          <Text key={`italic-${partIndex++}`} color="yellow">
            {italicMatch[1]}
          </Text>
        );
        remaining = remaining.substring(italicMatch.index + italicMatch[0].length);
        continue;
      }

      // Code spans `code`
      const codeMatch = remaining.match(/`(.*?)`/);
      if (codeMatch && codeMatch.index !== undefined) {
        // Add text before the match
        if (codeMatch.index > 0) {
          parts.push(remaining.substring(0, codeMatch.index));
        }
        // Add code text
        parts.push(
          <Text key={`code-${partIndex++}`} backgroundColor="gray" color="black">
            {codeMatch[1]}
          </Text>
        );
        remaining = remaining.substring(codeMatch.index + codeMatch[0].length);
        continue;
      }

      // Fill-in-blank placeholders {{ }}
      const blankMatch = remaining.match(/\{\{\s*\}\}/);
      if (blankMatch && blankMatch.index !== undefined) {
        // Add text before the match
        if (blankMatch.index > 0) {
          parts.push(remaining.substring(0, blankMatch.index));
        }
        // Add blank placeholder
        parts.push(
          <Text key={`blank-${partIndex++}`} backgroundColor="blue" color="white">
            {'  '}
          </Text>
        );
        remaining = remaining.substring(blankMatch.index + blankMatch[0].length);
        continue;
      }

      // Multiple choice blank placeholders {{ || }}
      const choiceBlankMatch = remaining.match(/\{\{\s*\|\|\s*\}\}/);
      if (choiceBlankMatch && choiceBlankMatch.index !== undefined) {
        // Add text before the match
        if (choiceBlankMatch.index > 0) {
          parts.push(remaining.substring(0, choiceBlankMatch.index));
        }
        // Add choice placeholder
        parts.push(
          <Text key={`choice-blank-${partIndex++}`} backgroundColor="green" color="white">
            {'  '}
          </Text>
        );
        remaining = remaining.substring(choiceBlankMatch.index + choiceBlankMatch[0].length);
        continue;
      }

      // No more formatting found, add the rest
      parts.push(remaining);
      break;
    }

    return parts;
  };

  // Clean content - remove unsupported elements
  const cleanContent = (text: string): string => {
    return text
      // Remove image syntax
      .replace(/!\[.*?\]\(.*?\)/g, '[Image]')
      // Remove link syntax but keep text
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      // Remove HTML tags
      .replace(/<[^>]*>/g, '')
      // Clean up extra whitespace
      .replace(/\n\s*\n\s*\n/g, '\n\n');
  };

  const cleanedContent = cleanContent(content);
  const elements = parseMarkdown(cleanedContent);

  return (
    <Box flexDirection="column">
      {elements}
    </Box>
  );
};

export default MarkdownRenderer;
