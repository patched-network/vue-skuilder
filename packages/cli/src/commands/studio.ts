import { CouchDBManager } from '@vue-skuilder/common/docker';
import chalk from 'chalk';
import { Command } from 'commander';
import fs from 'fs';
import http from 'http';
import path, { dirname } from 'path';
import serveStatic from 'serve-static';
import { fileURLToPath } from 'url';
import { VERSION } from '../cli.js';
import {
  createStudioBuildError,
  reportStudioBuildError,
  StudioBuildErrorType,
  withStudioBuildErrorHandling,
} from '../utils/error-reporting.js';
import { createExpressApp, initializeServices } from '@vue-skuilder/express';
import type { ExpressServerConfig } from '@vue-skuilder/express';
import {
  ensureBuildDirectory,
  ensureCacheDirectory,
  getStudioBuildPath,
  hashQuestionsDirectory,
  studioBuildExists,
} from '../utils/questions-hash.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Find an available port starting from the given port number
 */
async function findAvailablePort(startPort: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = http.createServer();
    
    server.listen(startPort, () => {
      const actualPort = (server.address() as any)?.port;
      server.close(() => {
        resolve(actualPort || startPort);
      });
    });
    
    server.on('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        // Port is in use, try the next one
        resolve(findAvailablePort(startPort + 1));
      } else {
        reject(err);
      }
    });
  });
}

export function createStudioCommand(): Command {
  return new Command('studio')
    .description(
      'Launch studio mode: a complete course editing environment with CouchDB, Express API, and web editor'
    )
    .argument('[coursePath]', 'Path to static course directory', '.')
    .option('-p, --port <port>', 'CouchDB port for studio session', '5985')
    .option('--no-browser', 'Skip automatic browser launch')
    .action(launchStudio)
    .addHelpText(
      'after',
      `
Studio Mode creates a full editing environment for static courses:

  Services Started:
    • CouchDB instance (Docker) on port 5985+ for temporary editing
    • Express API server on port 3001+ for backend operations
    • Studio web interface on port 7174+ for visual editing

  Workflow:
    1. Loads course data from public/static-courses/ into CouchDB
    2. Opens web editor for visual course content editing
    3. Use "Flush to Static" to save changes back to your course files
    4. Studio mode overwrites source files - backup before major edits

  Requirements:
    • Docker (for CouchDB instance)
    • Valid static course project (with package.json)
    • Course data in public/static-courses/ directory

  Example:
    skuilder studio                    # Launch in current directory
    skuilder studio ./my-course        # Launch for specific course
    skuilder studio --port 6000        # Use custom CouchDB port
    skuilder studio --no-browser       # Don't auto-open browser`
    );
}

interface StudioOptions {
  port: string;
  browser: boolean;
}

// Global references for cleanup
let couchDBManager: CouchDBManager | null = null;
let expressServer: http.Server | null = null;
let studioUIServer: http.Server | null = null;

