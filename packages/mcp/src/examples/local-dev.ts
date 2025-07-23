#!/usr/bin/env node

import { initializeDataLayer, getDataLayer } from '@vue-skuilder/db';
import { MCPServer } from '../server.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

// Hardcoded test course ID - Go Programming Language
const TEST_COURSE_ID = '2aeb8315ef78f3e89ca386992d00825b';

async function main() {
  try {
    console.error('Starting local-dev example Vue-Skuilder MCP Server...');
    console.error(`Using test course: ${TEST_COURSE_ID}`);

    // Initialize data layer and get course DB
    await initializeDataLayer({
      options: {
        COUCHDB_PASSWORD: 'password',
        COUCHDB_USERNAME: 'admin',
        COUCHDB_SERVER_PROTOCOL: 'http',
        COUCHDB_SERVER_URL: 'localhost:5984',
      },
      type: 'couch',
    });

    const dataLayer = getDataLayer();
    await dataLayer.initialize();

    const courseDB = dataLayer.getCourseDB(TEST_COURSE_ID);

    // Create and start MCP server
    const server = new MCPServer(courseDB, {
      enableSourceLinking: true,
      maxCardsPerQuery: 50,
    });

    const transport = new StdioServerTransport();
    await server.start(transport);

    console.error('MCP Server started successfully!');
    console.error('Resources available: course://config');
    console.error('Tools available: create_card');
  } catch (error) {
    console.error('Failed to start MCP server:', error);
    process.exit(1);
  }
}

main().catch(console.error);
