import { execSync } from 'child_process';
import { EventEmitter } from 'events';

export interface CouchDBConfig {
  mode: 'blank' | 'test-data' | 'custom';
  port: number;
  containerName?: string;
  image?: string;
  username?: string;
  password?: string;
  dataVolume?: string;
  configFile?: string;
  maxStartupWaitMs?: number;
}

export interface CouchDBManagerOptions {
  onLog?: (message: string) => void;
  onError?: (error: string) => void;
}

export class CouchDBManager extends EventEmitter {
  private config: Required<CouchDBConfig>;
  private options: CouchDBManagerOptions;
  private isStarting = false;

  constructor(config: CouchDBConfig, options: CouchDBManagerOptions = {}) {
    super();
    
    // Set defaults
    this.config = {
      mode: config.mode,
      port: config.port,
      containerName: config.containerName || `skuilder-couch-${config.port}`,
      image: config.image || 'couchdb:3.4.3',
      username: config.username || 'admin',
      password: config.password || 'password',
      dataVolume: config.dataVolume || '',
      configFile: config.configFile || '',
      maxStartupWaitMs: config.maxStartupWaitMs || 30000,
    };

    this.options = {
      onLog: options.onLog || (() => {}),
      onError: options.onError || (() => {}),
    };
  }

  private log(message: string): void {
    this.options.onLog!(message);
  }

  private error(message: string): void {
    this.options.onError!(message);
  }

