#!/usr/bin/env node

const { execSync } = require('child_process');

// Docker container name
const CONTAINER_NAME = 'skuilder-test-couch';

console.log('Running container cleanup test...');

try {
  // Check if the container exists
  const containerExists = execSync(`docker ps -a -q -f name=^${CONTAINER_NAME}$`, { stdio: 'pipe' }).toString().trim();
  
  if (containerExists) {
    console.log(`Found existing container '${CONTAINER_NAME}'. Cleaning up...`);
    
    try {
      // Check if container is running
      const isRunning = execSync(`docker ps -q -f name=^${CONTAINER_NAME}$`, { stdio: 'pipe' }).toString().trim();
      if (isRunning) {
        console.log('Container is running. Stopping it...');
        execSync(`docker stop ${CONTAINER_NAME}`, { stdio: 'pipe' });
        console.log('Container stopped successfully.');
      } else {
        console.log('Container is not running.');
      }
      
      // Remove the container
      console.log('Removing container...');
      execSync(`docker rm ${CONTAINER_NAME}`, { stdio: 'pipe' });
      console.log('Container removed successfully.');
      
    } catch (error) {
      console.error('Error during cleanup:', error.message);
      process.exit(1);
    }
  } else {
    console.log(`No container named '${CONTAINER_NAME}' found. Nothing to clean up.`);
  }
  
  console.log('Cleanup test completed successfully.');
  
} catch (error) {
  console.error('Error checking container status:', error.message);
  process.exit(1);
}