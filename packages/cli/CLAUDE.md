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
- **TypeScript**: Direct compilation to CommonJS in `dist/`
- **Binary Entry**: `dist/cli.js` with executable shebang
- **Module Type**: ES module with `.js` extension

## CLI Commands

### Project Initialization
- **init**: Scaffolds new course project structure
- **pack**: Packages course content for distribution

## Dependencies

### Core CLI Framework
- `commander` - Command-line argument parsing
- `inquirer` - Interactive prompts and wizards
- `chalk` - Terminal color output

### Vue-Skuilder Integration
- `@vue-skuilder/db` - Database utilities for course packaging
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

### Pack Command (`commands/pack.ts`)
- **Course Compilation**: Bundles course content for distribution
- **Static Data**: Converts dynamic course data to static format
- **Optimization**: Minifies and optimizes course assets
- **Packaging**: Creates deployable course bundle

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
- **Course Authors**: Initialize new course projects
- **Content Creators**: Package courses for distribution
- **Developers**: Bootstrap vue-skuilder development environment
- **Deployment**: Automated course packaging for CI/CD