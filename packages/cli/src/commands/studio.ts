import { Command } from 'commander';
import path from 'path';
import fs from 'fs';
import chalk from 'chalk';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import http from 'http';
import { CouchDBManager } from '@vue-skuilder/common/docker';
import serveStatic from 'serve-static';
import { ExpressManager } from '../utils/ExpressManager.js';
import { hashQuestionsDirectory, studioBuildExists } from '../utils/questions-hash.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export function createStudioCommand(): Command {
  return new Command('studio')
    .description('Launch studio mode: a complete course editing environment with CouchDB, Express API, and web editor')
    .argument('[coursePath]', 'Path to static course directory', '.')
    .option('-p, --port <port>', 'CouchDB port for studio session', '5985')
    .option('--no-browser', 'Skip automatic browser launch')
    .action(launchStudio)
    .addHelpText('after', `
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
    skuilder studio --no-browser       # Don't auto-open browser`);
}

interface StudioOptions {
  port: string;
  browser: boolean;
}

// Global references for cleanup
let couchDBManager: CouchDBManager | null = null;
let expressManager: ExpressManager | null = null;
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
    const questionsHash = await hashQuestionsDirectory(resolvedPath);
    const buildExists = studioBuildExists(resolvedPath, questionsHash);
    
    console.log(chalk.gray(`   Questions hash: ${questionsHash}`));
    console.log(chalk.gray(`   Cached build exists: ${buildExists ? 'Yes' : 'No'}`));

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
    expressManager = await startExpressBackend(couchDBManager.getConnectionDetails(), resolvedPath);

    // Phase 7: Launch studio-ui server
    console.log(chalk.cyan(`🌐 Starting studio-ui server...`));
    console.log(
      chalk.gray(
        `   Debug: Unpack result - Database: "${unpackResult.databaseName}", Course ID: "${unpackResult.courseId}"`
      )
    );
    const studioUIPort = await startStudioUIServer(
      couchDBManager.getConnectionDetails(),
      unpackResult
    );

    console.log(chalk.green(`✅ Studio session ready!`));
    console.log(chalk.white(`🎨 Studio URL: http://localhost:${studioUIPort}`));
    console.log(chalk.gray(`   Database: ${studioDatabaseName} on port ${options.port}`));
    console.log(chalk.gray(`   Express API: ${expressManager.getConnectionDetails().url}`));
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
      packageJson.dependencies['@vue-skuilder/courses'] &&
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
  if (expressManager) {
    try {
      await expressManager.stop();
      console.log(chalk.green(`✅ Express backend stopped`));
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(chalk.red(`Error stopping Express backend: ${errorMessage}`));
    }
    expressManager = null;
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

async function startStudioUIServer(connectionDetails: ConnectionDetails, unpackResult: UnpackResult): Promise<number> {
  const studioSourcePath = path.join(__dirname, '..', 'studio-ui-src');
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
    }
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
async function startExpressBackend(couchDbConnectionDetails: ConnectionDetails, projectPath: string): Promise<ExpressManager> {
  const expressManager = new ExpressManager(
    {
      port: 3001, // Start from 3001 to avoid conflicts
      couchdbUrl: couchDbConnectionDetails.url,
      couchdbUsername: couchDbConnectionDetails.username,
      couchdbPassword: couchDbConnectionDetails.password,
      projectPath: projectPath
    },
    {
      onLog: (message) => console.log(chalk.gray(`   Express: ${message}`)),
      onError: (error) => console.error(chalk.red(`   Express Error: ${error}`))
    }
  );

  try {
    await expressManager.start();
    
    const connectionDetails = expressManager.getConnectionDetails();
    console.log(chalk.green(`✅ Express backend ready`));
    console.log(chalk.gray(`   URL: ${connectionDetails.url}`));
    console.log(chalk.gray(`   Port: ${connectionDetails.port}`));
    
    return expressManager;
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
        cleanupOnError: true
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
      console.error(chalk.red(`❌ Failed to unpack course: ${innerError instanceof Error ? innerError.message : String(innerError)}`));
      throw innerError;
    }
  } catch (error) {
    console.error(chalk.red(`❌ Studio unpack failed: ${error instanceof Error ? error.message : String(error)}`));
    throw error;
  }
}
