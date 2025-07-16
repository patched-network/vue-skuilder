import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import type { CourseDBInterface } from '@vue-skuilder/db';
import { 
  handleCourseConfigResource, 
  handleCardsAllResource,
  handleCardsTagResource,
  handleCardsShapeResource,
  handleCardsEloResource,
  handleShapesAllResource,
  handleShapeSpecificResource,
  handleTagsAllResource,
  handleTagsStatsResource,
  handleTagSpecificResource,
  handleTagsUnionResource,
  handleTagsIntersectResource,
  handleTagsExclusiveResource,
  handleTagsDistributionResource,
  RESOURCE_PATTERNS 
} from './resources/index.js';
import { 
  handleCreateCard, 
  handleUpdateCard,
  handleTagCard,
  handleDeleteCard,
  TOOL_PATTERNS 
} from './tools/index.js';
import { 
  type CreateCardInput,
  type UpdateCardInput,
  type TagCardInput,
  type DeleteCardInput
} from './types/tools.js';
import { z } from 'zod';
import { createFillInCardAuthoringPrompt } from './prompts/fill-in-card-authoring.js';

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

    // Register cards://all resource
    this.mcpServer.registerResource(
      'cards-all',
      RESOURCE_PATTERNS.CARDS_ALL,
      {
        title: 'All Course Cards',
        description: 'List all cards in the course with pagination support',
        mimeType: 'application/json'
      },
      async (uri) => {
        const url = new URL(uri.href);
        const limit = parseInt(url.searchParams.get('limit') || '50', 10);
        const offset = parseInt(url.searchParams.get('offset') || '0', 10);
        
        const result = await handleCardsAllResource(this.courseDB, limit, offset);
        return {
          contents: [{
            uri: uri.href,
            text: JSON.stringify(result, null, 2),
            mimeType: 'application/json'
          }]
        };
      }
    );

    // Register cards://tag/{tagName} resource
    this.mcpServer.registerResource(
      'cards-tag',
      new ResourceTemplate("cards://tag/{tagName}", { list: undefined }),
      {
        title: 'Cards by Tag',
        description: 'Filter cards by tag name with pagination support',
        mimeType: 'application/json'
      },
      async (uri, { tagName }) => {
        const url = new URL(uri.href);
        const limit = parseInt(url.searchParams.get('limit') || '50', 10);
        const offset = parseInt(url.searchParams.get('offset') || '0', 10);
        
        const result = await handleCardsTagResource(this.courseDB, tagName as string, limit, offset);
        return {
          contents: [{
            uri: uri.href,
            text: JSON.stringify(result, null, 2),
            mimeType: 'application/json'
          }]
        };
      }
    );

    // Register cards://shape/{shapeName} resource
    this.mcpServer.registerResource(
      'cards-shape',
      new ResourceTemplate("cards://shape/{shapeName}", { list: undefined }),
      {
        title: 'Cards by DataShape',
        description: 'Filter cards by DataShape with pagination support',
        mimeType: 'application/json'
      },
      async (uri, { shapeName }) => {
        const url = new URL(uri.href);
        const limit = parseInt(url.searchParams.get('limit') || '50', 10);
        const offset = parseInt(url.searchParams.get('offset') || '0', 10);
        
        const result = await handleCardsShapeResource(this.courseDB, shapeName as string, limit, offset);
        return {
          contents: [{
            uri: uri.href,
            text: JSON.stringify(result, null, 2),
            mimeType: 'application/json'
          }]
        };
      }
    );

    // Register cards://elo/{eloRange} resource  
    this.mcpServer.registerResource(
      'cards-elo',
      new ResourceTemplate("cards://elo/{eloRange}", { list: undefined }),
      {
        title: 'Cards by ELO Range',
        description: 'Filter cards by ELO range (format: min-max, e.g., 1200-1800)',
        mimeType: 'application/json'
      },
      async (uri, { eloRange }) => {
        
        const url = new URL(uri.href);
        const limit = parseInt(url.searchParams.get('limit') || '50', 10);
        const offset = parseInt(url.searchParams.get('offset') || '0', 10);
        
        const result = await handleCardsEloResource(this.courseDB, eloRange as string, limit, offset);
        return {
          contents: [{
            uri: uri.href,
            text: JSON.stringify(result, null, 2),
            mimeType: 'application/json'
          }]
        };
      }
    );

    // Register shapes://all resource
    this.mcpServer.registerResource(
      'shapes-all',
      RESOURCE_PATTERNS.SHAPES_ALL,
      {
        title: 'All DataShapes',
        description: 'List all available DataShapes in the course',
        mimeType: 'application/json'
      },
      async (uri) => {
        const result = await handleShapesAllResource(this.courseDB);
        return {
          contents: [{
            uri: uri.href,
            text: JSON.stringify(result, null, 2),
            mimeType: 'application/json'
          }]
        };
      }
    );

    // Register shapes://{shapeName} resource
    this.mcpServer.registerResource(
      'shapes-specific',
      new ResourceTemplate("shapes://{shapeName}", { list: undefined }),
      {
        title: 'Specific DataShape',
        description: 'Get detailed information about a specific DataShape',
        mimeType: 'application/json'
      },
      async (uri, { shapeName }) => {
        
        const result = await handleShapeSpecificResource(this.courseDB, shapeName as string);
        return {
          contents: [{
            uri: uri.href,
            text: JSON.stringify(result, null, 2),
            mimeType: 'application/json'
          }]
        };
      }
    );

    // Register tags://all resource
    this.mcpServer.registerResource(
      'tags-all',
      RESOURCE_PATTERNS.TAGS_ALL,
      {
        title: 'All Tags',
        description: 'List all available tags in the course',
        mimeType: 'application/json'
      },
      async (uri) => {
        const result = await handleTagsAllResource(this.courseDB);
        return {
          contents: [{
            uri: uri.href,
            text: JSON.stringify(result, null, 2),
            mimeType: 'application/json'
          }]
        };
      }
    );

    // Register tags://stats resource
    this.mcpServer.registerResource(
      'tags-stats',
      RESOURCE_PATTERNS.TAGS_STATS,
      {
        title: 'Tag Statistics',
        description: 'Get usage statistics for tags in the course',
        mimeType: 'application/json'
      },
      async (uri) => {
        const result = await handleTagsStatsResource(this.courseDB);
        return {
          contents: [{
            uri: uri.href,
            text: JSON.stringify(result, null, 2),
            mimeType: 'application/json'
          }]
        };
      }
    );

    // Register tags://{tagName} resource
    this.mcpServer.registerResource(
      'tags-specific',
      new ResourceTemplate("tags://{tagName}", { list: undefined }),
      {
        title: 'Specific Tag',
        description: 'Get detailed information about a specific tag',
        mimeType: 'application/json'
      },
      async (uri, { tagName }) => {
        
        const result = await handleTagSpecificResource(this.courseDB, tagName as string);
        return {
          contents: [{
            uri: uri.href,
            text: JSON.stringify(result, null, 2),
            mimeType: 'application/json'
          }]
        };
      }
    );

    // Register tags://union/{tags} resource
    this.mcpServer.registerResource(
      'tags-union',
      new ResourceTemplate("tags://union/{tags}", { list: undefined }),
      {
        title: 'Tags Union',
        description: 'Find cards with ANY of the specified tags (format: tag1+tag2)',
        mimeType: 'application/json'
      },
      async (uri, { tags }) => {
        
        const result = await handleTagsUnionResource(this.courseDB, tags as string);
        return {
          contents: [{
            uri: uri.href,
            text: JSON.stringify(result, null, 2),
            mimeType: 'application/json'
          }]
        };
      }
    );

    // Register tags://intersect/{tags} resource
    this.mcpServer.registerResource(
      'tags-intersect',
      new ResourceTemplate("tags://intersect/{tags}", { list: undefined }),
      {
        title: 'Tags Intersect',
        description: 'Find cards with ALL of the specified tags (format: tag1+tag2)',
        mimeType: 'application/json'
      },
      async (uri, { tags }) => {
        
        const result = await handleTagsIntersectResource(this.courseDB, tags as string);
        return {
          contents: [{
            uri: uri.href,
            text: JSON.stringify(result, null, 2),
            mimeType: 'application/json'
          }]
        };
      }
    );

    // Register tags://exclusive/{tags} resource
    this.mcpServer.registerResource(
      'tags-exclusive',
      new ResourceTemplate("tags://exclusive/{tags}", { list: undefined }),
      {
        title: 'Tags Exclusive',
        description: 'Find cards with first tag but NOT second tag (format: tag1-tag2)',
        mimeType: 'application/json'
      },
      async (uri, { tags }) => {
        
        const result = await handleTagsExclusiveResource(this.courseDB, tags as string);
        return {
          contents: [{
            uri: uri.href,
            text: JSON.stringify(result, null, 2),
            mimeType: 'application/json'
          }]
        };
      }
    );

    // Register tags://distribution resource
    this.mcpServer.registerResource(
      'tags-distribution',
      RESOURCE_PATTERNS.TAGS_DISTRIBUTION,
      {
        title: 'Tag Distribution',
        description: 'Get frequency distribution of all tags in the course',
        mimeType: 'application/json'
      },
      async (uri) => {
        const result = await handleTagsDistributionResource(this.courseDB);
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

    // Register update_card tool
    this.mcpServer.registerTool(
      TOOL_PATTERNS.UPDATE_CARD,
      {
        title: 'Update Card',
        description: 'Update an existing course card (data, tags, ELO, sourceRef)',
        inputSchema: {
          cardId: z.string(),
          data: z.any().optional(),
          tags: z.array(z.string()).optional(),
          elo: z.number().optional(),
          sourceRef: z.string().optional()
        }
      },
      async (input) => {
        const result = await handleUpdateCard(this.courseDB, input as UpdateCardInput);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }]
        };
      }
    );

    // Register tag_card tool
    this.mcpServer.registerTool(
      TOOL_PATTERNS.TAG_CARD,
      {
        title: 'Tag Card',
        description: 'Add or remove tags from a course card with optional ELO update',
        inputSchema: {
          cardId: z.string(),
          action: z.enum(['add', 'remove']),
          tags: z.array(z.string()),
          updateELO: z.boolean().optional().default(false)
        }
      },
      async (input) => {
        const result = await handleTagCard(this.courseDB, input as TagCardInput);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }]
        };
      }
    );

    // Register delete_card tool
    this.mcpServer.registerTool(
      TOOL_PATTERNS.DELETE_CARD,
      {
        title: 'Delete Card',
        description: 'Safely delete a course card with confirmation requirement',
        inputSchema: {
          cardId: z.string(),
          confirm: z.boolean().default(false),
          reason: z.string().optional()
        }
      },
      async (input) => {
        const result = await handleDeleteCard(this.courseDB, input as DeleteCardInput);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }]
        };
      }
    );

    // Register fill-in-card-authoring prompt
    this.mcpServer.registerPrompt(
      'fill-in-card-authoring',
      {
        title: 'Author Fill-In Card',
        description: 'Generate a fill-in-the-blank or multiple-choice card using Vue-Skuilder syntax.',
        argsSchema: {}
      },
      () => ({
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: createFillInCardAuthoringPrompt()
            }
          }
        ]
      })
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