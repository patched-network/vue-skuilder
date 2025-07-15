# Todo: MCP Package Implementation

## Phase 1: Foundation (MVP)

### 1.1 Package Setup
- [x] Create `packages/mcp/` directory structure
- [x] Setup `package.json` with dependencies (@modelcontextprotocol/sdk, @vue-skuilder/db, @vue-skuilder/common, zod)
- [x] Add `@modelcontextprotocol/inspector` as devDependency for testing
- [x] Add npm scripts for inspector integration:
  - [x] `dev`: Build and run with Inspector UI
  - [x] `inspector`: Launch Inspector UI with built server
  - [x] `test:cli`: Run Inspector in CLI mode
  - [x] `test:resources`: Test resources list via CLI
  - [x] `test:tools`: Test tools list via CLI
- [x] Configure `tsconfig.json` following monorepo patterns
- [x] Setup `tsup` build configuration for dual exports (CommonJS/ESM)
- [x] Create basic `CLAUDE.md` documentation
- [ ] Add package to root workspace and build pipeline

**Notes:** 
- `tsconfig.base.json` is perfect - ES2022 target, strict mode, path aliases included
- Added `@mcp/*` alias for internal imports
- Inspector scripts ready for immediate testing workflow
- **Dependency versions:** MCP SDK v1.15.1, Inspector v0.16.1, Zod v3.22.0
- **Zod v3 decision:** Staying with v3 for stable API (v4 has breaking changes, unclear fluency)

### 1.2 Core Server Implementation
- [x] Implement `MCPServer` class with `CourseDBInterface` constructor injection
- [x] Setup MCP server initialization and transport handling
- [x] Create basic error handling and logging
- [x] Implement graceful startup/shutdown methods

**Notes:**
- ✅ Successful `yarn build` with dual CJS/ESM exports
- Fixed package.json exports order (types first) to resolve tsup warning
- Basic server structure ready for Phase 1.3 resource implementation
- Options pattern in place for future configuration (source linking, ELO calibration, etc.)

### 1.3 Basic Resources
- [x] Implement `course://config` resource
  - [x] Expose CourseConfig data
  - [x] Include available DataShapes (via CourseConfig.dataShapes)
  - [x] Add basic ELO distribution stats
- [x] Create resource registry and routing system
- [x] Add input validation with Zod schemas

**Notes:**
- ✅ Successful build with `course://config` resource registered
- ✅ **TESTED & WORKING** with Inspector UI and CLI
- Hardcoded test course ID: `2aeb8315ef78f3e89ca386992d00825b` (Go Programming)
- Real CourseConfig data: "Go (Programming Language)" with BlanksCard support
- ELO stats placeholder structure ready for proper implementation
- Resource discoverable via Inspector UI at `course://config`
- Fixed ES modules issue (.mjs extension needed)
- Local dev example working with CouchDB connection

### 1.4 Basic Tools
- [x] Implement `create_card` tool
  - [x] Accept DataShapeName, data, optional ELO
  - [x] Validate against course DataShapes
  - [x] Create card via CourseDBInterface
  - [x] Return created card ID and initial ELO
- [x] Create tools registry and routing system
- [x] Add tool input/output validation

**Notes:**
- ✅ Successful build with `create_card` tool registered
- Uses proper CourseElo structure with `toCourseElo()` helper
- Validates datashape against available course DataShapes
- DataLayerResult API: `result.status` and `result.id` 
- Tool discoverable via Inspector at `create_card`
- Input schema: `datashape` (string), `data` (object), optional `tags`, `elo`, `sourceRef`

### 1.5 End-to-End Testing
- [ ] Create local development example script
- [ ] Test with hardcoded CourseDBInterface instance
- [ ] Verify MCP protocol compliance with Claude Desktop
- [ ] Basic integration smoke tests

## Phase 2: Core Resources & Tools

### 2.1 Extended Resources
- [ ] Implement `cards://` resource family
  - [ ] `cards://all` - List all cards
  - [ ] `cards://tag/[tagName]` - Filter by tag
  - [ ] `cards://shape/[shapeName]` - Filter by DataShape
  - [ ] `cards://elo/[min]-[max]` - Filter by ELO range
- [ ] Implement `shapes://` resource family
  - [ ] `shapes://all` - All available DataShapes
  - [ ] `shapes://[shapeName]` - Specific DataShape definition
