import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import type { CourseDBInterface } from '@vue-skuilder/db';
import type { SkLogger } from '@vue-skuilder/common';
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
  RESOURCE_PATTERNS,
} from './resources/index.js';
import {
  handleCreateCard,
  handleUpdateCard,
  handleTagCard,
  handleDeleteCard,
  TOOL_PATTERNS,
} from './tools/index.js';
import {
  type CreateCardInput,
  type UpdateCardInput,
  type TagCardInput,
  type DeleteCardInput,
} from './types/tools.js';
import { z } from 'zod';
import {
  createFillInCardAuthoringPrompt,
  createEloScoringGuidancePrompt,
  PROMPT_PATTERNS,
} from './prompts/index.js';

export interface MCPServerOptions {
  enableSourceLinking?: boolean;
  maxCardsPerQuery?: number;
  allowedDataShapes?: string[];
  eloCalibrationMode?: 'strict' | 'adaptive' | 'manual';
  logger?: SkLogger;
}

export class MCPServer {
  private mcpServer: McpServer;
  private transport?: Transport;
  private logger: SkLogger;

  constructor(
    private courseDB: CourseDBInterface,
    private readonly options: MCPServerOptions = {}
  ) {
    // Use provided logger or no-op logger as default
    this.logger = options.logger || { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} };
    this.mcpServer = new McpServer({
      name: 'vue-skuilder-mcp',
      version: '0.1.0',
    });

