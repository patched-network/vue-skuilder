// MCP Server for Vue-Skuilder courses
// This file is bundled into a self-contained executable

import { initializeDataLayer, getDataLayer, initializeTuiLogging } from '@vue-skuilder/db';
import { MCPServer } from '@vue-skuilder/mcp';
import { createFileLogger } from '@vue-skuilder/common';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import * as path from 'path';
import * as os from 'os';

initializeTuiLogging();

async function main() {
  try {
    // Get course ID from command line arguments
    const courseId = process.argv[2];
    if (!courseId) {
      console.error('Usage: node mcp-server.js <course-id>');
      console.error('Example: node mcp-server.js 2aeb8315ef78f3e89ca386992d00825b');
      process.exit(1);
    }
    const port = process.argv[3] ? parseInt(process.argv[3], 10) : 5984;

    console.error('Starting Vue-Skuilder MCP Server...');
    console.error(`Using course: ${courseId}`);

    // Get CouchDB configuration from environment variables
    // MCP server runs in a headless Node.js environment, so we skip user DB initialization
    const couchdbConfig = {
      type: 'couch' as const,
      options: {
        COUCHDB_SERVER_URL: process.env.COUCHDB_SERVER_URL || `localhost:${port}`,
        COUCHDB_SERVER_PROTOCOL: process.env.COUCHDB_SERVER_PROTOCOL || 'http',
        COUCHDB_USERNAME: 'admin',
        COUCHDB_PASSWORD: 'password',
        COURSE_IDS: [courseId], // Limit to specific course
        localStoragePrefix: 'mcp-server',
      },
    };

    console.error(
      `Connecting to CouchDB at ${couchdbConfig.options.COUCHDB_SERVER_PROTOCOL}://${couchdbConfig.options.COUCHDB_SERVER_URL}`
    );

    // Initialize data layer and get course DB
    await initializeDataLayer(couchdbConfig);
    const courseDB = getDataLayer().getCourseDB(courseId);

    // Create file logger for debugging
    const logFilePath = path.join(os.tmpdir(), 'vue-skuilder-mcp-debug.log');
    const fileLogger = createFileLogger(logFilePath);
    console.error(`MCP Server: Debug logs will be written to ${logFilePath}`);

    // Create and start MCP server with file logger
    const server = new MCPServer(courseDB, {
      enableSourceLinking: true,
      maxCardsPerQuery: 50,
      logger: fileLogger,
    });

    const transport = new StdioServerTransport();
    await server.start(transport);

    console.error('MCP Server started successfully!');
    console.error(`Course: ${courseId}`);
    console.error('Available resources: course://config, cards://all, cards://tag/{tagName}, cards://shape/{shapeName}, cards://elo/{eloRange}');
    console.error('                     shapes://all, shapes://{shapeName}, schema://{dataShapeName}');
    console.error('                     tags://all, tags://stats, tags://{tagName}, tags://union/{tags}, tags://intersect/{tags}, tags://exclusive/{tags}, tags://distribution');
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
  // process.exit(1);
});
