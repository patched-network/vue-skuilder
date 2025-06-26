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
      } catch (error: any) {
        this.error(`Error during cleanup: ${error.message}`);
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
   * Wait for CouchDB to be ready
   */
  private async waitForReady(): Promise<void> {
    const maxAttempts = Math.floor(this.config.maxStartupWaitMs / 1000);
    let attempts = 0;

    return new Promise((resolve, reject) => {
      const checkInterval = setInterval(() => {
        attempts++;
        try {
          execSync(`curl -s http://localhost:${this.config.port}/`, { stdio: 'pipe' });
          clearInterval(checkInterval);
          this.log('CouchDB is ready!');
          resolve();
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

      this.emit('ready');
    } catch (error: any) {
      this.error(`Failed to start CouchDB: ${error.message}`);
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
    } catch (error: any) {
      this.error(`Failed to stop CouchDB: ${error.message}`);
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
    } catch (error: any) {
      this.error(`Failed to remove CouchDB: ${error.message}`);
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
}