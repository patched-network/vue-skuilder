#!/usr/bin/env node

const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Path to test-couch directory and script
const testCouchDir = path.resolve(__dirname, '..', 'test-couch');
const scriptPath = path.join(testCouchDir, 'test-couch.sh');

// Check if the test-couch directory and script exist
if (!fs.existsSync(testCouchDir) || !fs.existsSync(scriptPath)) {
  console.error('Error: test-couch submodule is missing or incomplete.');
  console.log('\nPlease initialize the test-couch submodule with:');
  console.log('\n  git submodule update --init --recursive');
  console.log('\nOr if you need to clone it:');
  console.log('\n  git clone https://github.com/NiloCK/skuilder-test-db.git test-couch');
  console.log('\nAfter initializing the submodule, try running this command again.\n');
  process.exit(1);
}

// Make sure the script is executable
try {
  execSync(`chmod +x ${scriptPath}`);
} catch (error) {
  console.error('Failed to make script executable:', error);
  process.exit(1);
}

// Get the command from args or default to 'status'
const command = process.argv[2] || 'status';
const validCommands = ['start', 'stop', 'status', 'remove'];

if (!validCommands.includes(command)) {
  console.error(`Invalid command: ${command}`);
  console.log(`Valid commands are: ${validCommands.join(', ')}`);
  process.exit(1);
}

// Docker container name constant
const CONTAINER_NAME = 'skuilder-test-couch';

// Check if Docker is available
try {
  execSync('docker --version', { stdio: 'pipe' });
} catch (error) {
  console.error('Error: Docker is not available or not running.');
  console.error('Please ensure Docker is installed and running before using this script.');
  process.exit(1);
}

// For the 'start' command, always clean up existing container first to avoid conflicts
if (command === 'start') {
  try {
    // Check if the container exists
    const containerExists = execSync(`docker ps -a -q -f name=^${CONTAINER_NAME}$`, { stdio: 'pipe' }).toString().trim();
    
    if (containerExists) {
      console.log(`Found existing container '${CONTAINER_NAME}'. Cleaning up before starting...`);
      
      try {
        // Check if container is running
        const isRunning = execSync(`docker ps -q -f name=^${CONTAINER_NAME}$`, { stdio: 'pipe' }).toString().trim();
        if (isRunning) {
          console.log('Container is running. Stopping it...');
          execSync(`docker stop ${CONTAINER_NAME}`, { stdio: 'pipe' });
          console.log('Container stopped successfully.');
        } else {
          console.log('Container is not running (already stopped).');
        }
      } catch (error) {
        console.error('Error stopping container:', error.message);
        console.log('Attempting to remove anyway...');
      }
      
      try {
        // Remove the container
        console.log('Removing container...');
        execSync(`docker rm ${CONTAINER_NAME}`, { stdio: 'pipe' });
        console.log('Container removed successfully.');
      } catch (error) {
        console.error('Error removing container:', error.message);
        console.error('This may cause issues when starting CouchDB.');
      }
    } else {
      console.log(`No container named '${CONTAINER_NAME}' found. Clean start possible.`);
    }
  } catch (error) {
    console.error('Docker command failed:', error.message);
    console.log('Continuing anyway, but this may cause issues.');
  }
}

// Execute the command
console.log(`Managing CouchDB: ${command}`);
const child = spawn(scriptPath, [command], {
  cwd: testCouchDir,
  stdio: 'inherit',
  env: { ...process.env, CONTAINER_NAME }
});

child.on('error', (error) => {
  console.error(`Failed to execute command: ${error}`);
  process.exit(1);
});

child.on('close', (code) => {
  if (code !== 0) {
    console.error(`Command exited with code ${code}`);
    process.exit(code);
  }

  // For 'start' command, wait for CouchDB to be fully operational
  if (command === 'start') {
    console.log('Waiting for CouchDB to be ready...');

    // Simple polling to check CouchDB availability
    let attempts = 0;
    const maxAttempts = 30;

    const checkInterval = setInterval(() => {
      attempts++;
      try {
        execSync('curl -s http://localhost:5984/', { stdio: 'pipe' });
        clearInterval(checkInterval);
        console.log('CouchDB is now ready!');
      } catch (error) {
        if (attempts >= maxAttempts) {
          clearInterval(checkInterval);
          console.error('CouchDB failed to start properly');
          process.exit(1);
        }
      }
    }, 1000);
  }
});
