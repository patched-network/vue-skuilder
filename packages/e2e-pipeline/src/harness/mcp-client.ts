/**
 * MCP Client wrapper for integration testing.
 *
 * Provides a simplified interface for calling MCP tools and reading resources
 * in end-to-end tests.
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

/**
 * Result from creating a card via MCP.
 */
export interface CreateCardResult {
  cardId: string;
  success: boolean;
}

/**
 * Result from creating a strategy via MCP.
 */
export interface CreateStrategyResult {
  strategyId: string;
  success: boolean;
}

/**
 * Parameters for creating a card.
 */
export interface CreateCardParams {
  shape: string;
  data: Record<string, unknown>;
  tags?: string[];
  elo?: { score: number };
  sourceRef?: string;
  [key: string]: unknown;
}

/**
 * Parameters for creating a strategy.
 */
export interface CreateStrategyParams {
  name: string;
  implementingClass: string;
  description: string;
  serializedData?: string;
  learnable?: {
    weight: number;
    confidence: number;
    sampleSize: number;
  };
  [key: string]: unknown;
}

/**
 * Wrapper around MCP Client for testing purposes.
 *
 * Simplifies connecting to an MCP server and calling tools/resources
 * commonly used in e2e-pipeline tests.
 */
export class TestMCPClient {
  private client: Client | null = null;
  private transport: StdioClientTransport | null = null;
  private connected = false;

  /**
   * Connect to an MCP server.
   *
   * @param mcpServerPath - Path to the MCP server entry point
   * @param nodeArgs - Additional arguments for the node process
   */
  async connect(
    mcpServerPath: string,
    nodeArgs: string[] = []
  ): Promise<void> {
    if (this.connected) {
      throw new Error('[TestMCPClient] Already connected. Call disconnect() first.');
    }

    this.transport = new StdioClientTransport({
      command: 'node',
      args: [...nodeArgs, mcpServerPath],
    });

    this.client = new Client({
      name: 'e2e-pipeline-tests',
      version: '0.0.1',
    });

    await this.client.connect(this.transport);
    this.connected = true;
  }

  /**
   * Check if client is connected.
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Create a card via the MCP create_card tool.
   *
   * @param params - Card creation parameters
   * @returns Card ID and success status
   */
  async createCard(params: CreateCardParams): Promise<CreateCardResult> {
    this.ensureConnected();

    const result = await this.client!.callTool({
      name: 'create_card',
      arguments: params,
    });

    const content = result.content as Array<{ type: string; text: string }>;
    const parsed = JSON.parse(content[0].text) as { cardId?: string; error?: string };

    return {
      cardId: parsed.cardId || '',
      success: !!parsed.cardId,
    };
  }

  /**
   * Create a navigation strategy via the MCP create_strategy tool.
   *
   * @param params - Strategy creation parameters
   * @returns Strategy ID and success status
   */
  async createStrategy(params: CreateStrategyParams): Promise<CreateStrategyResult> {
    this.ensureConnected();

    const result = await this.client!.callTool({
      name: 'create_strategy',
      arguments: params,
    });

    const content = result.content as Array<{ type: string; text: string }>;
    const parsed = JSON.parse(content[0].text) as { strategyId?: string; error?: string };

    return {
      strategyId: parsed.strategyId || '',
      success: !!parsed.strategyId,
    };
  }

  /**
   * Update a card via the MCP update_card tool.
   *
   * @param cardId - ID of the card to update
   * @param updates - Fields to update
   * @returns Success status
   */
  async updateCard(
    cardId: string,
    updates: {
      data?: Record<string, unknown>;
      tags?: string[];
      elo?: { score: number };
      sourceRef?: string;
    }
  ): Promise<boolean> {
    this.ensureConnected();

    const result = await this.client!.callTool({
      name: 'update_card',
      arguments: { cardId, ...updates },
    });

    const content = result.content as Array<{ type: string; text: string }>;
    const parsed = JSON.parse(content[0].text) as { success?: boolean };

    return parsed.success ?? false;
  }

  /**
   * Tag a card via the MCP tag_card tool.
   *
   * @param cardId - ID of the card
   * @param addTags - Tags to add
   * @param removeTags - Tags to remove
   * @returns Success status
   */
  async tagCard(
    cardId: string,
    addTags: string[] = [],
    removeTags: string[] = []
  ): Promise<boolean> {
    this.ensureConnected();

    const result = await this.client!.callTool({
      name: 'tag_card',
      arguments: { cardId, addTags, removeTags },
    });

    const content = result.content as Array<{ type: string; text: string }>;
    const parsed = JSON.parse(content[0].text) as { success?: boolean };

    return parsed.success ?? false;
  }

  /**
   * Read an MCP resource.
   *
   * @param uri - Resource URI (e.g., 'strategies://all', 'cards://all')
   * @returns Parsed resource content
   */
  async readResource<T = unknown>(uri: string): Promise<T> {
    this.ensureConnected();

    const result = await this.client!.readResource({ uri });
    const content = result.contents[0];

    if ('text' in content && typeof content.text === 'string') {
      return JSON.parse(content.text) as T;
    }

    return content as T;
  }

  /**
   * List all available resources.
   */
  async listResources(): Promise<Array<{ uri: string; name?: string }>> {
    this.ensureConnected();

    const result = await this.client!.listResources();
    return result.resources.map((r) => ({
      uri: r.uri,
      name: r.name,
    }));
  }

  /**
   * List all available tools.
   */
  async listTools(): Promise<Array<{ name: string; description?: string }>> {
    this.ensureConnected();

    const result = await this.client!.listTools();
    return result.tools.map((t) => ({
      name: t.name,
      description: t.description,
    }));
  }

  /**
   * Call a raw tool with arbitrary arguments.
   *
   * @param name - Tool name
   * @param args - Tool arguments
   * @returns Raw tool result
   */
  async callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    this.ensureConnected();

    const result = await this.client!.callTool({
      name,
      arguments: args,
    });

    const content = result.content as Array<{ type: string; text?: string }>;
    if (content[0]?.text) {
      try {
        return JSON.parse(content[0].text);
      } catch {
        return content[0].text;
      }
    }

    return result.content;
  }

  /**
   * Disconnect from the MCP server.
   */
  async disconnect(): Promise<void> {
    if (!this.connected) {
      return;
    }

    try {
      await this.client?.close();
    } finally {
      this.client = null;
      this.transport = null;
      this.connected = false;
    }
  }

  /**
   * Ensure client is connected before making calls.
   */
  private ensureConnected(): void {
    if (!this.connected || !this.client) {
      throw new Error(
        '[TestMCPClient] Not connected. Call connect() first.'
      );
    }
  }
}

/**
 * Create and connect an MCP client for testing.
 *
 * @param mcpServerPath - Path to MCP server entry point
 * @returns Connected TestMCPClient instance
 */
export async function createTestMCPClient(mcpServerPath: string): Promise<TestMCPClient> {
  const client = new TestMCPClient();
  await client.connect(mcpServerPath);
  return client;
}