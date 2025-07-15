import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import type { CourseDBInterface } from '@vue-skuilder/db';
import { handleCourseConfigResource, RESOURCE_PATTERNS } from './resources/index.js';
import { handleCreateCard, TOOL_PATTERNS } from './tools/index.js';
import { type CreateCardInput } from './types/tools.js';
import { z } from 'zod';

export interface MCPServerOptions {
  enableSourceLinking?: boolean;
  maxCardsPerQuery?: number;
  allowedDataShapes?: string[];
  eloCalibrationMode?: 'strict' | 'adaptive' | 'manual';
}

export class MCPServer {
  private mcpServer: McpServer;
  private transport?: Transport;

  constructor(
    private courseDB: CourseDBInterface,
    private readonly options: MCPServerOptions = {}
  ) {
    this.mcpServer = new McpServer({
      name: 'vue-skuilder-mcp',
      version: '0.1.0',
    });

    this.setupCapabilities();
  }

  private setupCapabilities(): void {
    // Register course://config resource
    this.mcpServer.registerResource(
      'course-config',
      RESOURCE_PATTERNS.COURSE_CONFIG,
      {
        title: 'Course Configuration',
        description: 'Course configuration with metadata and ELO statistics',
        mimeType: 'application/json'
      },
      async (uri) => {
        const result = await handleCourseConfigResource(this.courseDB);
        return {
          contents: [{
            uri: uri.href,
            text: JSON.stringify(result, null, 2),
            mimeType: 'application/json'
          }]
        };
      }
    );

    // Register create_card tool
    this.mcpServer.registerTool(
      TOOL_PATTERNS.CREATE_CARD,
      {
        title: 'Create Card',
        description: 'Create a new course card with specified datashape and content',
        inputSchema: {
          datashape: z.string(),
          data: z.any(),
          tags: z.array(z.string()).optional(),
          elo: z.number().optional(),
          sourceRef: z.string().optional()
        }
      },
      async (input) => {
        const result = await handleCreateCard(this.courseDB, input as CreateCardInput);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }]
        };
      }
    );

    // Use options to configure server capabilities
    if (this.options.enableSourceLinking) {
      // Will configure source linking when implemented
    }
    
    // Configuration ready for Phase 2 implementation
  }

  async start(transport: Transport): Promise<void> {
    this.transport = transport;
    await this.mcpServer.connect(transport);
  }

  async stop(): Promise<void> {
    if (this.transport) {
      await this.transport.close();
    }
    await this.mcpServer.close();
  }

  // Getter for accessing the underlying MCP server (for testing)
  get server(): McpServer {
    return this.mcpServer;
  }

  // Getter for accessing the course database
  get courseDatabase(): CourseDBInterface {
    return this.courseDB;
  }
}