async function launchStudio(coursePath: string, options: StudioOptions) {
  try {
    console.log(chalk.cyan(`🎨 Launching Skuilder Studio...`));

    // Phase 2: Course Detection & Validation
    const resolvedPath = path.resolve(coursePath);
    console.log(chalk.gray(`📁 Course path: ${resolvedPath}`));

    if (!(await validateSuiCourse(resolvedPath))) {
      console.error(chalk.red(`❌ Not a valid standalone-ui course directory`));
      console.log(chalk.yellow(`💡 Studio mode requires a vue-skuilder course with:`));
      console.log(chalk.yellow(`   - package.json with @vue-skuilder/* dependencies`));
      console.log(
        chalk.yellow(`   - static-data/ OR public/static-courses/ directory with course content`)
      );
      process.exit(1);
    }

    console.log(chalk.green(`✅ Valid standalone-ui course detected`));

    // Phase 0.5: Hash questions directory to determine studio-ui build needs
    console.log(chalk.cyan(`🔍 Analyzing local question types...`));
    let questionsHash: string;
    let studioUIPath: string;

    try {
      questionsHash = await withStudioBuildErrorHandling(
        () => hashQuestionsDirectory(resolvedPath),
        StudioBuildErrorType.QUESTIONS_HASH_ERROR,
        { coursePath: resolvedPath }
      );

      // Ensure cache directory exists
      await ensureCacheDirectory(resolvedPath);

      const buildExists = studioBuildExists(resolvedPath, questionsHash);
      const buildPath = getStudioBuildPath(resolvedPath, questionsHash);

      console.log(chalk.gray(`   Questions hash: ${questionsHash}`));
      console.log(chalk.gray(`   Cached build exists: ${buildExists ? 'Yes' : 'No'}`));

      // Determine if we need to rebuild studio-ui
      if (buildExists) {
        console.log(chalk.gray(`   Using cached build at: ${buildPath}`));
        studioUIPath = buildPath;
      } else {
        console.log(chalk.cyan(`🔨 Building studio-ui with local question types...`));
        studioUIPath = await buildStudioUIWithQuestions(resolvedPath, questionsHash);
        console.log(chalk.green(`✅ Studio-UI build complete: ${studioUIPath}`));
      }
    } catch (error) {
      // Handle catastrophic build errors by falling back to embedded source
      console.log(
        chalk.yellow(
          `⚠️  Unable to process questions due to ${error},\n⚠️  Using embedded studio-ui`
        )
      );

      const embeddedPath = path.join(__dirname, '..', 'studio-ui-src');

      if (fs.existsSync(embeddedPath)) {
        studioUIPath = embeddedPath;
        console.log(chalk.gray(`   Using embedded studio-ui source directly`));
      } else {
        console.error(chalk.red(`❌ No viable studio-ui source available`));
        throw new Error('Critical error: Cannot locate studio-ui source');
      }
    }

    // Phase 1: CouchDB Management
    const studioDatabaseName = generateStudioDatabaseName(resolvedPath);
    console.log(chalk.cyan(`🗄️  Starting studio CouchDB instance: ${studioDatabaseName}`));

    couchDBManager = await startStudioCouchDB(studioDatabaseName, parseInt(options.port));

    // Phase 4: Populate CouchDB with course data
    console.log(chalk.cyan(`📦 Unpacking course data to studio database...`));
    const unpackResult = await unpackCourseToStudio(
      resolvedPath,
      couchDBManager.getConnectionDetails()
    );

    // Phase 9.5: Launch Express backend
    console.log(chalk.cyan(`⚡ Starting Express backend server...`));
    const expressResult = await startExpressBackend(couchDBManager.getConnectionDetails(), resolvedPath);
    expressServer = expressResult.server;

    // Phase 7: Launch studio-ui server
    console.log(chalk.cyan(`🌐 Starting studio-ui server...`));
    console.log(
      chalk.gray(
        `   Debug: Unpack result - Database: "${unpackResult.databaseName}", Course ID: "${unpackResult.courseId}"`
      )
    );
    const studioUIPort = await startStudioUIServer(
      couchDBManager.getConnectionDetails(),
      unpackResult,
      studioUIPath
    );

    console.log(chalk.green(`✅ Studio session ready!`));
    console.log(chalk.white(`🎨 Studio URL: http://localhost:${studioUIPort}`));
    console.log(chalk.gray(`   Database: ${studioDatabaseName} on port ${options.port}`));
    console.log(chalk.gray(`   Express API: ${expressResult.url}`));

    // Display MCP connection information
    const mcpInfo = getMCPConnectionInfo(unpackResult, couchDBManager, resolvedPath);
    console.log(chalk.blue(`🔗 MCP Server: ${mcpInfo.command}`));
    console.log(chalk.gray(`   Connect MCP clients using the command above`));
    console.log(chalk.gray(`   Environment variables for MCP:`));
    Object.entries(mcpInfo.env).forEach(([key, value]) => {
      console.log(chalk.gray(`     ${key}=${value}`));
    });

    // Display .mcp.json content for Claude Code integration
    const mcpJsonContent = generateMCPJson(unpackResult, couchDBManager, resolvedPath);
    console.log(chalk.blue(`📋 .mcp.json content:`));
    console.log(chalk.gray(mcpJsonContent));

    if (options.browser) {
      console.log(chalk.cyan(`🌐 Opening browser...`));
      await openBrowser(`http://localhost:${studioUIPort}`);
    }
    console.log(chalk.gray(`   Press Ctrl+C to stop studio session`));

    // Keep process alive and handle cleanup
    process.on('SIGINT', () => {
      void (async () => {
        console.log(chalk.cyan(`\n🔄 Stopping studio session...`));
        await stopStudioSession();
        console.log(chalk.green(`✅ Studio session stopped`));
        process.exit(0);
      })();
    });

    process.on('SIGTERM', () => {
      void (async () => {
        console.log(chalk.cyan(`\n🔄 Stopping studio session...`));
        await stopStudioSession();
        process.exit(0);
      })();
    });

    // Keep process alive
    await new Promise(() => {});
  } catch (error) {
    console.error(chalk.red(`❌ Studio launch failed:`), error);
    process.exit(1);
  }
}

/**
 * Phase 2: Validate that the given path contains a standalone-ui course
 */
