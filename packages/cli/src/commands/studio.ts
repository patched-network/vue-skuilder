import { Command } from 'commander';
import path from 'path';
import fs from 'fs';
import chalk from 'chalk';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import http from 'http';
import { CouchDBManager } from '@vue-skuilder/common/docker';
// TODO: Re-enable once module import issues are resolved
// import { StaticToCouchDBMigrator, validateStaticCourse } from '@vue-skuilder/db';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export function createStudioCommand(): Command {
  return new Command('studio')
    .description('Launch studio mode for editing a static course')
    .argument('[coursePath]', 'Path to static course directory', '.')
    .option('-p, --port <port>', 'CouchDB port for studio session', '5985')
    .option('--no-browser', 'Skip automatic browser launch')
    .action(launchStudio);
}

interface StudioOptions {
  port: string;
  browser: boolean;
}

// Global references for cleanup
let couchDBManager: CouchDBManager | null = null;
let studioUIServer: http.Server | null = null;

async function launchStudio(coursePath: string, options: StudioOptions) {
  try {
    console.log(chalk.cyan(`🎨 Launching Skuilder Studio...`));
    
    // Phase 2: Course Detection & Validation
    const resolvedPath = path.resolve(coursePath);
    console.log(chalk.gray(`📁 Course path: ${resolvedPath}`));
    
    if (!await validateSuiCourse(resolvedPath)) {
      console.error(chalk.red(`❌ Not a valid standalone-ui course directory`));
      console.log(chalk.yellow(`💡 Studio mode requires a vue-skuilder course with:`));
      console.log(chalk.yellow(`   - package.json with @vue-skuilder/* dependencies`));
      console.log(chalk.yellow(`   - static-data/ OR public/static-courses/ directory with course content`));
      process.exit(1);
    }
    
    console.log(chalk.green(`✅ Valid standalone-ui course detected`));
    
    // Phase 1: CouchDB Management
    const studioDatabaseName = generateStudioDatabaseName(resolvedPath);
    console.log(chalk.cyan(`🗄️  Starting studio CouchDB instance: ${studioDatabaseName}`));
    
    couchDBManager = await startStudioCouchDB(studioDatabaseName, parseInt(options.port));
    
    // Phase 4: Populate CouchDB with course data
    console.log(chalk.cyan(`📦 Unpacking course data to studio database...`));
    const unpackResult = await unpackCourseToStudio(resolvedPath, couchDBManager.getConnectionDetails());
    
    // Phase 7: Launch studio-ui server
    console.log(chalk.cyan(`🌐 Starting studio-ui server...`));
    console.log(chalk.gray(`   Debug: Unpack result - Database: "${unpackResult.databaseName}", Course ID: "${unpackResult.courseId}"`));
    const studioUIPort = await startStudioUIServer(couchDBManager.getConnectionDetails(), unpackResult);
    
    console.log(chalk.green(`✅ Studio session ready!`));
    console.log(chalk.white(`🎨 Studio URL: http://localhost:${studioUIPort}`));
    console.log(chalk.gray(`   Database: ${studioDatabaseName} on port ${options.port}`));
    if (options.browser) {
      console.log(chalk.cyan(`🌐 Opening browser...`));
      await openBrowser(`http://localhost:${studioUIPort}`);
    }
    console.log(chalk.gray(`   Press Ctrl+C to stop studio session`));
    
    // Keep process alive and handle cleanup
    process.on('SIGINT', async () => {
      console.log(chalk.cyan(`\n🔄 Stopping studio session...`));
      await stopStudioSession();
      console.log(chalk.green(`✅ Studio session stopped`));
      process.exit(0);
    });
    
    process.on('SIGTERM', async () => {
      console.log(chalk.cyan(`\n🔄 Stopping studio session...`));
      await stopStudioSession();
      process.exit(0);
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
  } catch (error) {
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
  } catch (error: any) {
    console.error(chalk.red(`Failed to start CouchDB: ${error.message}`));
    throw error;
  }
}

/**
 * Stop entire studio session (CouchDB + UI server)
 */
async function stopStudioSession(): Promise<void> {
  // Stop studio-ui server
  if (studioUIServer) {
    try {
      studioUIServer.close();
      console.log(chalk.green(`✅ Studio-UI server stopped`));
    } catch (error: any) {
      console.error(chalk.red(`Error stopping studio-ui server: ${error.message}`));
    }
    studioUIServer = null;
  }
  
  // Stop CouchDB
  if (couchDBManager) {
    try {
      await couchDBManager.remove(); // This stops and removes the container
      console.log(chalk.green(`✅ CouchDB studio instance cleaned up`));
    } catch (error: any) {
      console.error(chalk.red(`Error cleaning up CouchDB: ${error.message}`));
    }
    couchDBManager = null;
  }
}

/**
 * Phase 7: Start studio-ui static file server
 */
async function startStudioUIServer(connectionDetails: any, unpackResult: any): Promise<number> {
  const studioAssetsPath = path.join(__dirname, '..', 'studio-ui-assets');
  
  if (!fs.existsSync(studioAssetsPath)) {
    throw new Error('Studio-UI assets not found. Please rebuild the CLI package.');
  }

  // Find available port starting from 7174
  let port = 7174;
  while (port < 7200) {
    try {
      await new Promise<void>((resolve, reject) => {
        const server = http.createServer((req, res) => {
          let filePath = path.join(studioAssetsPath, req.url === '/' ? 'index.html' : req.url || '');
          
          // Security: prevent directory traversal
          if (!filePath.startsWith(studioAssetsPath)) {
            res.writeHead(403);
            res.end('Forbidden');
            return;
          }

          // Check if file exists
          if (!fs.existsSync(filePath)) {
            // If it's not a file, serve index.html for SPA routing
            filePath = path.join(studioAssetsPath, 'index.html');
          }

          // Determine content type
          const ext = path.extname(filePath);
          const contentType = {
            '.html': 'text/html',
            '.js': 'text/javascript',
            '.css': 'text/css',
            '.woff2': 'font/woff2',
            '.woff': 'font/woff',
            '.ttf': 'font/ttf',
            '.eot': 'application/vnd.ms-fontobject',
          }[ext] || 'application/octet-stream';

          res.writeHead(200, { 'Content-Type': contentType });
          
          // For HTML files, inject CouchDB connection details
          if (ext === '.html') {
            let html = fs.readFileSync(filePath, 'utf8');
            
            // Inject connection details as script tag before </head>
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
                    courseId: '${unpackResult.courseId}'
                  }
                };
              </script>
            `;
            html = html.replace('</head>', connectionScript + '</head>');
            res.end(html);
          } else {
            // Serve static files
            const stream = fs.createReadStream(filePath);
            stream.pipe(res);
          }
        });

        server.listen(port, '127.0.0.1', () => {
          studioUIServer = server;
          resolve();
        });

        server.on('error', (err: any) => {
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
    } catch (error: any) {
      if (error.code === 'EADDRINUSE') {
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
  } catch (error) {
    console.log(chalk.yellow(`⚠️  Could not automatically open browser. Please visit: ${url}`));
  }
}

/**
 * Phase 4: Unpack course data to studio CouchDB
 */
async function unpackCourseToStudio(coursePath: string, connectionDetails: any): Promise<{databaseName: string, courseId: string}> {
  return new Promise((resolve, reject) => {
    // Find the course data directory (static-data OR public/static-courses)
    let courseDataPath = path.join(coursePath, 'static-data');
    if (!fs.existsSync(courseDataPath)) {
      // Try public/static-courses directory
      const publicStaticPath = path.join(coursePath, 'public', 'static-courses');
      if (fs.existsSync(publicStaticPath)) {
        // Find the first course directory inside public/static-courses
        const courses = fs.readdirSync(publicStaticPath, { withFileTypes: true })
          .filter(dirent => dirent.isDirectory())
          .map(dirent => dirent.name);
        
        if (courses.length > 0) {
          courseDataPath = path.join(publicStaticPath, courses[0]);
        } else {
          reject(new Error('No course directories found in public/static-courses/'));
          return;
        }
      } else {
        reject(new Error('No course data found in static-data/ or public/static-courses/'));
        return;
      }
    }

    console.log(chalk.gray(`   Course data path: ${courseDataPath}`));

    // Build the unpack command arguments
    const args = [
      'unpack',
      courseDataPath,
      '--server', connectionDetails.url,
      '--username', connectionDetails.username,
      '--password', connectionDetails.password,
    ];

    console.log(chalk.gray(`   Running: skuilder ${args.join(' ')}`));

    // Spawn the unpack command as a child process
    const unpackProcess = spawn('node', [path.join(__dirname, '..', 'cli.js'), ...args], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: process.cwd(),
    });

    let stdout = '';
    let stderr = '';

    unpackProcess.stdout?.on('data', (data) => {
      const output = data.toString();
      stdout += output;
      // Forward output with indentation
      process.stdout.write(chalk.gray(`   ${output.replace(/\n/g, '\n   ')}`));
    });

    unpackProcess.stderr?.on('data', (data) => {
      const output = data.toString();
      stderr += output;
      // Forward error output with indentation
      process.stderr.write(chalk.gray(`   ${output.replace(/\n/g, '\n   ')}`));
    });

    unpackProcess.on('close', (code) => {
      if (code === 0) {
        console.log(chalk.green(`✅ Course data unpacked successfully`));
        
        // Parse the output to extract database name and course ID
        console.log(chalk.gray(`   Debug: Parsing unpack output...`));
        
        const databaseMatch = stdout.match(/Database: ([\w-_]+)/);
        const courseIdMatch = stdout.match(/Course: .* \(([a-f0-9]+)\)/);
        
        const fullDatabaseName = databaseMatch ? databaseMatch[1] : '';
        const courseId = courseIdMatch ? courseIdMatch[1] : '';
        
        // Extract the course database ID by removing 'coursedb-' prefix
        const databaseName = fullDatabaseName.startsWith('coursedb-') 
          ? fullDatabaseName.substring('coursedb-'.length)
          : fullDatabaseName;
        
        console.log(chalk.gray(`   Debug: Parsed - Full DB: "${fullDatabaseName}", Course DB ID: "${databaseName}", Course ID: "${courseId}"`));
        
        if (!databaseName || !courseId) {
          console.warn(chalk.yellow(`⚠️  Could not parse database name or course ID from unpack output`));
          console.log(chalk.gray(`   Raw stdout length: ${stdout.length} chars`));
        }
        
        resolve({ databaseName, courseId });
      } else {
        console.error(chalk.red(`❌ Failed to unpack course data (exit code: ${code})`));
        reject(new Error(`Unpack failed with code ${code}\nstdout: ${stdout}\nstderr: ${stderr}`));
      }
    });

    unpackProcess.on('error', (error) => {
      console.error(chalk.red(`❌ Failed to start unpack process: ${error.message}`));
      reject(error);
    });
  });
}