# Plan: Create Backend-Only Export for Courseware DataShape Registry

## Problem Summary
The MCP server cannot start due to Node.js ESM failing to import CSS files from Vue components. The issue stems from `packages/mcp/src/tools/create-card.ts` importing `allCourseWare` from `@vue-skuilder/courseware`, which transitively pulls in Vue components and CSS dependencies that Node.js cannot handle.

## Selected Solution: Option 3 - Backend Export in Courseware Package

Create a new backend-only export in the courseware package that provides DataShape registry functionality without Vue dependencies. This maintains centralized metadata while enabling Node.js compatibility.

## Architecture Approach

### Current Problematic Flow
```
MCP Server → @vue-skuilder/courseware → Vue components → CSS files → Node.js ESM Error
```

### New Flow
```
MCP Server → @vue-skuilder/courseware/backend → Pure TypeScript registry → Success
```

## Implementation Strategy

1. **Create pure TypeScript backend module** that extracts DataShape definitions
2. **Add new package export** `./backend` pointing to the backend-only module
3. **Update MCP server** to use the new backend import
4. **Maintain existing frontend functionality** unchanged

## Key Design Principles

- **Zero Breaking Changes**: Frontend functionality remains identical
- **Minimal Code Duplication**: Reuse existing DataShape definitions where possible  
- **Clean Separation**: Backend module has no Vue/DOM dependencies
- **Type Safety**: Full TypeScript support for both frontend and backend usage