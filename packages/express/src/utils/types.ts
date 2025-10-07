/**
 * Type guard to check if an error is a Nano RequestError with statusCode
 */
export function isNanoError(error: unknown): error is { statusCode?: number } {
  return typeof error === 'object' && error !== null && 'statusCode' in error;
}
