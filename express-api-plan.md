# Express API Refactoring Plan

## Motivation

The Vue-Skuilder Express server serves as the **primary backend infrastructure** for the full Vue-Skuilder platform. However, the CLI's studio mode needs to reuse the same API endpoints for course editing functionality.

Currently, the CLI embeds the Express server by copying built files and assets, but this approach fails at runtime because the embedded Express server cannot resolve its Node.js dependencies (like `cookie-parser`, `cors`, etc.) through normal module resolution.

The CLI's `yarn studio` command fails with:
```
Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'cookie-parser' imported from .../node_modules/@vue-skuilder/cli/dist/express-assets/app.js
```

This occurs because the embedded Express files expect their dependencies to be available through `node_modules` resolution, but when the CLI is installed via `npx` in an external project, those dependencies aren't available.

**Key Point**: Express's primary role as platform backend infrastructure should remain unchanged. We need to add a secondary programmatic API for CLI studio reuse.

## Requirements

1. **Add Programmatic API**: Add an importable class/module alongside the existing standalone server
2. **Dependency Resolution**: Ensure Express dependencies are properly available when CLI is used
3. **Flexible Configuration**: Support both environment-based config (platform) and runtime config (studio)
4. **Lifecycle Management**: Provide start/stop methods for integration with CLI studio command
5. **Port Management**: Support dynamic port assignment for concurrent studio sessions
6. **Primary Use Case Preservation**: Maintain existing Express standalone functionality for platform usage

## Current Architecture Analysis

### Entry Point (`src/app.ts`)
- **Main Structure**: Classic Express app with immediate execution
- **Port**: Hardcoded to 3000
- **Dependencies**: 11 runtime dependencies including `cookie-parser`, `cors`, `express`, `morgan`, `nano`
- **Initialization**: Two-phase: server startup + async `init()` function
- **Environment**: Relies on `src/utils/env.ts` for configuration via environment variables

### Configuration (`src/utils/env.ts`)
- **Environment Variables**: Requires `COUCHDB_SERVER`, `COUCHDB_PROTOCOL`, `COUCHDB_ADMIN`, `COUCHDB_PASSWORD`, `VERSION`, `NODE_ENV`
- **Data Layer**: Automatically initializes `@vue-skuilder/db` with CouchDB connection
- **Dotenv**: Loads from `.env.development` by default

### Key Dependencies (package.json)
**Runtime (11 deps):**
- `express` - Web framework
- `cookie-parser` - Cookie middleware
- `cors` - CORS middleware
- `morgan` - HTTP logging
- `nano` - CouchDB client
- `@vue-skuilder/common` - Shared types
- `@vue-skuilder/db` - Database layer
- `axios`, `ffmpeg-static`, `fs-extra`, `winston`, etc.

## Proposed Solution

### 1. Add Programmatic API Class

**Keep existing `src/app.ts` as-is** for platform usage, and **add** an exportable `SkuilderExpressServer` class:

```typescript
export class SkuilderExpressServer {
  private app: Express;
  private server: http.Server | null = null;
  private port: number;

  constructor(config: ExpressServerConfig) { ... }

  async start(): Promise<{ port: number; url: string }> { ... }

  async stop(): Promise<void> { ... }

  isRunning(): boolean { ... }
}
```

### 2. Dual Configuration Support

**Add** programmatic configuration interface **alongside** existing environment-based config:

```typescript
export interface ExpressServerConfig {
  port?: number; // Auto-assign if not provided
  couchdb: {
    protocol: string;
    server: string;
    username: string;
    password: string;
  };
  version: string;
  nodeEnv?: string;
  cors?: {
    credentials: boolean;
    origin: boolean | string | string[];
  };
}
```

### 3. CLI Integration

Update CLI's studio command to use the new API:

```typescript
import { SkuilderExpressServer } from '@vue-skuilder/express';

// In studio command
const expressServer = new SkuilderExpressServer({
  couchdb: {
    protocol: 'http',
    server: `localhost:${couchdbPort}`,
    username: 'admin',
    password: 'password'
  },
  version: VERSION,
  nodeEnv: 'studio'
});

const { port, url } = await expressServer.start();
console.log(`Express API running at ${url}`);
```

### 4. Dependency Management

Add Express as a direct dependency in CLI's `package.json`:

```json
{
  "dependencies": {
    "@vue-skuilder/express": "workspace:*",
    // ... other deps
  }
}
```

This ensures all Express dependencies are properly resolved through normal npm dependency tree.

## Entry/Exposure Points

### New Public API (src/index.ts)
```typescript
export { SkuilderExpressServer } from './server.js';
export type { ExpressServerConfig } from './types.js';
export { createExpressApp } from './app.js'; // For advanced users
```

### New Files Added
1. **src/server.ts** - New programmatic server class
2. **src/types.ts** - Configuration interfaces  
3. **src/index.ts** - Main export file for programmatic usage

### Existing Files (Unchanged)
- **src/app.ts** - Primary standalone server (platform usage)
- **src/utils/env.ts** - Environment-based configuration (platform usage)
- All other existing files maintain current functionality

### Dual Usage Support
- **Platform usage**: `yarn dev` or `node dist/app.js` (unchanged)
- **Studio usage**: `import { SkuilderExpressServer } from '@vue-skuilder/express'`

## Build Script Modifications

### Express Package Changes
```json
{
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    },
    "./app": {
      "types": "./dist/app.d.ts",
      "import": "./dist/app.js"
    }
  }
}
```

### CLI Package Changes
Remove embedding scripts:
```json
{
  "scripts": {
    "build": "rm -rf dist && tsc && npm run embed:studio-ui-src && npm run embed:templates && npm run embed:standalone-ui"
  }
}
```

Remove these lines:
- `"build:express": "cd ../express && npm run build"`
- `"embed:express": "mkdir -p dist/express-assets && cp -r ../express/dist/* dist/express-assets/ && cp -r ../express/assets dist/express-assets/"`

### Dependencies Update
CLI package.json additions:
```json
{
  "dependencies": {
    "@vue-skuilder/express": "workspace:*"
  }
}
```

## Implementation Steps

1. **Create programmatic API** - Refactor app.ts into class-based architecture
2. **Add configuration interface** - Replace env vars with config object
3. **Update CLI integration** - Replace ExpressManager with direct API usage
4. **Test in monorepo** - Ensure backwards compatibility
5. **Update build scripts** - Remove embedding, add dependency
6. **Test with npx** - Verify external project usage works
7. **Update documentation** - Document new API and migration path

## Benefits

- **Cleaner Architecture**: Express becomes a proper Node.js module
- **Better Dependency Resolution**: Standard npm dependency tree
- **Reduced Bundle Size**: No more embedded assets in CLI
- **Easier Maintenance**: Single source of truth for Express server
- **Better Testability**: Programmatic API easier to test
- **Flexible Configuration**: Runtime config vs environment vars