    this.setupCapabilities();
  }

  private setupCapabilities(): void {
    // Register course://config resource
    this.mcpServer.registerResource(
      RESOURCE_PATTERNS.COURSE_CONFIG,
      RESOURCE_PATTERNS.COURSE_CONFIG,
      {
        title: 'Course Configuration',
        description: 'Course configuration with metadata and ELO statistics',
        mimeType: 'application/json',
      },
      async (uri) => {
        this.logger.debug('MCP Server: Accessing course config resource');
        try {
          const result = await handleCourseConfigResource(this.courseDB);
          this.logger.info(`MCP Server: Course config accessed - ${result.config.name}`);
          return {
            contents: [
              {
                uri: uri.href,
                text: JSON.stringify(result, null, 2),
                mimeType: 'application/json',
              },
            ],
          };
        } catch (error) {
          this.logger.error('MCP Server: Failed to access course config', error);
          throw error;
        }
      }
    );

    // Register cards://all resource
    this.mcpServer.registerResource(
      RESOURCE_PATTERNS.CARDS_ALL,
      RESOURCE_PATTERNS.CARDS_ALL,
      {
        title: 'All Course Cards',
        description: 'List all cards in the course with pagination support',
        mimeType: 'application/json',
      },
      async (uri) => {
        const url = new URL(uri.href);
        const limit = parseInt(url.searchParams.get('limit') || '50', 10);
        const offset = parseInt(url.searchParams.get('offset') || '0', 10);

        this.logger.debug(`MCP Server: Fetching cards, limit=${limit}, offset=${offset}`);
        const result = await handleCardsAllResource(this.courseDB, limit, offset);
        this.logger.info(`MCP Server: Retrieved ${result.cards.length} cards`);
        return {
          contents: [
            {
              uri: uri.href,
              text: JSON.stringify(result, null, 2),
              mimeType: 'application/json',
            },
          ],
        };
      }
    );

    // Register cards://tag/{tagName} resource
    this.mcpServer.registerResource(
      RESOURCE_PATTERNS.CARDS_TAG,
      new ResourceTemplate('cards://tag/{tagName}', { list: undefined }),
      {
        title: 'Cards by Tag',
        description: 'Filter cards by tag name with pagination support',
        mimeType: 'application/json',
      },
      async (uri, { tagName }) => {
        const url = new URL(uri.href);
        const limit = parseInt(url.searchParams.get('limit') || '50', 10);
        const offset = parseInt(url.searchParams.get('offset') || '0', 10);

        this.logger.debug(`MCP Server: Fetching cards by tag '${tagName}', limit=${limit}, offset=${offset}`);
        const result = await handleCardsTagResource(
          this.courseDB,
          tagName as string,
          limit,
          offset
        );
        this.logger.info(`MCP Server: Retrieved ${result.cards.length} cards for tag '${tagName}'`);
        return {
          contents: [
            {
              uri: uri.href,
              text: JSON.stringify(result, null, 2),
              mimeType: 'application/json',
            },
          ],
        };
      }
    );

    // Register cards://shape/{shapeName} resource
    this.mcpServer.registerResource(
      RESOURCE_PATTERNS.CARDS_SHAPE,
      new ResourceTemplate('cards://shape/{shapeName}', { list: undefined }),
      {
        title: 'Cards by DataShape',
        description: 'Filter cards by DataShape with pagination support',
        mimeType: 'application/json',
      },
      async (uri, { shapeName }) => {
        const url = new URL(uri.href);
        const limit = parseInt(url.searchParams.get('limit') || '50', 10);
        const offset = parseInt(url.searchParams.get('offset') || '0', 10);

        this.logger.debug(`MCP Server: Fetching cards by shape '${shapeName}', limit=${limit}, offset=${offset}`);
        const result = await handleCardsShapeResource(
          this.courseDB,
          shapeName as string,
          limit,
          offset
        );
        this.logger.info(`MCP Server: Retrieved ${result.cards.length} cards for shape '${shapeName}'`);
        return {
          contents: [
            {
              uri: uri.href,
              text: JSON.stringify(result, null, 2),
              mimeType: 'application/json',
            },
          ],
        };
      }
    );

    // Register cards://elo/{eloRange} resource
    this.mcpServer.registerResource(
      RESOURCE_PATTERNS.CARDS_ELO,
      new ResourceTemplate('cards://elo/{eloRange}', { list: undefined }),
      {
        title: 'Cards by ELO Range',
        description: 'Filter cards by ELO range (format: min-max, e.g., 1200-1800)',
        mimeType: 'application/json',
      },
      async (uri, { eloRange }) => {
        const url = new URL(uri.href);
        const limit = parseInt(url.searchParams.get('limit') || '50', 10);
        const offset = parseInt(url.searchParams.get('offset') || '0', 10);

        this.logger.debug(`MCP Server: Fetching cards by ELO range '${eloRange}', limit=${limit}, offset=${offset}`);
        const result = await handleCardsEloResource(
          this.courseDB,
          eloRange as string,
          limit,
          offset
        );
        this.logger.info(`MCP Server: Retrieved ${result.cards.length} cards for ELO range '${eloRange}'`);
        return {
          contents: [
            {
              uri: uri.href,
              text: JSON.stringify(result, null, 2),
              mimeType: 'application/json',
            },
          ],
        };
      }
    );

    // Register shapes://all resource
    this.mcpServer.registerResource(
      RESOURCE_PATTERNS.SHAPES_ALL,
      RESOURCE_PATTERNS.SHAPES_ALL,
      {
        title: 'All DataShapes',
        description: 'List all available DataShapes in the course',
        mimeType: 'application/json',
      },
      async (uri) => {
        this.logger.debug('MCP Server: Fetching all shapes');
        const result = await handleShapesAllResource(this.courseDB);
        this.logger.info(`MCP Server: Retrieved ${result.shapes.length} shapes`);
        return {
          contents: [
            {
              uri: uri.href,
              text: JSON.stringify(result, null, 2),
              mimeType: 'application/json',
            },
          ],
        };
      }
    );

    // Register shapes://{shapeName} resource
    this.mcpServer.registerResource(
      RESOURCE_PATTERNS.SHAPES_SPECIFIC,
      new ResourceTemplate('shapes://{shapeName}', { list: undefined }),
      {
        title: 'Specific DataShape',
        description: 'Get detailed information about a specific DataShape',
        mimeType: 'application/json',
      },
      async (uri, { shapeName }) => {
        this.logger.debug(`MCP Server: Fetching shape '${shapeName}'`);
        const result = await handleShapeSpecificResource(this.courseDB, shapeName as string);
        this.logger.info(`MCP Server: Retrieved shape '${shapeName}'`);
        return {
          contents: [
            {
              uri: uri.href,
              text: JSON.stringify(result, null, 2),
              mimeType: 'application/json',
            },
          ],
        };
      }
    );

    // Register tags://all resource
    this.mcpServer.registerResource(
      RESOURCE_PATTERNS.TAGS_ALL,
      RESOURCE_PATTERNS.TAGS_ALL,
      {
        title: 'All Tags',
        description: 'List all available tags in the course',
        mimeType: 'application/json',
      },
      async (uri) => {
        this.logger.debug('MCP Server: Fetching all tags');
        const result = await handleTagsAllResource(this.courseDB);
        this.logger.info(`MCP Server: Retrieved ${result.tags.length} tags`);
        return {
          contents: [
            {
              uri: uri.href,
              text: JSON.stringify(result, null, 2),
              mimeType: 'application/json',
            },
          ],
        };
      }
    );

    // Register tags://stats resource
    this.mcpServer.registerResource(
      RESOURCE_PATTERNS.TAGS_STATS,
      RESOURCE_PATTERNS.TAGS_STATS,
      {
        title: 'Tag Statistics',
        description: 'Get usage statistics for tags in the course',
        mimeType: 'application/json',
      },
      async (uri) => {
        this.logger.debug('MCP Server: Fetching tag statistics');
        const result = await handleTagsStatsResource(this.courseDB);
        this.logger.info('MCP Server: Retrieved tag statistics');
        return {
          contents: [
            {
              uri: uri.href,
              text: JSON.stringify(result, null, 2),
              mimeType: 'application/json',
            },
          ],
        };
      }
    );

    // Register tags://{tagName} resource
    this.mcpServer.registerResource(
      RESOURCE_PATTERNS.TAGS_SPECIFIC,
      new ResourceTemplate('tags://{tagName}', { list: undefined }),
      {
        title: 'Specific Tag',
        description: 'Get detailed information about a specific tag',
        mimeType: 'application/json',
      },
      async (uri, { tagName }) => {
        this.logger.debug(`MCP Server: Fetching tag '${tagName}'`);
        const result = await handleTagSpecificResource(this.courseDB, tagName as string);
        this.logger.info(`MCP Server: Retrieved tag '${tagName}' with ${result.cardCount} cards`);
        return {
          contents: [
            {
              uri: uri.href,
              text: JSON.stringify(result, null, 2),
              mimeType: 'application/json',
            },
          ],
        };
      }
    );

    // Register tags://union/{tags} resource
    this.mcpServer.registerResource(
      RESOURCE_PATTERNS.TAGS_UNION,
      new ResourceTemplate('tags://union/{tags}', { list: undefined }),
      {
        title: 'Tags Union',
        description: 'Find cards with ANY of the specified tags (format: tag1+tag2)',
        mimeType: 'application/json',
      },
      async (uri, { tags }) => {
        this.logger.debug(`MCP Server: Fetching union of tags '${tags}'`);
        const result = await handleTagsUnionResource(this.courseDB, tags as string);
        this.logger.info(`MCP Server: Retrieved ${result.cardIds.length} cards for tag union '${tags}'`);
        return {
          contents: [
            {
              uri: uri.href,
              text: JSON.stringify(result, null, 2),
              mimeType: 'application/json',
            },
          ],
        };
      }
    );

    // Register tags://intersect/{tags} resource
    this.mcpServer.registerResource(
      RESOURCE_PATTERNS.TAGS_INTERSECT,
      new ResourceTemplate('tags://intersect/{tags}', { list: undefined }),
      {
        title: 'Tags Intersect',
        description: 'Find cards with ALL of the specified tags (format: tag1+tag2)',
        mimeType: 'application/json',
      },
      async (uri, { tags }) => {
        this.logger.debug(`MCP Server: Fetching intersection of tags '${tags}'`);
        const result = await handleTagsIntersectResource(this.courseDB, tags as string);
        this.logger.info(`MCP Server: Retrieved ${result.cardIds.length} cards for tag intersection '${tags}'`);
        return {
          contents: [
            {
              uri: uri.href,
              text: JSON.stringify(result, null, 2),
              mimeType: 'application/json',
            },
          ],
        };
      }
    );

    // Register tags://exclusive/{tags} resource
    this.mcpServer.registerResource(
      RESOURCE_PATTERNS.TAGS_EXCLUSIVE,
      new ResourceTemplate('tags://exclusive/{tags}', { list: undefined }),
      {
        title: 'Tags Exclusive',
        description: 'Find cards with first tag but NOT second tag (format: tag1-tag2)',
        mimeType: 'application/json',
      },
      async (uri, { tags }) => {
        this.logger.debug(`MCP Server: Fetching exclusive tags '${tags}'`);
        const result = await handleTagsExclusiveResource(this.courseDB, tags as string);
        this.logger.info(`MCP Server: Retrieved ${result.cardIds.length} cards for tag exclusion '${tags}'`);
        return {
          contents: [
            {
              uri: uri.href,
              text: JSON.stringify(result, null, 2),
              mimeType: 'application/json',
            },
          ],
        };
      }
    );

    // Register tags://distribution resource
    this.mcpServer.registerResource(
      RESOURCE_PATTERNS.TAGS_DISTRIBUTION,
      RESOURCE_PATTERNS.TAGS_DISTRIBUTION,
      {
        title: 'Tag Distribution',
        description: 'Get frequency distribution of all tags in the course',
        mimeType: 'application/json',
      },
      async (uri) => {
        this.logger.debug('MCP Server: Fetching tag distribution');
        const result = await handleTagsDistributionResource(this.courseDB);
        this.logger.info(`MCP Server: Retrieved tag distribution with ${result.distribution.length} entries`);
        return {
          contents: [
            {
              uri: uri.href,
              text: JSON.stringify(result, null, 2),
              mimeType: 'application/json',
            },
          ],
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
          sourceRef: z.string().optional(),
        },
      },
      async (input) => {
        const createInput = input as CreateCardInput;
        this.logger.info(`MCP Server: Creating card with datashape '${createInput.datashape}'`);
        const result = await handleCreateCard(this.courseDB, createInput);
        this.logger.info(`MCP Server: Created card ${result.cardId}`);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
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
          sourceRef: z.string().optional(),
        },
      },
      async (input) => {
        const updateInput = input as UpdateCardInput;
        this.logger.info(`MCP Server: Updating card ${updateInput.cardId}`);
        const result = await handleUpdateCard(this.courseDB, updateInput);
        this.logger.info(`MCP Server: Updated card ${updateInput.cardId}`);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
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
          updateELO: z.boolean().optional().default(false),
        },
      },
      async (input) => {
        const tagInput = input as TagCardInput;
        this.logger.info(`MCP Server: ${tagInput.action === 'add' ? 'Adding' : 'Removing'} tags [${tagInput.tags.join(', ')}] ${tagInput.action === 'add' ? 'to' : 'from'} card ${tagInput.cardId}`);
        const result = await handleTagCard(this.courseDB, tagInput);
        this.logger.info(`MCP Server: Tag operation completed for card ${tagInput.cardId}`);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
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
          reason: z.string().optional(),
        },
      },
      async (input) => {
        const deleteInput = input as DeleteCardInput;
        this.logger.warn(`MCP Server: Deleting card ${deleteInput.cardId}${deleteInput.reason ? ` (reason: ${deleteInput.reason})` : ''}`);
        const result = await handleDeleteCard(this.courseDB, deleteInput);
        this.logger.info(`MCP Server: Card ${deleteInput.cardId} deletion completed`);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }
    );

    // Register fill-in-card-authoring prompt
    this.mcpServer.registerPrompt(
      PROMPT_PATTERNS.FILL_IN_CARD_AUTHORING,
      {
        title: 'Author Fill-In Card',
        description:
          'Generate a fill-in-the-blank or multiple-choice card using Vue-Skuilder syntax.',
        argsSchema: {},
      },
      () => ({
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: createFillInCardAuthoringPrompt(),
            },
          },
        ],
      })
    );

    // Register elo-scoring-guidance prompt
    this.mcpServer.registerPrompt(
      PROMPT_PATTERNS.ELO_SCORING_GUIDANCE,
      {
        title: 'ELO Scoring Guidance',
        description: 'Guidance for assigning ELO difficulty ratings to flashcard content.',
        argsSchema: {},
      },
      () => ({
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: createEloScoringGuidancePrompt(),
            },
          },
        ],
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
    this.logger.info('MCP Server: Starting connection...');
    try {
      await this.mcpServer.connect(transport);
      this.logger.info('MCP Server: Connected successfully');
    } catch (error) {
      this.logger.error('MCP Server: Failed to start connection', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    this.logger.info('MCP Server: Stopping connection...');
    try {
      if (this.transport) {
        await this.transport.close();
      }
      await this.mcpServer.close();
      this.logger.info('MCP Server: Stopped successfully');
    } catch (error) {
      this.logger.error('MCP Server: Error during shutdown', error);
      throw error;
    }
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
