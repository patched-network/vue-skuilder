# @vue-skuilder/mcp Package

MCP (Model Context Protocol) server for Vue-Skuilder course content agent access.

## Commands
- Build: `yarn workspace @vue-skuilder/mcp build`
- Dev: `yarn workspace @vue-skuilder/mcp dev` (build + MCP Inspector UI)
- Inspector: `yarn workspace @vue-skuilder/mcp inspector` (MCP Inspector UI)
- Test CLI: `yarn workspace @vue-skuilder/mcp test:cli` (CLI mode)
- Test Resources: `yarn workspace @vue-skuilder/mcp test:resources`
- Test Tools: `yarn workspace @vue-skuilder/mcp test:tools`
- Server: `yarn workspace @vue-skuilder/mcp server` (standalone server mode)

## Build System
Uses **tsup** for dual CommonJS/ESM output:
- **ESM**: `dist/index.mjs` (primary)
- **CommonJS**: `dist/index.js` (compatibility)
- **Types**: `dist/index.d.ts`
- **Target**: ES2022 with TypeScript ~5.7.2
- **Source Maps**: Enabled for debugging
- **Code Splitting**: Disabled for single-file output

## Dependencies
- `@modelcontextprotocol/sdk` - MCP protocol implementation
- `@vue-skuilder/db` - Database layer access
- `@vue-skuilder/common` - Shared types and utilities
- `@vue-skuilder/courseware` - DataShape definitions via `/backend` export
- `zod` - Schema validation

## Dev Dependencies
- `@modelcontextprotocol/inspector` - MCP server testing and debugging
- `tsup` - TypeScript universal packager

## Architecture
Course-scoped MCP servers that accept CourseDBInterface injection:
- **Resources**: Read-only data access (course, cards, tags, elo, shapes)
- **Tools**: Content generation and management operations
- **Prompts**: Templates for guided content creation

### Available Resources (14 total)
- `course://config` - Course configuration with metadata and ELO statistics
- `cards://all` - All cards with pagination support
- `cards://tag/{tagName}` - Filter cards by tag name
- `cards://shape/{shapeName}` - Filter cards by DataShape
- `cards://elo/{eloRange}` - Filter cards by ELO range (format: min-max)
- `shapes://all` - List all available DataShapes
- `shapes://{shapeName}` - Specific DataShape information
- `tags://all` - List all available tags
- `tags://stats` - Tag usage statistics
- `tags://{tagName}` - Specific tag information
- `tags://union/{tags}` - Cards with ANY of specified tags (format: tag1+tag2)
- `tags://intersect/{tags}` - Cards with ALL of specified tags (format: tag1+tag2)
- `tags://exclusive/{tags}` - Cards with first tag but NOT second (format: tag1-tag2)
- `tags://distribution` - Frequency distribution of all tags

### Available Tools (4 total)
- `create_card` - Create new course cards with specified datashape and content
- `update_card` - Update existing course cards (data, tags, ELO, sourceRef)
- `tag_card` - Add or remove tags from course cards with optional ELO update
- `delete_card` - Safely delete course cards with confirmation requirement

### Available Prompts (2 total)
- `fill-in-card-authoring` - Generate fill-in-the-blank or multiple-choice cards using Vue-Skuilder syntax
- `elo-scoring-guidance` - Guidance for assigning ELO difficulty ratings to flashcard content

## Usage
```typescript
import { MCPServer } from '@vue-skuilder/mcp';
import { getDataLayer } from '@vue-skuilder/db';

const courseDB = getDataLayer().getCourseDB('course-id');
const server = new MCPServer(courseDB);
```

## Testing
Use MCP Inspector for interactive testing:
```bash
yarn dev  # Opens Inspector UI automatically
```

## Key Features
- **ELO-aware**: Native support for Vue-Skuilder's dynamic rating system
- **DataShape aware**: Supports all Vue-Skuilder question types
- **Source linking**: Git-based content provenance tracking
- **Content generation**: Orchestrated courseware creation from source materials
- **Strongly typed**: All resources, tools, and prompts use TypeScript constants
- **Barrel exports**: Clean module organization with centralized imports
- **Pagination support**: Efficient handling of large datasets
- **Flexible filtering**: Multiple ways to query and filter content

## Implementation Details

### Strongly Typed Constants
All registrations use TypeScript constants for type safety:
- `RESOURCE_PATTERNS` - URI patterns for all 14 resources
- `TOOL_PATTERNS` - Names for all 4 tools
- `PROMPT_PATTERNS` - Names for all 2 prompts

### Barrel Export Pattern
Organized module structure with index files:
- `src/resources/index.ts` - All resource handlers and patterns
- `src/tools/index.ts` - All tool handlers and patterns
- `src/prompts/index.ts` - All prompt functions and patterns

### Server Configuration
```typescript
export interface MCPServerOptions {
  enableSourceLinking?: boolean;
  maxCardsPerQuery?: number;
  allowedDataShapes?: string[];
  eloCalibrationMode?: 'strict' | 'adaptive' | 'manual';
}
```

### Error Handling
- Graceful handling of missing courses and cards
- Validation using Zod schemas
- Comprehensive error messages for debugging