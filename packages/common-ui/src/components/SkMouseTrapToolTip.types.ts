export interface SkMouseTrapToolTipProps {
  /**
   * The keyboard shortcut(s) to bind to this tooltip.
   * Can be a single string like "ctrl+s" or an array of strings.
   */
  hotkey: string | string[];

  /**
   * Descriptive name for the keyboard shortcut.
   * Will be displayed in the shortcut dialog.
   */
  command: string;

  /**
   * Whether the shortcut is currently disabled.
   * @default false
   */
  disabled?: boolean;

  /**
   * The position of the tooltip relative to the wrapped element.
   * @default 'top'
   */
  position?: 'top' | 'bottom' | 'left' | 'right';

  /**
   * Whether to show the tooltip when the Ctrl key is pressed.
   * @default true
   */
  showTooltip?: boolean;

  /**
   * The visual effect to apply to the wrapped element when Ctrl is pressed.
   * @default 'glow'
   */
  highlightEffect?: 'glow' | 'scale' | 'border' | 'none';
}

export interface SkMouseTrapToolTipEmits {
  (event: 'hotkey-triggered', hotkey: string | string[]): void;
}