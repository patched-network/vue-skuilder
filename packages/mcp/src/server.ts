import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import type { CourseDBInterface } from '@vue-skuilder/db';

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
    // Basic capabilities - will be expanded in later phases
    // Resources, tools, and prompts will be registered here
    
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