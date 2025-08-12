# @vue-skuilder/cli Package

Command-line scaffolding tool for creating and managing vue-skuilder course projects.

## Commands
- Build: `yarn workspace @vue-skuilder/cli build` (TypeScript compilation)
- Dev: `yarn workspace @vue-skuilder/cli dev` (TypeScript watch mode)
- Lint: `yarn workspace @vue-skuilder/cli lint:fix`

## Binary Usage
Once built, the CLI is available as `skuilder` command:
```bash
# Install globally or use via npx
npx @vue-skuilder/cli init my-course
npx @vue-skuilder/cli pack my-course
```

## Build System
- **TypeScript**: Direct compilation to ES module in `dist/`
- **Binary Entry**: `dist/cli.js` with executable shebang
- **Module Type**: ES module with `.js` extension
- **Asset Embedding**: Templates and UI source files embedded during build
- **Complex Build**: Multi-step process with template copying and path adjustments

## CLI Commands

### Project Initialization
- **init**: Scaffolds new course project structure
- **studio**: Launches complete editing environment with CouchDB, web UI, and MCP server
- **pack**: Packages course content for distribution
- **unpack**: Imports course content from CouchDB to static files

## Dependencies

### Core CLI Framework
- `commander` - Command-line argument parsing
- `inquirer` - Interactive prompts and wizards
- `chalk` - Terminal color output

### Vue-Skuilder Integration (All Workspace Packages)
- `@vue-skuilder/common` - Shared types and utilities
- `@vue-skuilder/common-ui` - Base UI components
- `@vue-skuilder/courseware` - Course content types and question implementations
- `@vue-skuilder/db` - Database utilities for course packaging
- `@vue-skuilder/edit-ui` - Course editing interface components
- `@vue-skuilder/express` - Express server for API endpoints
- `@vue-skuilder/mcp` - Model Context Protocol server integration
- `@vue-skuilder/standalone-ui` - Standalone player for packaged courses

### File Management
- `fs-extra` - Enhanced file system operations
- `pouchdb` - Local database for course data

## Command Implementation

### Init Command (`commands/init.ts`)
- **Project Setup**: Creates course directory structure
- **Template System**: Applies course template files
- **Configuration**: Generates initial course configuration
- **Dependencies**: Installs required npm packages

### Studio Command (`commands/studio.ts`)
- **Environment Setup**: Launches CouchDB, Express API, and web interface
- **Data Loading**: Unpacks course data to temporary database
- **MCP Server**: Provides Model Context Protocol server for Claude Code integration
- **Configuration Display**: Shows MCP connection details and .mcp.json content

### Pack Command (`commands/pack.ts`)
- **Course Compilation**: Bundles course content for distribution
- **Static Data**: Converts dynamic course data to static format
- **Optimization**: Minifies and optimizes course assets
- **Packaging**: Creates deployable course bundle

### MCP Server Integration
- **Protocol Implementation**: Leverages `@vue-skuilder/mcp` package for full server functionality
- **Course Access**: Direct CourseDBInterface integration for real-time data
- **Content Generation**: AI-powered card creation and content authoring via Claude Code
- **ELO Integration**: Native support for difficulty rating system
- **Studio Command**: Launches MCP server alongside development environment

## Utilities

### Template Management (`utils/template.ts`)
- **File Templates**: Course file and directory templates
- **Variable Substitution**: Dynamic template content generation
- **Asset Copying**: Static asset management

### Course Packing (`utils/pack-courses.ts`)
- **Data Extraction**: Converts CouchDB data to static files
- **Asset Bundling**: Packages course media and content
- **Optimization**: Compresses and optimizes output

### Interactive Prompts (`utils/prompts.ts`)
- **User Input**: Course configuration prompts
- **Validation**: Input validation and error handling
- **Help Text**: Contextual assistance

## Package Publishing
- **NPM Package**: Published as `@vue-skuilder/cli`
- **Global Installation**: Can be installed globally for `skuilder` command
- **Binary Linking**: Automatically creates `skuilder` command alias

## Use Cases
- **Course Authors**: Initialize new course projects with MCP server support
- **Content Creators**: Package courses for distribution with AI-enabled authoring
- **Developers**: Bootstrap vue-skuilder development environment
- **Claude Code Users**: AI-enabled course content creation and editing via MCP
- **Deployment**: Automated course packaging for CI/CD