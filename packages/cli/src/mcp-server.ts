#!/usr/bin/env node

import { initializeDataLayer, getDataLayer } from '@vue-skuilder/db';
import { MCPServer } from '@vue-skuilder/mcp';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

async function main() {
  try {
    // Get course ID from command line arguments
    const courseId = process.argv[2];
    if (!courseId) {
      console.error('Usage: node mcp-server.js <course-id>');
      console.error('Example: node mcp-server.js 2aeb8315ef78f3e89ca386992d00825b');
      process.exit(1);
    }

    console.error('Starting Vue-Skuilder MCP Server...');
    console.error(`Using course: ${courseId}`);

    // Get CouchDB configuration from environment variables
    const couchdbConfig = {
      type: 'couch' as const,
      options: {
        COUCHDB_SERVER_URL: process.env.COUCHDB_SERVER_URL || 'localhost:5985',
        COUCHDB_SERVER_PROTOCOL: process.env.COUCHDB_SERVER_PROTOCOL || 'http',
        COUCHDB_USERNAME: process.env.COUCHDB_USERNAME || 'admin',
        COUCHDB_PASSWORD: process.env.COUCHDB_PASSWORD || 'password',
      },
    };

    console.error(
      `Connecting to CouchDB at ${couchdbConfig.options.COUCHDB_SERVER_PROTOCOL}://${couchdbConfig.options.COUCHDB_SERVER_URL}`
    );

    // Initialize data layer and get course DB
    await initializeDataLayer(couchdbConfig);

    const dataLayer = getDataLayer();
    await dataLayer.initialize();

    const courseDB = dataLayer.getCourseDB(courseId);

    // Create and start MCP server
    const server = new MCPServer(courseDB, {
      enableSourceLinking: true,
      maxCardsPerQuery: 50,
    });

    const transport = new StdioServerTransport();
    await server.start(transport);

    console.error('MCP Server started successfully!');
    console.error(`Course: ${courseId}`);
    console.error('Available resources: course://config, cards://all, tags://all, shapes://all');
    console.error('Available tools: create_card, update_card, tag_card, delete_card');
    console.error('Available prompts: fill-in-card-authoring, elo-scoring-guidance');
    console.error('Ready for MCP client connections via stdio');
  } catch (error) {
    console.error('Failed to start MCP server:', error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