async function validateSuiCourse(coursePath: string): Promise<boolean> {
  try {
    // Check if directory exists
    if (!fs.existsSync(coursePath)) {
      return false;
    }

    // Check for package.json
    const packageJsonPath = path.join(coursePath, 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
      return false;
    }

    // Read and validate package.json
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

    // Check for vue-skuilder course indicators (either standalone-ui or required packages)
    const hasStandaloneUi =
      (packageJson.dependencies && packageJson.dependencies['@vue-skuilder/standalone-ui']) ||
      (packageJson.devDependencies && packageJson.devDependencies['@vue-skuilder/standalone-ui']);

    const hasRequiredPackages =
      packageJson.dependencies &&
      packageJson.dependencies['@vue-skuilder/common-ui'] &&
      packageJson.dependencies['@vue-skuilder/courseware'] &&
      packageJson.dependencies['@vue-skuilder/db'];

    if (!hasStandaloneUi && !hasRequiredPackages) {
      return false;
    }

    // Check for course content directory (static-data OR public/static-courses)
    const staticDataPath = path.join(coursePath, 'static-data');
    const publicStaticCoursesPath = path.join(coursePath, 'public', 'static-courses');

    if (!fs.existsSync(staticDataPath) && !fs.existsSync(publicStaticCoursesPath)) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Generate a unique database name for this studio session
 */
function generateStudioDatabaseName(coursePath: string): string {
  const courseName = path.basename(coursePath);
  const timestamp = Date.now();
  return `studio-${courseName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${timestamp}`;
}

/**
 * Phase 1: Start CouchDB for studio session
 */
async function startStudioCouchDB(_databaseName: string, port: number): Promise<CouchDBManager> {
  const manager = new CouchDBManager(
    {
      mode: 'blank',
      port: port,
      containerName: `skuilder-studio-${port}`,
    },
    {
      onLog: (message) => console.log(chalk.gray(`   ${message}`)),
      onError: (error) => console.error(chalk.red(`   Error: ${error}`)),
    }
  );

  try {
    await manager.start();

    const connectionDetails = manager.getConnectionDetails();
    console.log(chalk.green(`✅ CouchDB studio instance ready`));
    console.log(chalk.gray(`   URL: ${connectionDetails.url}`));
    console.log(chalk.gray(`   Username: ${connectionDetails.username}`));
    console.log(chalk.gray(`   Password: ${connectionDetails.password}`));

    return manager;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(chalk.red(`Failed to start CouchDB: ${errorMessage}`));
    throw error;
  }
}

/**
 * Stop entire studio session (CouchDB + Express + UI server)
 */
async function stopStudioSession(): Promise<void> {
  // Stop studio-ui server
  if (studioUIServer) {
    try {
      studioUIServer.close();
      console.log(chalk.green(`✅ Studio-UI server stopped`));
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(chalk.red(`Error stopping studio-ui server: ${errorMessage}`));
    }
    studioUIServer = null;
  }

  // Stop Express backend
  if (expressServer) {
    try {
      await new Promise<void>((resolve) => {
        expressServer!.close(() => {
          console.log(chalk.green(`✅ Express backend stopped`));
          resolve();
        });
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(chalk.red(`Error stopping Express backend: ${errorMessage}`));
    }
    expressServer = null;
  }

  // Stop CouchDB
  if (couchDBManager) {
    try {
      await couchDBManager.remove(); // This stops and removes the container
      console.log(chalk.green(`✅ CouchDB studio instance cleaned up`));
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(chalk.red(`Error cleaning up CouchDB: ${errorMessage}`));
    }
    couchDBManager = null;
  }
}

/**
 * Phase 7: Start studio-ui static file server
 */
interface ConnectionDetails {
  url: string;
  username: string;
  password: string;
}

interface UnpackResult {
  databaseName: string;
  courseId: string;
}

async function startStudioUIServer(
  connectionDetails: ConnectionDetails,
  unpackResult: UnpackResult,
  studioPath: string
): Promise<number> {
  // Serve from built dist directory if it exists, otherwise fallback to source
  const distPath = path.join(studioPath, 'dist');
  const studioSourcePath = fs.existsSync(distPath) ? distPath : studioPath;

  console.log(chalk.gray(`   Serving studio-ui from: ${studioSourcePath}`));

  const serve = serveStatic(studioSourcePath, {
    index: ['index.html'],
    setHeaders: (res, path) => {
      if (path.endsWith('.woff2')) {
        res.setHeader('Content-Type', 'font/woff2');
      } else if (path.endsWith('.woff')) {
        res.setHeader('Content-Type', 'font/woff');
      } else if (path.endsWith('.ttf')) {
        res.setHeader('Content-Type', 'font/ttf');
      } else if (path.endsWith('.eot')) {
        res.setHeader('Content-Type', 'application/vnd.ms-fontobject');
      }
    },
  });

  if (!fs.existsSync(studioSourcePath)) {
    throw new Error('Studio-UI source not found. Please rebuild the CLI package.');
  }

  // Find available port starting from 7174
  let port = 7174;
  while (port < 7200) {
    try {
      await new Promise<void>((resolve, reject) => {
        const server = http.createServer((req, res) => {
          const url = new URL(req.url || '/', `http://${req.headers.host}`);

          // Inject config for index.html
          if (url.pathname === '/' || url.pathname === '/index.html') {
            const indexPath = path.join(studioSourcePath, 'index.html');
            let html = fs.readFileSync(indexPath, 'utf8');
            const connectionScript = `
              <script>
                window.STUDIO_CONFIG = {
                  couchdb: {
                    url: '${connectionDetails.url}',
                    username: '${connectionDetails.username}',
                    password: '${connectionDetails.password}'
                  },
                  database: {
                    name: '${unpackResult.databaseName}',
                    courseId: '${unpackResult.courseId}',
                    originalCourseId: '${unpackResult.courseId}'
                  }
                };
              </script>
            `;
            html = html.replace('</head>', connectionScript + '</head>');
            res.setHeader('Content-Type', 'text/html');
            res.end(html);
            return;
          }

          // Fallback to serve-static for all other assets
          serve(req, res, () => {
            // If serve-static doesn't find the file, it calls next().
            // We can treat this as a 404, but for SPAs, we should serve index.html.
            const indexPath = path.join(studioSourcePath, 'index.html');
            let html = fs.readFileSync(indexPath, 'utf8');
            const connectionScript = `
              <script>
                window.STUDIO_CONFIG = {
                  couchdb: {
                    url: '${connectionDetails.url}',
                    username: '${connectionDetails.username}',
                    password: '${connectionDetails.password}'
                  },
                  database: {
                    name: '${unpackResult.databaseName}',
                    courseId: '${unpackResult.courseId}',
                    originalCourseId: '${unpackResult.courseId}'
                  }
                };
              </script>
            `;
            html = html.replace('</head>', connectionScript + '</head>');
            res.setHeader('Content-Type', 'text/html');
            res.end(html);
          });
        });

        server.listen(port, '127.0.0.1', () => {
          studioUIServer = server;
          resolve();
        });

        server.on('error', (err: NodeJS.ErrnoException) => {
          if (err.code === 'EADDRINUSE') {
            reject(err);
          } else {
            reject(err);
          }
        });
      });

      // Port is available
      console.log(chalk.green(`✅ Studio-UI server running on port ${port}`));
      return port;
    } catch (error: unknown) {
      if (error instanceof Error && 'code' in error && error.code === 'EADDRINUSE') {
        port++;
        continue;
      } else {
        throw error;
      }
    }
  }

  throw new Error('Unable to find an available port for studio-ui server');
}

/**
 * Open browser to studio URL
 */
async function openBrowser(url: string): Promise<void> {
  const { spawn } = await import('child_process');

  let command: string;
  let args: string[];

  switch (process.platform) {
    case 'darwin':
      command = 'open';
      args = [url];
      break;
    case 'win32':
      command = 'start';
      args = ['', url];
      break;
    default:
      command = 'xdg-open';
      args = [url];
      break;
  }

  try {
    spawn(command, args, { detached: true, stdio: 'ignore' });
  } catch {
    console.log(chalk.yellow(`⚠️  Could not automatically open browser. Please visit: ${url}`));
  }
}

/**
 * Phase 9.5: Start Express backend server
 */
async function startExpressBackend(
  couchDbConnectionDetails: ConnectionDetails,
  _projectPath: string
): Promise<{ server: http.Server; port: number; url: string }> {
  console.log(chalk.blue('⚡ Starting Express backend server...'));

  // Find available port starting from 3001
  const availablePort = await findAvailablePort(3001);

  // Extract server and protocol from CouchDB URL
  const couchUrl = new URL(couchDbConnectionDetails.url);
  const server = `${couchUrl.hostname}:${couchUrl.port}`;
  const protocol = couchUrl.protocol.replace(':', '');

  // Create Express server configuration
  const config: ExpressServerConfig = {
    port: availablePort,
    couchdb: {
      protocol: protocol,
      server: server,
      username: couchDbConnectionDetails.username,
      password: couchDbConnectionDetails.password,
    },
    version: VERSION,
    nodeEnv: 'studio',
    cors: {
      credentials: true,
      origin: true,
    },
  };

  try {
    // Create Express app using factory
    const app = createExpressApp(config);

    // Start server
    const server = app.listen(availablePort, () => {
      console.log(chalk.green(`✅ Express backend ready`));
      console.log(chalk.gray(`   URL: http://localhost:${availablePort}`));
      console.log(chalk.gray(`   Port: ${availablePort}`));
    });

    // Initialize background services
    await initializeServices();

    return {
      server,
      port: availablePort,
      url: `http://localhost:${availablePort}`,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(chalk.red(`Failed to start Express backend: ${errorMessage}`));
    throw error;
  }
}

/**
 * Phase 4: Unpack course data to studio CouchDB
 */
async function unpackCourseToStudio(
  coursePath: string,
  connectionDetails: ConnectionDetails
): Promise<{ databaseName: string; courseId: string }> {
  try {
    // Find the course data directory (static-data OR public/static-courses)
    let courseDataPath = path.join(coursePath, 'static-data');
    if (!fs.existsSync(courseDataPath)) {
      // Try public/static-courses directory
      const publicStaticPath = path.join(coursePath, 'public', 'static-courses');
      if (fs.existsSync(publicStaticPath)) {
        // Find the first course directory inside public/static-courses
        const courses = fs
          .readdirSync(publicStaticPath, { withFileTypes: true })
          .filter((dirent) => dirent.isDirectory())
          .map((dirent) => dirent.name);

        if (courses.length > 0) {
          courseDataPath = path.join(publicStaticPath, courses[0]);
        } else {
          throw new Error('No course directories found in public/static-courses/');
        }
      } else {
        throw new Error('No course data found in static-data/ or public/static-courses/');
      }
    }

    console.log(chalk.gray(`   Course data path: ${courseDataPath}`));

    console.log(chalk.gray(`   Running unpack directly...`));

    // Generate database name the same way unpack command does
    const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.random().toString(36).substring(2, 8);

    // We need the course ID from the static course data first
    const { validateStaticCourse } = await import('@vue-skuilder/db');
    const { NodeFileSystemAdapter } = await import('../utils/NodeFileSystemAdapter.js');
    const fileSystemAdapter = new NodeFileSystemAdapter();
    const validation = await validateStaticCourse(courseDataPath, fileSystemAdapter);

    if (!validation.valid) {
      throw new Error('Static course validation failed');
    }

    const studioCourseId = `unpacked_${validation.courseId || 'unknown'}_${timestamp}_${random}`;
    const targetDbName = `coursedb-${studioCourseId}`;

    // Import and call the existing unpack command
    const { unpackCourse } = await import('./unpack.js');

    try {
      await unpackCourse(courseDataPath, {
        server: connectionDetails.url,
        username: connectionDetails.username,
        password: connectionDetails.password,
        database: targetDbName,
        chunkSize: '100',
        validate: false,
        cleanupOnError: true,
      });

      console.log(chalk.green(`✅ Course data unpacked successfully`));

      // Return the database name and course ID for studio use
      const databaseName = studioCourseId;
      const courseId = validation.courseId || '';

      console.log(
        chalk.gray(
          `   Debug: Extracted - Full DB: "${targetDbName}", Course DB ID: "${databaseName}", Course ID: "${courseId}"`
        )
      );

      return { databaseName, courseId };
    } catch (innerError) {
      console.error(
        chalk.red(
          `❌ Failed to unpack course: ${innerError instanceof Error ? innerError.message : String(innerError)}`
        )
      );
      throw innerError;
    }
  } catch (error) {
    console.error(
      chalk.red(
        `❌ Studio unpack failed: ${error instanceof Error ? error.message : String(error)}`
      )
    );
    throw error;
  }
}

/**
 * Build studio-ui with local question types integrated
 */
async function buildStudioUIWithQuestions(
  coursePath: string,
  questionsHash: string
): Promise<string> {
  const buildPath = await ensureBuildDirectory(coursePath, questionsHash);

  try {
    // Handle special cases
    if (questionsHash === 'no-questions') {
      console.log(chalk.gray(`   No local questions detected, using default studio-ui`));
      return await buildDefaultStudioUI(buildPath);
    }

    if (questionsHash === 'empty-questions') {
      console.log(chalk.gray(`   Empty questions directory, using default studio-ui`));
      return await buildDefaultStudioUI(buildPath);
    }

    if (questionsHash === 'hash-error') {
      const hashError = createStudioBuildError(
        StudioBuildErrorType.QUESTIONS_HASH_ERROR,
        'Questions directory could not be processed',
        {
          context: { coursePath, questionsHash },
          recoverable: true,
          fallbackAvailable: true,
        }
      );
      reportStudioBuildError(hashError);
      return await buildDefaultStudioUI(buildPath);
    }

    // Phase 4.1 - Build custom questions library and integrate with studio-ui
    console.log(chalk.cyan(`   Building custom questions library...`));
    const customQuestionsData = await buildCustomQuestionsLibrary(coursePath, questionsHash);

    if (customQuestionsData) {
      console.log(chalk.cyan(`   Integrating custom questions into studio-ui...`));
      return await buildStudioUIWithCustomQuestions(buildPath, customQuestionsData);
    } else {
      console.log(
        chalk.yellow(`   Failed to build custom questions, falling back to default studio-ui`)
      );
      return await buildDefaultStudioUI(buildPath);
    }
  } catch (error) {
    const buildError = createStudioBuildError(
      StudioBuildErrorType.BUILD_FAILURE,
      'Studio-UI build process failed',
      {
        cause: error instanceof Error ? error : undefined,
        context: { coursePath, questionsHash, buildPath },
        recoverable: true,
        fallbackAvailable: true,
      }
    );

    reportStudioBuildError(buildError);

    // Always try fallback to default studio-ui
    try {
      return await buildDefaultStudioUI(buildPath);
    } catch (fallbackError) {
      // If even the fallback fails, this is critical
      const criticalError = createStudioBuildError(
        StudioBuildErrorType.CRITICAL_ERROR,
        'Both primary and fallback studio-ui builds failed',
        {
          cause: fallbackError instanceof Error ? fallbackError : undefined,
          context: { coursePath, questionsHash, buildPath, originalError: error },
          recoverable: false,
          fallbackAvailable: false,
        }
      );

      reportStudioBuildError(criticalError);
      throw criticalError;
    }
  }
}

/**
 * Build default studio-ui (without local questions integration)
 */
async function buildDefaultStudioUI(buildPath: string): Promise<string> {
  const studioSourcePath = path.join(__dirname, '..', 'studio-ui-src');

  try {
    // Verify source directory exists
    if (!fs.existsSync(studioSourcePath)) {
      const sourceError = createStudioBuildError(
        StudioBuildErrorType.MISSING_SOURCE,
        `Studio-UI source directory not found at ${studioSourcePath}`,
        {
          context: { studioSourcePath, buildPath },
          recoverable: true,
          fallbackAvailable: true,
        }
      );
      reportStudioBuildError(sourceError);
      throw sourceError;
    }

    // Copy studio-ui source files to build directory
    console.log(chalk.gray(`   Copying studio-ui source to build directory...`));

    const { copyDirectory } = await import('../utils/template.js');
    await withStudioBuildErrorHandling(
      () => copyDirectory(studioSourcePath, buildPath),
      StudioBuildErrorType.COPY_FAILURE,
      { studioSourcePath, buildPath }
    );

    // Transform workspace dependencies to published versions
    console.log(chalk.gray(`   Transforming workspace dependencies...`));
    const studioPackageJsonPath = path.join(buildPath, 'package.json');
    await transformPackageJsonForStudioBuild(studioPackageJsonPath);

    // Fix Vite config to use npm packages instead of monorepo paths
    console.log(chalk.gray(`   Updating Vite configuration for standalone build...`));
    await fixViteConfigForStandaloneBuild(buildPath);

    // Run Vite build process
    console.log(chalk.gray(`   Running Vite build process...`));
    await runViteBuild(buildPath);

    // Verify build output exists
    const distPath = path.join(buildPath, 'dist');
    const indexPath = path.join(distPath, 'index.html');
    if (!fs.existsSync(indexPath)) {
      const buildError = createStudioBuildError(
        StudioBuildErrorType.BUILD_FAILURE,
        `Build output missing: ${indexPath}`,
        {
          context: { buildPath, distPath, indexPath },
          recoverable: true,
          fallbackAvailable: true,
        }
      );
      reportStudioBuildError(buildError);
      throw buildError;
    }

    console.log(chalk.gray(`   Default studio-ui built successfully`));
    return buildPath;
  } catch (error) {
    // Ultimate fallback: serve directly from embedded source
    if (fs.existsSync(studioSourcePath)) {
      console.log(chalk.yellow(`   Using embedded studio-ui source as final fallback`));
      return studioSourcePath;
    }

    // This should never happen, but provides a last resort
    const criticalError = createStudioBuildError(
      StudioBuildErrorType.CRITICAL_ERROR,
      'No viable studio-ui source available',
      {
        cause: error instanceof Error ? error : undefined,
        context: { studioSourcePath, buildPath },
        recoverable: false,
        fallbackAvailable: false,
      }
    );

    reportStudioBuildError(criticalError);
    throw criticalError;
  }
}

/**
 * Interface for custom questions data
 */
interface CustomQuestionsData {
  coursePath: string;
  questionsHash: string;
  libraryPath: string;
  packageName: string;
}

/**
 * Build custom questions library from scaffolded course
 */
async function buildCustomQuestionsLibrary(
  coursePath: string,
  questionsHash: string
): Promise<CustomQuestionsData | null> {
  try {
    // Check if this is a scaffolded course with dual build system
    const packageJsonPath = path.join(coursePath, 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
      console.log(chalk.gray(`   No package.json found, skipping custom questions build`));
      return null;
    }

    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

    // Check if course has the dual build system (build:lib script)
    if (!packageJson.scripts || !packageJson.scripts['build:lib']) {
      console.log(chalk.gray(`   Course does not support custom questions library build`));
      return null;
    }

    // Check if course has questions directory with our expected structure
    const questionsIndexPath = path.join(coursePath, 'src', 'questions', 'index.ts');
    if (!fs.existsSync(questionsIndexPath)) {
      console.log(
        chalk.gray(`   No src/questions/index.ts found, skipping custom questions build`)
      );
      return null;
    }

    console.log(chalk.cyan(`   Found scaffolded course with custom questions support`));
    console.log(chalk.gray(`   Building questions library...`));

    // Build the questions library
    const { spawn } = await import('child_process');

    const buildProcess = spawn('npm', ['run', 'build:lib'], {
      cwd: coursePath,
      stdio: 'pipe',
      env: { ...process.env, BUILD_MODE: 'library' },
    });

    let buildOutput = '';
    let buildError = '';

    buildProcess.stdout?.on('data', (data) => {
      buildOutput += data.toString();
    });

    buildProcess.stderr?.on('data', (data) => {
      buildError += data.toString();
    });

    const buildExitCode = await new Promise<number>((resolve) => {
      buildProcess.on('close', resolve);
    });

    if (buildExitCode !== 0) {
      const buildFailError = createStudioBuildError(
        StudioBuildErrorType.BUILD_FAILURE,
        'Custom questions library build failed',
        {
          context: {
            coursePath,
            questionsHash,
            exitCode: buildExitCode,
            output: buildOutput,
            error: buildError,
          },
          recoverable: true,
          fallbackAvailable: true,
        }
      );
      reportStudioBuildError(buildFailError);
      return null;
    }

    console.log(chalk.green(`   ✅ Questions library built successfully`));

    // Check that the library build outputs exist
    const libraryPath = path.join(coursePath, 'dist-lib');
    const questionsLibPath = path.join(libraryPath, 'questions.mjs');

    if (!fs.existsSync(questionsLibPath)) {
      console.log(
        chalk.yellow(`   Warning: Expected library output not found at ${questionsLibPath}`)
      );
      return null;
    }

    // Validate that the questions library was built successfully
    console.log(chalk.green(`   ✅ Questions library built and available for studio-ui`));
    console.log(chalk.gray(`      Library path: ${questionsLibPath}`));
    console.log(chalk.gray(`      Package name: ${packageJson.name}`));

    return {
      coursePath,
      questionsHash,
      libraryPath,
      packageName: packageJson.name,
    };
  } catch (error) {
    const generalError = createStudioBuildError(
      StudioBuildErrorType.BUILD_FAILURE,
      'Custom questions library build process failed',
      {
        cause: error instanceof Error ? error : undefined,
        context: { coursePath, questionsHash },
        recoverable: true,
        fallbackAvailable: true,
      }
    );
    reportStudioBuildError(generalError);
    return null;
  }
}

/**
 * Build studio-ui with custom questions integrated via npm install
 */
async function buildStudioUIWithCustomQuestions(
  buildPath: string,
  customQuestionsData: CustomQuestionsData
): Promise<string> {
  try {
    console.log(chalk.gray(`   Setting up studio-ui with custom questions...`));

    // Step 1: Copy studio-ui source files
    const studioSourcePath = path.join(__dirname, '..', 'studio-ui-src');
    const { copyDirectory } = await import('../utils/template.js');
    await copyDirectory(studioSourcePath, buildPath);

    // Step 2: Transform workspace dependencies to published versions
    console.log(chalk.gray(`   Transforming workspace dependencies...`));
    const studioPackageJsonPath = path.join(buildPath, 'package.json');
    await transformPackageJsonForStudioBuild(studioPackageJsonPath);

    // Step 2.5: Fix Vite config to use npm packages instead of monorepo paths
    console.log(chalk.gray(`   Updating Vite configuration for standalone build...`));
    await fixViteConfigForStandaloneBuild(buildPath);

    // Step 3: Install custom questions package
    console.log(
      chalk.cyan(
        `   Installing bundled course package: ${customQuestionsData.packageName} from ${customQuestionsData.coursePath}`
      )
    );

    const distLibPath = path.join(customQuestionsData.coursePath, 'dist-lib');
    if (!fs.existsSync(distLibPath)) {
      throw new Error(
        `dist-lib directory not found at: ${distLibPath}. Run 'npm run build:lib' first.`
      );
    }

    // Ensure node_modules directory exists in studio-ui
    const nodeModulesPath = path.join(buildPath, 'node_modules');
    const packageInstallPath = path.join(nodeModulesPath, customQuestionsData.packageName);

    if (!fs.existsSync(nodeModulesPath)) {
      fs.mkdirSync(nodeModulesPath, { recursive: true });
    }

    if (!fs.existsSync(packageInstallPath)) {
      fs.mkdirSync(packageInstallPath, { recursive: true });
    }

    // Copy dist-lib contents to node_modules/{packageName}
    console.log(
      chalk.gray(`   Copying dist-lib to node_modules/${customQuestionsData.packageName}...`)
    );
    await copyDirectory(distLibPath, packageInstallPath);

    // Copy package.json for proper npm module structure
    const originalPackageJsonPath = path.join(customQuestionsData.coursePath, 'package.json');
    const targetPackageJsonPath = path.join(packageInstallPath, 'package.json');

    if (fs.existsSync(originalPackageJsonPath)) {
      fs.copyFileSync(originalPackageJsonPath, targetPackageJsonPath);
    }

    console.log(chalk.green(`   ✅ Bundled package installed successfully`));

    // Step 4: Create runtime configuration for custom questions
    const runtimeConfigPath = path.join(buildPath, 'custom-questions-config.json');
    const runtimeConfig = {
      hasCustomQuestions: true,
      questionsHash: customQuestionsData.questionsHash,
      packageName: customQuestionsData.packageName,
      importPath: './questions.mjs',
    };

    fs.writeFileSync(runtimeConfigPath, JSON.stringify(runtimeConfig, null, 2));
    console.log(
      chalk.gray(
        `   ✅ Custom questions configuration written for package: ${customQuestionsData.packageName}`
      )
    );

    // Step 5: Run Vite build process
    console.log(chalk.gray(`   Running Vite build process...`));
    await runViteBuild(buildPath);

    // Step 6: Copy config file and questions module to built dist directory
    const distPath = path.join(buildPath, 'dist');
    const sourceConfigPath = path.join(buildPath, 'custom-questions-config.json');
    const distConfigPath = path.join(distPath, 'custom-questions-config.json');

    if (fs.existsSync(sourceConfigPath)) {
      fs.copyFileSync(sourceConfigPath, distConfigPath);
      console.log(chalk.gray(`   Custom questions config copied to dist directory`));
    }

    // Copy the built questions.mjs file to dist/assets for proper serving
    const nodeModulesQuestionsPath = path.join(
      buildPath,
      'node_modules',
      customQuestionsData.packageName,
      'questions.mjs'
    );
    const distAssetsPath = path.join(distPath, 'assets');
    const distQuestionsPath = path.join(distAssetsPath, 'questions.mjs');

    if (fs.existsSync(nodeModulesQuestionsPath)) {
      // Ensure assets directory exists
      if (!fs.existsSync(distAssetsPath)) {
        fs.mkdirSync(distAssetsPath, { recursive: true });
      }
      fs.copyFileSync(nodeModulesQuestionsPath, distQuestionsPath);
      console.log(chalk.gray(`   Built questions.mjs copied to dist/assets directory`));
    } else {
      console.log(
        chalk.yellow(`   Warning: questions.mjs not found at ${nodeModulesQuestionsPath}`)
      );
    }

    // Step 7: Verify build output exists
    const indexPath = path.join(distPath, 'index.html');
    if (!fs.existsSync(indexPath)) {
      throw new Error(`Build output missing: ${indexPath}`);
    }

    console.log(chalk.gray(`   Studio-ui with custom questions built successfully`));

    return buildPath;
  } catch (error) {
    const integrationError = createStudioBuildError(
      StudioBuildErrorType.BUILD_FAILURE,
      'Failed to integrate custom questions into studio-ui via npm install',
      {
        cause: error instanceof Error ? error : undefined,
        context: { buildPath, customQuestionsData },
        recoverable: true,
        fallbackAvailable: true,
      }
    );
    reportStudioBuildError(integrationError);

    // Fallback to default studio-ui
    console.log(chalk.red(`   Exiting`));
    process.exit(1);
    return await buildDefaultStudioUI(buildPath);
  }
}

/**
 * Transform package.json to replace workspace and file dependencies with published versions
 */
async function transformPackageJsonForStudioBuild(packageJsonPath: string): Promise<void> {
  const content = fs.readFileSync(packageJsonPath, 'utf-8');
  const packageJson = JSON.parse(content);

  // Version mappings for vue-skuilder packages
  const vueSkuilderPackageVersions: Record<string, string> = {
    '@vue-skuilder/common': VERSION,
    '@vue-skuilder/common-ui': VERSION,
    '@vue-skuilder/courseware': VERSION,
    '@vue-skuilder/db': VERSION,
    '@vue-skuilder/edit-ui': VERSION,
    '@vue-skuilder/express': VERSION,
    '@vue-skuilder/cli': VERSION,
  };

  // Transform dependencies
  if (packageJson.dependencies) {
    for (const [depName, version] of Object.entries(packageJson.dependencies)) {
      if (
        typeof version === 'string' &&
        (version.startsWith('workspace:') || version.startsWith('file:'))
      ) {
        const publishedVersion = vueSkuilderPackageVersions[depName];
        if (publishedVersion) {
          packageJson.dependencies[depName] = `^${publishedVersion}`;
          console.log(chalk.gray(`     Transformed ${depName}: ${version} → ^${publishedVersion}`));
        }
      }
    }
  }

  // Transform devDependencies
  if (packageJson.devDependencies) {
    for (const [depName, version] of Object.entries(packageJson.devDependencies)) {
      if (
        typeof version === 'string' &&
        (version.startsWith('workspace:') || version.startsWith('file:'))
      ) {
        const publishedVersion = vueSkuilderPackageVersions[depName];
        if (publishedVersion) {
          packageJson.devDependencies[depName] = `^${publishedVersion}`;
          console.log(chalk.gray(`     Transformed ${depName}: ${version} → ^${publishedVersion}`));
        }
      }
    }
  }

  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
}

/**
 * Run Vite build process in the specified directory
 */
async function runViteBuild(buildPath: string): Promise<void> {
  const { spawn } = await import('child_process');

  return new Promise((resolve, reject) => {
    const buildProcess = spawn('npm', ['run', 'build'], {
      cwd: buildPath,
      stdio: 'pipe',
    });

    let buildOutput = '';
    let buildError = '';

    buildProcess.stdout?.on('data', (data) => {
      buildOutput += data.toString();
    });

    buildProcess.stderr?.on('data', (data) => {
      buildError += data.toString();
    });

    buildProcess.on('close', (code) => {
      if (code === 0) {
        console.log(chalk.gray(`   Vite build completed successfully`));
        resolve();
      } else {
        console.log(chalk.yellow(`   Vite build failed with exit code ${code}`));
        console.log(chalk.yellow(`   Build stdout: ${buildOutput}`));
        console.log(chalk.yellow(`   Build stderr: ${buildError}`));
        reject(new Error(`Vite build failed with exit code ${code}: ${buildError}`));
      }
    });

    buildProcess.on('error', (error) => {
      reject(new Error(`Failed to start Vite build process: ${error.message}`));
    });
  });
}

/**
 * Fix Vite configuration to work in standalone build environment
 */
async function fixViteConfigForStandaloneBuild(buildPath: string): Promise<void> {
  const viteConfigPath = path.join(buildPath, 'vite.config.ts');

  if (!fs.existsSync(viteConfigPath)) {
    console.log(chalk.yellow(`   Warning: vite.config.ts not found at ${viteConfigPath}`));
    return;
  }

  // Create a simplified vite config that uses standard npm resolution
  // For custom questions builds, we need Vue bundled in the questions.mjs
  const standaloneViteConfig = `import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 7173,
    host: '0.0.0.0'
  },
  build: {
    target: 'es2020',
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      // Don't externalize Vue for custom questions - bundle it in
      external: [],
      output: {
        manualChunks: {
          vue: ['vue', 'vue-router', 'pinia'],
          vuetify: ['vuetify']
        }
      }
    }
  }
});`;

  fs.writeFileSync(viteConfigPath, standaloneViteConfig);
  console.log(chalk.gray(`   Vite config replaced with standalone version`));
}

/**
 * Determine the correct MCP server executable path/command based on project context
 */
function resolveMCPExecutable(projectPath: string): {
  command: string;
  args: string[];
  isNpx: boolean;
} {
  // Check if we're in the monorepo (packages/cli exists)
  const monorepoCliPath = path.join(projectPath, 'packages', 'cli', 'dist', 'mcp-server.js');
  if (fs.existsSync(monorepoCliPath)) {
    return {
      command: './packages/cli/dist/mcp-server.js',
      args: [],
      isNpx: false,
    };
  }

  // Check if @vue-skuilder/cli is installed as a dependency
  const scaffoldedCliPath = path.join(projectPath, 'node_modules', '@vue-skuilder', 'cli', 'dist', 'mcp-server.js');
  if (fs.existsSync(scaffoldedCliPath)) {
    return {
      command: './node_modules/@vue-skuilder/cli/dist/mcp-server.js',
      args: [],
      isNpx: false,
    };
  }

  // Fallback to npx approach
  return {
    command: 'npx',
    args: ['@vue-skuilder/cli', 'mcp-server'],
    isNpx: true,
  };
}

/**
 * Generate MCP connection information for studio session
 */
function getMCPConnectionInfo(
  unpackResult: UnpackResult,
  couchDBManager: CouchDBManager,
  projectPath: string
): { command: string; env: Record<string, string> } {
  const couchDetails = couchDBManager.getConnectionDetails();
  const executable = resolveMCPExecutable(projectPath);
  
  // Build command string for display
  let commandStr: string;
  if (executable.isNpx) {
    commandStr = `${executable.command} ${executable.args.join(' ')} ${unpackResult.databaseName} ${couchDetails.port}`;
  } else {
    commandStr = `node ${executable.command} ${unpackResult.databaseName} ${couchDetails.port}`;
  }

  return {
    command: commandStr,
    env: {
      COUCHDB_SERVER_URL: couchDetails.url.replace(/^https?:\/\//, ''),
      COUCHDB_SERVER_PROTOCOL: couchDetails.url.startsWith('https') ? 'https' : 'http',
      COUCHDB_USERNAME: couchDetails.username,
      COUCHDB_PASSWORD: couchDetails.password,
    },
  };
}

/**
 * Generate .mcp.json content for Claude Code integration
 */
function generateMCPJson(
  unpackResult: UnpackResult,
  couchDBManager: CouchDBManager,
  projectPath: string,
  serverName: string = 'vue-skuilder-studio'
): string {
  const couchDetails = couchDBManager.getConnectionDetails();
  const port = couchDetails.port || 5985;
  const executable = resolveMCPExecutable(projectPath);
  
  const mcpConfig = {
    mcpServers: {
      [serverName]: {
        command: executable.command,
        args: [...executable.args, unpackResult.databaseName, port.toString()],
        env: {
          COUCHDB_SERVER_URL: couchDetails.url.replace(/^https?:\/\//, ''),
          COUCHDB_SERVER_PROTOCOL: couchDetails.url.startsWith('https') ? 'https' : 'http',
          COUCHDB_USERNAME: couchDetails.username,
          COUCHDB_PASSWORD: couchDetails.password,
        },
      },
    },
  };

  return JSON.stringify(mcpConfig, null, 2);
}
