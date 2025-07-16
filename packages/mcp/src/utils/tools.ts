import { z } from 'zod';

// Shared constants
export const MCP_AGENT_AUTHOR = 'mcp-agent';

// Common error handling utility
export function handleToolError(error: unknown, context: string): never {
  if (error instanceof z.ZodError) {
    throw new Error(`Invalid input: ${error.errors.map(e => e.message).join(', ')}`);
  }
  
  const message = error instanceof Error ? error.message : 'Unknown error';
  console.error(`Error in ${context}:`, error);
  throw new Error(`${context} failed: ${message}`);
}

// Logging utilities
export function logToolStart(toolName: string, input: any): void {
  console.log(`[${toolName}] Starting with input:`, JSON.stringify(input, null, 2));
}

export function logToolSuccess(toolName: string, result: any): void {
  console.log(`[${toolName}] Completed successfully:`, JSON.stringify(result, null, 2));
}

export function logToolWarning(toolName: string, message: string, details?: any): void {
  console.warn(`[${toolName}] Warning: ${message}`, details || '');
}

export function logToolError(toolName: string, message: string, error?: any): void {
  console.error(`[${toolName}] Error: ${message}`, error || '');
}