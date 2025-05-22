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
  position?: 'top' | 'bottom';

  /**
   * Whether to show the tooltip when the Ctrl key is pressed.
   * @default true
   */
  showTooltip?: boolean;
}

export interface SkMouseTrapToolTipEmits {
  (event: 'hotkey-triggered', hotkey: string | string[]): void;
}