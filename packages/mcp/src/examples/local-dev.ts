#!/usr/bin/env node

import { initializeDataLayer, getDataLayer } from '@vue-skuilder/db';
import { MCPServer } from '../server.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { writeFileSync, appendFileSync, existsSync } from 'fs';
import { join } from 'path';

// Hardcoded test course ID - Go Programming Language
const TEST_COURSE_ID = '2aeb8315ef78f3e89ca386992d00825b';

// Debug logger for filesystem logging
const DEBUG_LOG_PATH = join(process.cwd(), 'mcp-dbg.log');

function logDebug(message: string, data?: any): void {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] ${message}${data ? ` | Data: ${JSON.stringify(data, null, 2)}` : ''}\n`;
  
  try {
    if (!existsSync(DEBUG_LOG_PATH)) {
      writeFileSync(DEBUG_LOG_PATH, '');
    }
    appendFileSync(DEBUG_LOG_PATH, logEntry);
    console.error(`[DEBUG-LOG] ${message}`);
  } catch (error) {
    console.error(`[DEBUG-LOG-ERROR] Failed to write to ${DEBUG_LOG_PATH}:`, error);
  }
}

async function main() {
  try {
    logDebug('=== MCP LOCAL-DEV STARTUP INITIATED ===');
    console.error('Starting local-dev example Vue-Skuilder MCP Server...');
    console.error(`Using test course: ${TEST_COURSE_ID}`);
    logDebug('Starting local-dev example', { testCourseId: TEST_COURSE_ID });

    // Initialize data layer and get course DB
    logDebug('Initializing data layer with CouchDB configuration');
    const dbConfig = {
      options: {
        COUCHDB_PASSWORD: 'password',
        COUCHDB_USERNAME: 'admin',
        COUCHDB_SERVER_PROTOCOL: 'http',
        COUCHDB_SERVER_URL: 'localhost:5984',
      },
      type: 'couch' as const,
    };
    logDebug('Data layer config prepared', dbConfig);

    await initializeDataLayer(dbConfig);
    logDebug('Data layer initialization completed');

    const dataLayer = getDataLayer();
    logDebug('Retrieved data layer instance');
    
    await dataLayer.initialize();
    logDebug('Data layer instance initialized');

    const courseDB = dataLayer.getCourseDB(TEST_COURSE_ID);
    logDebug('Retrieved course database instance', { courseId: TEST_COURSE_ID });

    // Create and start MCP server
    logDebug('Creating MCP server with configuration');
    const serverConfig = {
      enableSourceLinking: true,
      maxCardsPerQuery: 50,
    };
    logDebug('MCP server config prepared', serverConfig);

    const server = new MCPServer(courseDB, serverConfig);
    logDebug('MCP server instance created');

    const transport = new StdioServerTransport();
    logDebug('StdioServerTransport created');
    
    logDebug('Starting MCP server connection...');
    await server.start(transport);
    logDebug('MCP server connection established');

    console.error('MCP Server started successfully!');
    console.error('Resources available: course://config');
    console.error('Tools available: create_card');
    logDebug('=== MCP SERVER STARTUP COMPLETED SUCCESSFULLY ===');
  } catch (error) {
    logDebug('=== MCP SERVER STARTUP FAILED ===', { error: error instanceof Error ? { message: error.message, stack: error.stack } : error });
    console.error('Failed to start MCP server:', error);
    process.exit(1);
  }
}

main().catch((error) => {
  logDebug('=== UNHANDLED MAIN FUNCTION ERROR ===', { error: error instanceof Error ? { message: error.message, stack: error.stack } : error });
  console.error(error);
});
