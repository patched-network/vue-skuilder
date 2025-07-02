/**
 * Development configuration utilities for studio-ui
 * Handles both CLI-injected config and environment variable fallbacks
 */

export interface StudioConfig {
  couchdb: {
    url: string;
    username: string;
    password: string;
  };
  database: {
    name: string;
    courseId: string;
  };
}

/**
 * Get studio configuration from either CLI injection or environment variables
 */
export function getStudioConfig(): StudioConfig | null {
  // First try CLI-injected configuration (production studio mode)
  const cliConfig = (window as any).STUDIO_CONFIG;
  if (cliConfig?.couchdb) {
    return cliConfig as StudioConfig;
  }

  // Fall back to environment variables (development mode)
  const envConfig = getEnvironmentConfig();
  if (envConfig) {
    console.log('🔧 Studio Dev Mode: Using environment configuration');
    return envConfig;
  }

  return null;
}

/**
 * Parse studio configuration from environment variables
 */
function getEnvironmentConfig(): StudioConfig | null {
  // Check if we're in development mode with studio environment variables
  const couchUrl = import.meta.env.VITE_STUDIO_COUCH_URL;
  const couchUser = import.meta.env.VITE_STUDIO_COUCH_USER;
  const couchPass = import.meta.env.VITE_STUDIO_COUCH_PASS;
  const courseId = import.meta.env.VITE_STUDIO_COURSE_ID;

  if (!couchUrl || !couchUser || !couchPass || !courseId) {
    return null;
  }

  // For development, we'll use the courseId as the database name
  // This assumes the course has been unpacked to CouchDB already
  const databaseName = courseId;

  return {
    couchdb: {
      url: couchUrl,
      username: couchUser,
      password: couchPass,
    },
    database: {
      name: databaseName,
      courseId: courseId,
    },
  };
}

/**
 * Check if we're running in development studio mode
 */
export function isDevelopmentStudioMode(): boolean {
  return !!import.meta.env.VITE_STUDIO_COUCH_URL;
}

/**
 * Get helpful error message for missing configuration
 */
export function getConfigErrorMessage(): string {
  if (isDevelopmentStudioMode()) {
    return `
Studio development mode configuration incomplete. Please provide:
- VITE_STUDIO_COUCH_URL (e.g., http://localhost:5985)
- VITE_STUDIO_COUCH_USER (e.g., admin)
- VITE_STUDIO_COUCH_PASS (e.g., admin)
- VITE_STUDIO_COURSE_ID (e.g., 2aeb8315ef78f3e89ca386992d00825b)

Run with: 
VITE_STUDIO_COUCH_URL=http://localhost:5985 \\
VITE_STUDIO_COUCH_USER=admin \\
VITE_STUDIO_COUCH_PASS=admin \\
VITE_STUDIO_COURSE_ID=your-course-id \\
yarn dev:studio
    `.trim();
  }

  return 'Studio configuration not found. Please run via skuilder CLI studio command.';
}