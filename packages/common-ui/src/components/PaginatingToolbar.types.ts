export interface PaginatingToolbarProps {
  /**
   * Array of page numbers
   */
  pages: number[];

  /**
   * Current active page
   */
  page: number;

  /**
   * Main title displayed in the toolbar
   */
  title?: string;

  /**
   * Secondary text displayed next to the title
   */
  subtitle?: string;
}

export interface PaginatingToolbarEvents {
  /**
   * Navigate to the first page
   */
  (e: 'first'): void;

  /**
   * Navigate to the previous page
   */
  (e: 'prev'): void;

  /**
   * Navigate to the next page
   */
  (e: 'next'): void;

  /**
   * Navigate to the last page
   */
  (e: 'last'): void;

  /**
   * Set the page to a specific number
   */
  (e: 'set-page', page: number): void;
}
