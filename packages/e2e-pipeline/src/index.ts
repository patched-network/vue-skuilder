/**
 * @vue-skuilder/e2e-pipeline
 *
 * End-to-end testing package for navigation pipeline and session controller behavior.
 *
 * This package provides test harnesses, fixtures, and mocks for testing:
 * - Pipeline strategy assembly and execution
 * - SessionController queue management
 * - MCP tool integration
 */

// Test harness utilities
export * from './harness';

// Test fixtures (course builders, templates)
export * from './fixtures';

// Mock implementations
export * from './mocks';