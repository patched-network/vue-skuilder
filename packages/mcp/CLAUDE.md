# @vue-skuilder/mcp Package

MCP (Model Context Protocol) server for Vue-Skuilder course content agent access.

## Commands
- Build: `yarn workspace @vue-skuilder/mcp build`
- Dev: `yarn workspace @vue-skuilder/mcp dev` (build + MCP Inspector UI)
- Inspector: `yarn workspace @vue-skuilder/mcp inspector` (MCP Inspector UI)
- Test CLI: `yarn workspace @vue-skuilder/mcp test:cli` (CLI mode)
- Test Resources: `yarn workspace @vue-skuilder/mcp test:resources`
- Test Tools: `yarn workspace @vue-skuilder/mcp test:tools`

## Build System
Uses **tsup** for dual CommonJS/ESM output:
- **ESM**: `dist/index.mjs` (primary)
- **CommonJS**: `dist/index.js` (compatibility)
- **Types**: `dist/index.d.ts`

## Dependencies
- `@modelcontextprotocol/sdk` - MCP protocol implementation
- `@vue-skuilder/db` - Database layer access
- `@vue-skuilder/common` - Shared types and utilities
- `zod` - Schema validation

## Dev Dependencies
- `@modelcontextprotocol/inspector` - MCP server testing and debugging

## Architecture
Course-scoped MCP servers that accept CourseDBInterface injection:
- **Resources**: Read-only data access (course, cards, tags, elo, shapes)
- **Tools**: Content generation and management operations
- **Prompts**: Templates for guided content creation

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