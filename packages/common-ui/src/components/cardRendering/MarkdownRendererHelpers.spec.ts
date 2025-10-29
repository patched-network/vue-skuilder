import { describe, it, expect } from 'vitest';
import { parseComponentSyntax, isInlineComponent } from './MarkdownRendererHelpers';

describe('parseComponentSyntax', () => {
  describe('valid component syntax', () => {
    it('parses simple component without props', () => {
      const result = parseComponentSyntax('{{ <badge /> }}');
      expect(result).toEqual({
        componentName: 'badge',
        props: {},
      });
    });

    it('parses component with single prop', () => {
      const result = parseComponentSyntax('{{ <coloredBadge text="NEW" /> }}');
      expect(result).toEqual({
        componentName: 'coloredBadge',
        props: { text: 'NEW' },
      });
    });

    it('parses component with multiple props', () => {
      const result = parseComponentSyntax('{{ <chessBoard fen="rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR" size="large" /> }}');
      expect(result).toEqual({
        componentName: 'chessBoard',
        props: {
          fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR',
          size: 'large',
        },
      });
    });

    it('parses component with kebab-case name', () => {
      const result = parseComponentSyntax('{{ <chess-board fen="..." /> }}');
      expect(result).toEqual({
        componentName: 'chess-board',
        props: { fen: '...' },
      });
    });

    it('handles extra whitespace around delimiters', () => {
      const result = parseComponentSyntax('{{  <badge />  }}');
      expect(result).toEqual({
        componentName: 'badge',
        props: {},
      });
    });

    it('handles extra whitespace in props', () => {
      const result = parseComponentSyntax('{{ <badge   text="value"   color="#fff"  /> }}');
      expect(result).toEqual({
        componentName: 'badge',
        props: { text: 'value', color: '#fff' },
      });
    });

    it('parses props with special characters in values', () => {
      const result = parseComponentSyntax('{{ <component url="https://example.com/path?q=1&x=2" /> }}');
      expect(result).toEqual({
        componentName: 'component',
        props: { url: 'https://example.com/path?q=1&x=2' },
      });
    });

    it('parses props with empty string values', () => {
      const result = parseComponentSyntax('{{ <component text="" /> }}');
      expect(result).toEqual({
        componentName: 'component',
        props: { text: '' },
      });
    });
  });

  describe('fillIn blank syntax (should return null)', () => {
    it('returns null for simple text blank', () => {
      const result = parseComponentSyntax('{{ Paris }}');
      expect(result).toBeNull();
    });

    it('returns null for multiple choice blank', () => {
      const result = parseComponentSyntax('{{ Paris || London | Berlin }}');
      expect(result).toBeNull();
    });

    it('returns null for empty blank', () => {
      const result = parseComponentSyntax('{{ }}');
      expect(result).toBeNull();
    });

    it('returns null for blank with multiple choice indicator', () => {
      const result = parseComponentSyntax('{{ || }}');
      expect(result).toBeNull();
    });
  });

  describe('malformed syntax (should return null)', () => {
    it('returns null for plain text', () => {
      const result = parseComponentSyntax('just some text');
      expect(result).toBeNull();
    });

    it('returns null for component without delimiters', () => {
      const result = parseComponentSyntax('<badge />');
      expect(result).toBeNull();
    });

    it('returns null for unclosed component tag', () => {
      const result = parseComponentSyntax('{{ <badge }}');
      expect(result).toBeNull();
    });

    it('returns null for missing closing delimiter', () => {
      const result = parseComponentSyntax('{{ <badge />');
      expect(result).toBeNull();
    });

    it('returns null for missing opening delimiter', () => {
      const result = parseComponentSyntax('<badge /> }}');
      expect(result).toBeNull();
    });

    it('returns null for HTML-style closing tag', () => {
      const result = parseComponentSyntax('{{ <badge></badge> }}');
      expect(result).toBeNull();
    });
  });
});

describe('isInlineComponent', () => {
  describe('valid component syntax', () => {
    it('identifies simple self-closing component', () => {
      expect(isInlineComponent('<badge />')).toBe(true);
    });

    it('identifies component with props', () => {
      expect(isInlineComponent('<badge text="NEW" />')).toBe(true);
    });

    it('identifies component with multiple props', () => {
      expect(isInlineComponent('<chessBoard fen="..." size="large" />')).toBe(true);
    });

    it('identifies kebab-case component names', () => {
      expect(isInlineComponent('<chess-board />')).toBe(true);
    });

    it('handles whitespace around component', () => {
      expect(isInlineComponent('  <badge />  ')).toBe(true);
    });

    it('identifies component without space before />', () => {
      expect(isInlineComponent('<badge/>')).toBe(true);
    });
  });

  describe('fillIn blank syntax (should return false)', () => {
    it('rejects simple text', () => {
      expect(isInlineComponent('Paris')).toBe(false);
    });

    it('rejects multiple choice syntax', () => {
      expect(isInlineComponent('Paris || London | Berlin')).toBe(false);
    });

    it('rejects empty string', () => {
      expect(isInlineComponent('')).toBe(false);
    });

    it('rejects whitespace only', () => {
      expect(isInlineComponent('   ')).toBe(false);
    });

    it('rejects multiple choice indicator', () => {
      expect(isInlineComponent('||')).toBe(false);
    });
  });

  describe('malformed syntax (should return false)', () => {
    it('rejects component with {{ }} delimiters', () => {
      expect(isInlineComponent('{{ <badge /> }}')).toBe(false);
    });

    it('rejects unclosed tag', () => {
      expect(isInlineComponent('<badge')).toBe(false);
    });

    it('rejects HTML-style closing tag', () => {
      expect(isInlineComponent('<badge></badge>')).toBe(false);
    });

    it('rejects tag with content inside', () => {
      expect(isInlineComponent('<badge>text</badge>')).toBe(false);
    });

    it('rejects invalid characters in component name', () => {
      expect(isInlineComponent('<badge$ />')).toBe(false);
    });

    it('rejects props without quotes', () => {
      expect(isInlineComponent('<badge text=value />')).toBe(false);
    });

    it('rejects props with single quotes', () => {
      expect(isInlineComponent("<badge text='value' />")).toBe(false);
    });
  });
});