- [ ] Implement `tags://` resource family
  - [ ] `tags://all` - All available tags in course
  - [ ] `tags://stats` - Tag usage statistics
  - [ ] `tags://[tagName]` - Specific tag details + card count
  - [ ] `tags://union/[tag1]+[tag2]` - Cards with ANY of these tags
  - [ ] `tags://intersect/[tag1]+[tag2]` - Cards with ALL these tags
  - [ ] `tags://exclusive/[tag1]-[tag2]` - Cards with tag1 but NOT tag2
  - [ ] `tags://distribution` - Tag frequency distribution
- [ ] Add pagination support for large collections
- [ ] Optimize resource queries for performance

### 2.2 Content Generation Tools
- [ ] Implement `explore_and_generate_courseware` orchestrating tool
  - [ ] Support both sourceText and filePath inputs
  - [ ] Content type detection (markdown, code, text)
  - [ ] Target DataShape specification for generation
  - [ ] Analysis mode: identify quiz opportunities
  - [ ] Generation mode: create cards via internal create_card calls
  - [ ] ELO estimation and calibration
  - [ ] Source linking integration
  - [ ] Internal prompt utilization for content analysis
  - [ ] Return comprehensive generation report

### 2.3 Content Management Tools
- [ ] Implement `update_card` tool
- [ ] Implement `tag_card` tool
- [ ] Add comprehensive error handling and validation
- [ ] Support batch operations for efficiency

### 2.4 Testing & Documentation
- [ ] Comprehensive unit tests for all resources and tools
- [ ] Integration tests with mock CourseDBInterface
- [ ] Update documentation with examples
- [ ] Performance benchmarking

## Phase 3: ELO Intelligence & Source Linking

### 3.1 ELO Resources
- [ ] Implement `elo://distribution` resource
- [ ] Implement `elo://stats` resource (mean, median, quartiles)
- [ ] Implement `elo://gaps` resource for identifying under-represented ranges
- [ ] Add ELO analytics and insights

### 3.2 Advanced ELO Tools
- [ ] Implement `rate_content` tool
  - [ ] Accept manual ELO ratings with reasoning
  - [ ] Update card ELO via CourseDBInterface
  - [ ] Support reference card comparisons
- [ ] Implement `suggest_elo_calibration` tool
  - [ ] Analyze similar existing cards
  - [ ] Suggest appropriate ELO based on patterns
  - [ ] Provide confidence scores
- [ ] Implement `identify_elo_gaps` tool
  - [ ] Analyze course ELO distribution
  - [ ] Suggest target ranges for new content
  - [ ] Support different distribution strategies

### 3.3 Source Linking System
- [ ] Define `SourceReference` types and schemas
- [ ] Implement source linking in content generation tools
- [ ] Add git commit/milestone tracking capabilities
- [ ] Create utilities for source reference validation

### 3.4 Prompts System
- [ ] Implement `quiz_generation` prompt template
- [ ] Implement `content_analysis` prompt template
- [ ] Implement `elo_calibration` prompt template
- [ ] Create prompt registry and parameter validation

### 3.5 Advanced Testing
- [ ] ELO system integration tests
- [ ] Source linking validation tests
- [ ] Prompt template tests
- [ ] Performance optimization and caching

## Phase 4: Advanced Analysis & Integration

### 4.1 File System Integration
- [ ] Implement directory scanning capabilities
- [ ] Support for different file types (markdown, code, docs)
- [ ] Git repository integration for milestone tracking
- [ ] Automated source change detection

### 4.2 Advanced Content Analysis
- [ ] Implement semantic content analysis
- [ ] Cross-reference generation between related topics
- [ ] Automated ELO calibration based on content patterns
- [ ] Intelligent gap filling in course content

### 4.3 Express Integration Preparation
- [ ] Create Express middleware helpers
- [ ] Implement HTTP transport support
- [ ] Add authentication integration points
- [ ] Session and state management

### 4.4 Production Readiness
- [ ] Comprehensive error handling and recovery
- [ ] Structured logging with different levels
- [ ] Performance monitoring and metrics
- [ ] Configuration management
- [ ] Security hardening

### 4.5 Documentation & Examples
- [ ] Complete API documentation
- [ ] Express integration examples
- [ ] Best practices guide
- [ ] Troubleshooting guide

## Current Status: 🔄 Not Started

**Next Task:** Begin Phase 1 - Package Setup

## Notes
- Each phase should be fully functional and testable before moving to the next
- ELO integration is threaded throughout all phases as a core primitive
- Source linking capabilities build progressively from basic to advanced
- Express integration is designed but deferred to focus on core MCP functionality first