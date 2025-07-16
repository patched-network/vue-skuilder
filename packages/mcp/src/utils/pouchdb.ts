/**
 * Type guard for successful PouchDB rows
 * Filters out error rows and ensures doc property exists
 */
export function isSuccessRow<T = any>(row: any): row is { doc: NonNullable<T>; id: string; key: string; value: any } {
  return row.doc != null && !('error' in row);
}

/**
 * Safely extracts documents from PouchDB AllDocsResponse
 * Returns only successful rows with valid documents
 */
export function extractSuccessfulDocs<T>(rows: any[]): T[] {
  const docs: T[] = [];
  for (const row of rows) {
    if (isSuccessRow(row)) {
      docs.push(row.doc);
    }
  }
  return docs;
}

/**
 * Safely filters and maps PouchDB rows with type safety
 */
export function filterAndMapDocs<T, R>(
  rows: any[],
  filterFn: (doc: T) => boolean,
  mapFn: (doc: T) => R
): R[] {
  const results: R[] = [];
  for (const row of rows) {
    if (isSuccessRow(row)) {
      const doc = row.doc as T;
      if (filterFn(doc)) {
        results.push(mapFn(doc));
      }
    }
  }
  return results;
}