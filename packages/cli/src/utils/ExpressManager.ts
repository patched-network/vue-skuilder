import { spawn, ChildProcess } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface ExpressManagerOptions {
  port: number;
  couchdbUrl: string;
  couchdbUsername: string;
  couchdbPassword: string;
}

export interface ExpressManagerCallbacks {
  onLog?: (message: string) => void;
  onError?: (error: string) => void;
}

export class ExpressManager {
  private process: ChildProcess | null = null;
  private readonly options: ExpressManagerOptions;
  private readonly callbacks: ExpressManagerCallbacks;

  constructor(options: ExpressManagerOptions, callbacks: ExpressManagerCallbacks = {}) {
    this.options = options;
    this.callbacks = callbacks;
  }

  async start(): Promise<void> {
    if (this.process) {
      throw new Error('Express server is already running');
    }

    const expressAssetsPath = join(__dirname, '..', 'express-assets');
    
    if (!fs.existsSync(expressAssetsPath)) {
      throw new Error('Express assets not found. Please rebuild the CLI package.');
    }

    const expressMainPath = join(expressAssetsPath, 'app.js');
    
    if (!fs.existsSync(expressMainPath)) {
      throw new Error('Express main file not found at: ' + expressMainPath);
    }

    // Find available port starting from requested port
    const availablePort = await this.findAvailablePort(this.options.port);

    // Get version from package.json
    let version = '0.0.0';
    try {
      const packageJsonPath = join(__dirname, '..', '..', 'package.json');
      const packageJson = require(packageJsonPath);
      version = packageJson.version || '0.0.0';
    } catch (error) {
      // Fallback version if package.json not found
      version = '0.0.0';
    }

    // Set environment variables for express
    const env = {
      ...process.env,
      PORT: availablePort.toString(),
      COUCHDB_SERVER: this.extractServerFromUrl(this.options.couchdbUrl),
      COUCHDB_PROTOCOL: this.extractProtocolFromUrl(this.options.couchdbUrl),
      COUCHDB_ADMIN: this.options.couchdbUsername,
      COUCHDB_PASSWORD: this.options.couchdbPassword,
      VERSION: version,
      NODE_ENV: 'studio'
    };

    return new Promise((resolve, reject) => {
      this.process = spawn('node', [expressMainPath], {
        env,
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: expressAssetsPath
      });

      if (!this.process) {
        reject(new Error('Failed to start Express process'));
        return;
      }

      let started = false;

      // Handle stdout
      this.process.stdout?.on('data', (data: Buffer) => {
        const message = data.toString().trim();
        if (message.includes('listening on port') && !started) {
          started = true;
          this.options.port = availablePort; // Update with actual port
          resolve();
        }
        this.callbacks.onLog?.(message);
      });

      // Handle stderr
      this.process.stderr?.on('data', (data: Buffer) => {
        const error = data.toString().trim();
        this.callbacks.onError?.(error);
      });

      // Handle process exit
      this.process.on('exit', (code) => {
        this.process = null;
        if (code !== 0 && code !== null) {
          this.callbacks.onError?.(`Express process exited with code ${code}`);
        }
      });

      // Handle process errors
      this.process.on('error', (error) => {
        this.process = null;
        if (!started) {
          reject(error);
        } else {
          this.callbacks.onError?.(`Express process error: ${error.message}`);
        }
      });

      // Timeout if server doesn't start within 10 seconds
      setTimeout(() => {
        if (!started) {
          this.stop();
          reject(new Error('Express server failed to start within timeout'));
        }
      }, 10000);
    });
  }

  async stop(): Promise<void> {
    if (!this.process) {
      return;
    }

    return new Promise((resolve) => {
      if (!this.process) {
        resolve();
        return;
      }

      this.process.on('exit', () => {
        this.process = null;
        resolve();
      });

      // Try graceful shutdown first
      this.process.kill('SIGTERM');

      // Force kill after 5 seconds if still running
      setTimeout(() => {
        if (this.process) {
          this.process.kill('SIGKILL');
          this.process = null;
          resolve();
        }
      }, 5000);
    });
  }

  getConnectionDetails() {
    return {
      url: `http://localhost:${this.options.port}`,
      port: this.options.port
    };
  }

  private async findAvailablePort(startPort: number): Promise<number> {
    const net = await import('net');
    
    for (let port = startPort; port < startPort + 100; port++) {
      if (await this.isPortAvailable(port, net)) {
        return port;
      }
    }
    
    throw new Error(`No available port found starting from ${startPort}`);
  }

  private isPortAvailable(port: number, net: any): Promise<boolean> {
    return new Promise((resolve) => {
      const server = net.createServer();
      
      server.listen(port, '127.0.0.1', () => {
        server.close(() => resolve(true));
      });
      
      server.on('error', () => resolve(false));
    });
  }

  private extractServerFromUrl(url: string): string {
    // Extract hostname:port from URL like "http://localhost:5984"
    const match = url.match(/https?:\/\/([^\/]+)/);
    return match ? match[1] : 'localhost:5984';
  }

  private extractProtocolFromUrl(url: string): string {
    // Extract protocol from URL like "http://localhost:5984"
    return url.startsWith('https') ? 'https' : 'http';
  }
}