  /**
   * Check if Docker is available
   */
  async checkDockerAvailable(): Promise<boolean> {
    try {
      execSync('docker --version', { stdio: 'pipe' });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if container exists
   */
  private async containerExists(): Promise<boolean> {
    try {
      const result = execSync(
        `docker ps -a -q -f name=^${this.config.containerName}$`,
        { stdio: 'pipe' }
      ).toString().trim();
      return result.length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Check if container is running
   */
  private async isContainerRunning(): Promise<boolean> {
    try {
      const result = execSync(
        `docker ps -q -f name=^${this.config.containerName}$`,
        { stdio: 'pipe' }
      ).toString().trim();
      return result.length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Stop and remove existing container
   */
  private async cleanupExistingContainer(): Promise<void> {
    if (await this.containerExists()) {
      this.log(`Found existing container '${this.config.containerName}'. Cleaning up...`);
      
      try {
        if (await this.isContainerRunning()) {
          this.log('Stopping container...');
          execSync(`docker stop ${this.config.containerName}`, { stdio: 'pipe' });
          this.log('Container stopped.');
        }
        
        this.log('Removing container...');
        execSync(`docker rm ${this.config.containerName}`, { stdio: 'pipe' });
        this.log('Container removed.');
      } catch (error: unknown) {
        this.error(`Error during cleanup: ${error instanceof Error ? error.message : String(error)}`);
        throw error;
      }
    }
  }

  /**
   * Build Docker run command based on configuration
   */
  private buildDockerCommand(): string[] {
    const cmd = [
      'run', '-d',
      '--name', this.config.containerName,
      '-p', `${this.config.port}:5984`,
      '-e', `COUCHDB_USER=${this.config.username}`,
      '-e', `COUCHDB_PASSWORD=${this.config.password}`,
    ];

    // Add volume mounts based on mode
    switch (this.config.mode) {
      case 'test-data':
        if (this.config.dataVolume) {
          cmd.push('-v', `${this.config.dataVolume}:/opt/couchdb/data`);
        }
        if (this.config.configFile) {
          cmd.push('-v', `${this.config.configFile}:/opt/couchdb/etc/local.ini`);
        }
        break;
      case 'custom':
        if (this.config.dataVolume) {
          cmd.push('-v', `${this.config.dataVolume}:/opt/couchdb/data`);
        }
        if (this.config.configFile) {
          cmd.push('-v', `${this.config.configFile}:/opt/couchdb/etc/local.ini`);
        }
        break;
      case 'blank':
        // No volume mounts for blank mode - clean slate
        break;
    }

    cmd.push(this.config.image);
    return cmd;
  }

  /**
   * Wait for CouchDB to be ready with admin credentials working
   */
  private async waitForReady(): Promise<void> {
    const maxAttempts = Math.floor(this.config.maxStartupWaitMs / 1000);
    let attempts = 0;

    return new Promise((resolve, reject) => {
      const checkInterval = setInterval(() => {
        attempts++;
        try {
          // First check basic connectivity
          execSync(`curl -s http://localhost:${this.config.port}/`, { stdio: 'pipe' });
          
          // Then verify admin credentials work by checking _up endpoint
          const auth = `${this.config.username}:${this.config.password}`;
          const result = execSync(`curl -s http://${auth}@localhost:${this.config.port}/_up`, { stdio: 'pipe' }).toString();
          
          // _up endpoint should return {"status":"ok"} when admin is ready
          if (result.includes('"status":"ok"')) {
            clearInterval(checkInterval);
            this.log('CouchDB is ready with admin credentials!');
            resolve();
          } else {
            // CouchDB responds but admin not ready yet
            this.log(`CouchDB responding but admin not ready (attempt ${attempts}/${maxAttempts})`);
            if (attempts >= maxAttempts) {
              clearInterval(checkInterval);
              reject(new Error('CouchDB admin credentials failed to become ready within timeout period'));
            }
          }
        } catch {
          if (attempts >= maxAttempts) {
            clearInterval(checkInterval);
            reject(new Error('CouchDB failed to start within timeout period'));
          }
        }
      }, 1000);
    });
  }

  /**
   * Start CouchDB container
   */
  async start(): Promise<void> {
    if (this.isStarting) {
      throw new Error('CouchDB is already starting');
    }

    this.isStarting = true;

    try {
      // Check Docker availability
      if (!(await this.checkDockerAvailable())) {
        throw new Error('Docker is not available or not running');
      }

      // Clean up any existing container
      await this.cleanupExistingContainer();

      // Build and execute Docker command
      const dockerCmd = this.buildDockerCommand();
      this.log(`Starting CouchDB container: docker ${dockerCmd.join(' ')}`);
      
      execSync(`docker ${dockerCmd.join(' ')}`, { stdio: 'pipe' });
      this.log('Container started successfully');

      // Wait for CouchDB to be ready
      this.log('Waiting for CouchDB to be ready...');
      await this.waitForReady();

      // Configure CORS for browser access
      await this.configureCORS();

      this.emit('ready');
    } catch (error: unknown) {
      this.error(`Failed to start CouchDB: ${error instanceof Error ? error.message : String(error)}`);
      this.emit('error', error);
      throw error;
    } finally {
      this.isStarting = false;
    }
  }

  /**
   * Stop CouchDB container
   */
  async stop(): Promise<void> {
    try {
      if (await this.isContainerRunning()) {
        this.log('Stopping CouchDB container...');
        execSync(`docker stop ${this.config.containerName}`, { stdio: 'pipe' });
        this.log('CouchDB stopped');
        this.emit('stopped');
      } else {
        this.log('CouchDB container is not running');
      }
    } catch (error: unknown) {
      this.error(`Failed to stop CouchDB: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Remove CouchDB container and volumes
   */
  async remove(): Promise<void> {
    try {
      await this.stop();
      
      if (await this.containerExists()) {
        this.log('Removing CouchDB container...');
        execSync(`docker rm ${this.config.containerName}`, { stdio: 'pipe' });
        this.log('CouchDB container removed');
        this.emit('removed');
      }
    } catch (error: unknown) {
      this.error(`Failed to remove CouchDB: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Get container status
   */
  async getStatus(): Promise<'running' | 'stopped' | 'missing'> {
    if (!(await this.containerExists())) {
      return 'missing';
    }
    
    if (await this.isContainerRunning()) {
      return 'running';
    }
    
    return 'stopped';
  }

  /**
   * Get connection URL for this CouchDB instance
   */
  getConnectionUrl(): string {
    return `http://localhost:${this.config.port}`;
  }

  /**
   * Get connection details for applications
   */
  getConnectionDetails() {
    return {
      protocol: 'http',
      host: 'localhost',
      port: this.config.port,
      username: this.config.username,
      password: this.config.password,
      url: this.getConnectionUrl(),
    };
  }

  /**
   * Configure CORS settings for browser access with retry logic
   */
  private async configureCORS(): Promise<void> {
    const maxRetries = 3;
    let attempt = 0;
    
    while (attempt < maxRetries) {
      try {
        attempt++;
        this.log(`Configuring CORS for browser access (attempt ${attempt}/${maxRetries})...`);
        
        const baseUrl = `http://localhost:${this.config.port}`;
        const auth = `${this.config.username}:${this.config.password}`;
        
        // Enable CORS with comprehensive PouchDB-compatible headers
        // Note: CouchDB requires BOTH chttpd/enable_cors AND cors section settings
        const corsCommands = [
          // First: Enable CORS globally in chttpd section (CRITICAL!)
          `curl -X PUT "${baseUrl}/_node/_local/_config/chttpd/enable_cors" -d '"true"' -H "Content-Type: application/json" -u "${auth}"`,
          // Then: Configure CORS settings in cors section
          `curl -X PUT "${baseUrl}/_node/_local/_config/cors/enable" -d '"true"' -H "Content-Type: application/json" -u "${auth}"`,
          `curl -X PUT "${baseUrl}/_node/_local/_config/cors/origins" -d '"*"' -H "Content-Type: application/json" -u "${auth}"`,
          `curl -X PUT "${baseUrl}/_node/_local/_config/cors/methods" -d '"GET,POST,PUT,DELETE,OPTIONS,HEAD"' -H "Content-Type: application/json" -u "${auth}"`,
          `curl -X PUT "${baseUrl}/_node/_local/_config/cors/headers" -d '"accept,authorization,content-type,origin,referer,x-csrf-token,cache-control,if-none-match,x-requested-with,pragma,expires,x-couch-request-id,x-couch-update-newrev"' -H "Content-Type: application/json" -u "${auth}"`,
          `curl -X PUT "${baseUrl}/_node/_local/_config/cors/credentials" -d '"true"' -H "Content-Type: application/json" -u "${auth}"`,
        ];

        for (const cmd of corsCommands) {
          const result = execSync(cmd, { stdio: 'pipe' }).toString().trim();
          
          // Check for CouchDB error responses
          if (result.includes('"error":"unauthorized"')) {
            this.error(`CORS command failed with unauthorized: ${cmd}`);
            this.error(`Response: ${result}`);
            throw new Error(`CORS configuration failed: unauthorized access. Admin credentials may not be ready.`);
          } else if (result.includes('"error":')) {
            this.error(`CORS command failed with error: ${cmd}`);
            this.error(`Response: ${result}`);
            throw new Error(`CORS configuration failed: ${result}`);
          } else {
            this.log(`CORS command success: ${result || 'OK'}`);
          }
        }
        
        // Verify CORS configuration took effect
        try {
          this.log('Verifying CORS configuration...');
          const verifyCmd = `curl -s "${baseUrl}/_node/_local/_config/cors" -u "${auth}"`;
          const corsSettings = execSync(verifyCmd, { stdio: 'pipe' }).toString();
          this.log(`CORS verification result: ${corsSettings.trim()}`);
        } catch (error: unknown) {
          this.log(`Warning: CORS verification failed: ${error instanceof Error ? error.message : String(error)}`);
        }
        
        this.log('CORS configuration completed successfully');
        return; // Success - exit retry loop
        
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        if (attempt < maxRetries && errorMessage.includes('unauthorized')) {
          // Retry with exponential backoff for auth issues
          const delay = Math.pow(2, attempt - 1) * 1000; // 1s, 2s, 4s
          this.log(`CORS configuration failed (attempt ${attempt}/${maxRetries}), retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        } else {
          // Final attempt failed or non-auth error
          this.error(`CORS configuration failed after ${attempt} attempts: ${errorMessage}`);
          // Don't throw - CORS failure shouldn't prevent container startup
          return;
        }
      }
    }
  }
}