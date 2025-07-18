import chalk from 'chalk';

/**
 * Error categories for studio-ui build failures
 */
export enum StudioBuildErrorType {
  QUESTIONS_HASH_ERROR = 'questions-hash-error',
  BUILD_FAILURE = 'build-failure', 
  COPY_FAILURE = 'copy-failure',
  MISSING_SOURCE = 'missing-source',
  MISSING_DEPENDENCIES = 'missing-dependencies',
  VITE_BUILD_ERROR = 'vite-build-error',
  TYPESCRIPT_ERROR = 'typescript-error',
  CRITICAL_ERROR = 'critical-error'
}

/**
 * Structured error information for studio-ui build failures
 */
export interface StudioBuildError {
  type: StudioBuildErrorType;
  message: string;
  cause?: Error;
  context?: Record<string, unknown>;
  recoverable: boolean;
  fallbackAvailable: boolean;
}

/**
 * Create a structured studio build error
 */
export function createStudioBuildError(
  type: StudioBuildErrorType,
  message: string,
  options: {
    cause?: Error;
    context?: Record<string, unknown>;
    recoverable?: boolean;
    fallbackAvailable?: boolean;
  } = {}
): StudioBuildError {
  return {
    type,
    message,
    cause: options.cause,
    context: options.context,
    recoverable: options.recoverable ?? true,
    fallbackAvailable: options.fallbackAvailable ?? true
  };
}

/**
 * Report a studio build error with appropriate formatting and guidance
 */
export function reportStudioBuildError(error: StudioBuildError): void {
  // Main error message
  console.error(chalk.red(`❌ Studio-UI Build Error: ${error.message}`));
  
  // Error type context
  console.error(chalk.gray(`   Type: ${error.type}`));
  
  // Underlying cause if available
  if (error.cause) {
    console.error(chalk.gray(`   Cause: ${error.cause.message}`));
  }
  
  // Context information
  if (error.context) {
    for (const [key, value] of Object.entries(error.context)) {
      console.error(chalk.gray(`   ${key}: ${String(value)}`));
    }
  }
  
  // Recovery guidance
  if (error.recoverable) {
    if (error.fallbackAvailable) {
      console.log(chalk.yellow(`   Fallback: Using default studio-ui (without local questions)`));
    } else {
      console.log(chalk.yellow(`   Recovery: Manual intervention required`));
    }
  } else {
    console.error(chalk.red(`   Critical: Studio session cannot continue`));
  }
  
  // Type-specific guidance
  provideBuildErrorGuidance(error.type);
}

/**
 * Provide specific guidance based on error type
 */
function provideBuildErrorGuidance(errorType: StudioBuildErrorType): void {
  switch (errorType) {
    case StudioBuildErrorType.QUESTIONS_HASH_ERROR:
      console.log(chalk.cyan(`   💡 Check that src/questions/ directory is accessible`));
      console.log(chalk.cyan(`   💡 Verify file permissions and disk space`));
      break;
      
    case StudioBuildErrorType.BUILD_FAILURE:
      console.log(chalk.cyan(`   💡 Check that Vite build dependencies are installed`));
      console.log(chalk.cyan(`   💡 Verify TypeScript configuration is valid`));
      break;
      
    case StudioBuildErrorType.COPY_FAILURE:
      console.log(chalk.cyan(`   💡 Check write permissions for .skuilder/studio-builds/`));
      console.log(chalk.cyan(`   💡 Verify sufficient disk space available`));
      break;
      
    case StudioBuildErrorType.MISSING_SOURCE:
      console.log(chalk.cyan(`   💡 Rebuild CLI package: yarn workspace @vue-skuilder/cli build`));
      console.log(chalk.cyan(`   💡 Verify studio-ui source was embedded during build`));
      break;
      
    case StudioBuildErrorType.MISSING_DEPENDENCIES:
      console.log(chalk.cyan(`   💡 Install dependencies: yarn install`));
      console.log(chalk.cyan(`   💡 Check that required packages are in package.json`));
      break;
      
    case StudioBuildErrorType.VITE_BUILD_ERROR:
      console.log(chalk.cyan(`   💡 Check question type implementations for syntax errors`));
      console.log(chalk.cyan(`   💡 Verify all imports and dependencies are available`));
      break;
      
    case StudioBuildErrorType.TYPESCRIPT_ERROR:
      console.log(chalk.cyan(`   💡 Check TypeScript configuration in tsconfig.json`));
      console.log(chalk.cyan(`   💡 Verify all question types have proper type definitions`));
      break;
      
    case StudioBuildErrorType.CRITICAL_ERROR:
      console.log(chalk.cyan(`   💡 Report this issue to the vue-skuilder team`));
      console.log(chalk.cyan(`   💡 Include the full error output in your report`));
      break;
  }
}

/**
 * Wrap a studio build operation with error handling
 */
export async function withStudioBuildErrorHandling<T>(
  operation: () => Promise<T>,
  errorType: StudioBuildErrorType,
  context?: Record<string, unknown>
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    const buildError = createStudioBuildError(
      errorType,
      error instanceof Error ? error.message : String(error),
      {
        cause: error instanceof Error ? error : undefined,
        context,
        recoverable: true,
        fallbackAvailable: true
      }
    );
    
    reportStudioBuildError(buildError);
    throw buildError;
  }
}

/**
 * Check if error is a recoverable studio build error
 */
export function isRecoverableStudioBuildError(error: unknown): boolean {
  return error instanceof Error && 
         'type' in error && 
         'recoverable' in error &&
         Boolean(error.recoverable);
}

/**
 * Extract error details for logging
 */
export function extractErrorDetails(error: unknown): {
  message: string;
  stack?: string;
  code?: string;
} {
  if (error instanceof Error) {
    return {
      message: error.message,
      stack: error.stack,
      code: 'code' in error ? String(error.code) : undefined
    };
  }
  
  return {
    message: String(error)
  };
}