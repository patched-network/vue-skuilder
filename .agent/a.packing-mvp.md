# Packing MVP Plan (Refactored)

## Objective
Create a minimal viable packing system that allows converting CouchDB course databases to static files via a CLI command. The refactored architecture separates data transformation (in db package) from file I/O (in CLI package).

## Architecture Overview

### 1. Refactored Packer (Web-Safe)
**Location**: `packages/db/src/util/packer/`
**Purpose**: Pure data transformation without file system dependencies
**Returns**: Data structures that CLI can write to files

**File Structure**:
```
packages/db/src/util/packer/
├── index.ts          # Main exports
├── types.ts          # Interfaces and types
└── CouchDBToStaticPacker.ts  # Core packing logic (data only)
```

### 2. CLI File Writer
**Location**: `packages/cli/src/commands/pack.ts`
**Purpose**: Handles all file I/O operations using data from packer
**Dependencies**: `fs-extra`, `pouchdb` (only in CLI package)

### 3. Clean Package Separation
- **DB Package**: Pure data transformation, web-safe, no file system deps
- **CLI Package**: File I/O, Node.js specific operations

## Implementation Steps

### ✅ Step 1: Move Refactored Packer to DB Package (COMPLETED)

Create `packages/db/src/util/packer/types.ts`:
```typescript
export interface StaticCourseManifest {
  version: string;
  courseId: string;
  courseName: string;
  lastUpdated: string;
  documentCount: number;
  chunks: ChunkMetadata[];
  indices: IndexMetadata[];
  designDocs: DesignDocument[];
}

export interface ChunkMetadata {
  id: string;
  docType: DocType;
  startKey: string;
  endKey: string;
  documentCount: number;
  path: string; // Relative path for file writing
}

export interface IndexMetadata {
  name: string;
  type: 'btree' | 'hash' | 'spatial';
  path: string; // Relative path for file writing
}

export interface PackerConfig {
  chunkSize: number;
  includeAttachments: boolean;
}

export interface PackedCourseData {
  manifest: StaticCourseManifest;
  chunks: Map<string, any[]>; // chunkId -> documents
  indices: Map<string, any>; // indexName -> index data
}
```

✅ **COMPLETED**: 
- Created `packages/db/src/util/packer/` directory structure
- Moved refactored `CouchDBToStaticPacker` class with no file I/O dependencies
- Created `types.ts` with all interface definitions
- Created `index.ts` with proper exports
- Package is now web-safe with no Node.js file system dependencies

### ✅ Step 2: Update DB Package Exports (COMPLETED)

Update `packages/db/tsup.config.ts`:
```typescript
export default defineConfig({
  entry: [
    'src/index.ts',
    'src/core/index.ts', 
    'src/pouch/index.ts',
    'src/util/packer/index.ts'  // Add packer export
  ],
  format: ['cjs', 'esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  outExtension: ({ format }) => ({
    js: format === 'esm' ? '.mjs' : '.js'
  })
});
```

✅ **COMPLETED**:
- Updated `tsup.config.ts` to include `src/util/packer/index.ts` in build entries
- Added packer export path to `package.json` exports
- Package builds successfully with CJS, ESM, and TypeScript definitions
- Verified imports work: `@vue-skuilder/db/packer` exports `CouchDBToStaticPacker`
- No unwanted dependencies (confirmed no fs-extra in db package)

### Step 3: Create CLI Pack Command with File I/O (25 mins)

Update `packages/cli/package.json` dependencies:
```json
{
  "dependencies": {
    "@vue-skuilder/cli": "workspace:*",
    "@vue-skuilder/db": "workspace:*",
    "chalk": "^5.3.0",
    "commander": "^11.0.0",
    "fs-extra": "^11.2.0",
    "inquirer": "^9.2.0",
    "pouchdb": "^9.0.0"
  }
}
```

Create `packages/cli/src/commands/pack.ts`:
```typescript
import { Command } from 'commander';
import PouchDB from 'pouchdb';
import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import { CouchDBToStaticPacker, PackerConfig } from '@vue-skuilder/db/packer';

export function createPackCommand(): Command {
  return new Command('pack')
    .description('Pack a CouchDB course into static files')
    .argument('<courseId>', 'Course ID to pack')
    .option('-s, --server <url>', 'CouchDB server URL', 'http://localhost:5984')
    .option('-u, --username <username>', 'CouchDB username')
    .option('-p, --password <password>', 'CouchDB password')
    .option('-o, --output <dir>', 'Output directory', './static-courses')
    .option('-c, --chunk-size <size>', 'Documents per chunk', '1000')
    .option('--no-attachments', 'Exclude attachments')
    .action(packCourse);
}

async function packCourse(courseId: string, options: any) {
  try {
    console.log(chalk.cyan(`🔧 Packing course: ${courseId}`));
    
    // Validate courseId
    if (!courseId || courseId.trim() === '') {
      throw new Error('Course ID is required');
    }

    // Connect to CouchDB
    const dbUrl = `${options.server}/coursedb-${courseId}`;
    const dbOptions: any = {};

    if (options.username && options.password) {
      dbOptions.auth = {
        username: options.username,
        password: options.password,
      };
    }

    console.log(chalk.gray(`📡 Connecting to: ${dbUrl}`));
    const sourceDB = new PouchDB(dbUrl, dbOptions);

    // Test connection
    try {
      await sourceDB.info();
      console.log(chalk.green('✅ Connected to database'));
    } catch (error) {
      throw new Error(`Failed to connect to database: ${error.message}`);
    }

    // Configure packer (data transformation only)
    const packerConfig: PackerConfig = {
      chunkSize: parseInt(options.chunkSize),
      includeAttachments: !options.noAttachments,
    };

    console.log(chalk.gray(`📦 Chunk size: ${packerConfig.chunkSize} documents`));
    console.log(chalk.gray(`📎 Include attachments: ${packerConfig.includeAttachments}`));

    // Pack the course (data transformation)
    console.log(chalk.cyan('🔄 Processing course data...'));
    const packer = new CouchDBToStaticPacker(packerConfig);
    const packedData = await packer.packCourse(sourceDB, courseId);

    // Create output directory
    const outputDir = path.resolve(options.output, courseId);
    await fs.ensureDir(outputDir);
    console.log(chalk.gray(`📁 Output directory: ${outputDir}`));

    // Write files
    await writePackedData(packedData, outputDir);

    // Success summary
    console.log(chalk.green('\n✅ Successfully packed course!'));
    console.log(chalk.white(`📊 Course: ${packedData.manifest.courseName}`));
    console.log(chalk.white(`📄 Documents: ${packedData.manifest.documentCount}`));
    console.log(chalk.white(`🗂️  Chunks: ${packedData.manifest.chunks.length}`));
    console.log(chalk.white(`🗃️  Indices: ${packedData.manifest.indices.length}`));
    console.log(chalk.white(`📁 Location: ${outputDir}`));

  } catch (error) {
    console.error(chalk.red('\n❌ Packing failed:'));
    console.error(chalk.red(error.message));
    process.exit(1);
  }
}

async function writePackedData(
  packedData: { manifest: any; chunks: Map<string, any[]>; indices: Map<string, any> },
  outputDir: string
) {
  console.log(chalk.cyan('💾 Writing files...'));

  // Write manifest
  const manifestPath = path.join(outputDir, 'manifest.json');
  await fs.writeJson(manifestPath, packedData.manifest, { spaces: 2 });
  console.log(chalk.gray(`📋 Wrote manifest: ${manifestPath}`));

  // Create directories
  const chunksDir = path.join(outputDir, 'chunks');
  const indicesDir = path.join(outputDir, 'indices');
  await fs.ensureDir(chunksDir);
  await fs.ensureDir(indicesDir);

  // Write chunks
  let chunkCount = 0;
  for (const [chunkId, chunkData] of packedData.chunks) {
    const chunkPath = path.join(chunksDir, `${chunkId}.json`);
    await fs.writeJson(chunkPath, chunkData);
    chunkCount++;
  }
  console.log(chalk.gray(`📦 Wrote ${chunkCount} chunks`));

  // Write indices  
  let indexCount = 0;
  for (const [indexName, indexData] of packedData.indices) {
    const indexPath = path.join(indicesDir, `${indexName}.json`);
    await fs.writeJson(indexPath, indexData, { spaces: 2 });
    indexCount++;
  }
  console.log(chalk.gray(`🗃️  Wrote ${indexCount} indices`));
}
```

### Step 4: Update CLI Main File (3 mins)

Update `packages/cli/src/cli.ts`:
```typescript
#!/usr/bin/env node

import { Command } from 'commander';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { initCommand } from './commands/init.js';
import { createPackCommand } from './commands/pack.js';  // Add import

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read package.json to get version
const packagePath = join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(readFileSync(packagePath, 'utf-8'));

const program = new Command();

program
  .name('skuilder')
  .description('CLI tool for scaffolding Skuilder course applications')
  .version(packageJson.version);

program
  .command('init')
  .argument('<project-name>', 'name of the project to create')
  .description('create a new Skuilder course application')
  .option('--data-layer <type>', 'data layer type (static|dynamic)', 'dynamic')
  .option('--theme <n>', 'theme name (default|medical|educational|corporate)', 'default')
  .option('--no-interactive', 'skip interactive prompts')
  .option('--couchdb-url <url>', 'CouchDB server URL (for dynamic data layer)')
  .option('--course-id <id>', 'course ID to import (for dynamic data layer)')
  .action(initCommand);

// Add pack command
program.addCommand(createPackCommand());

program.on('--help', () => {
  console.log('');
  console.log('Examples:');
  console.log('  $ skuilder init my-anatomy-course');
  console.log('  $ skuilder init biology-101 --data-layer=static --theme=medical');
  console.log('  $ skuilder pack sample-course-id');
  console.log('  $ skuilder pack biology-101 --server http://localhost:5984 --username admin');
});

program.parse();
```

## Testing Plan

### 1. Build Packages
```bash
# Build db package first (no fs-extra dependency!)
cd packages/db
yarn build

# Build cli package  
cd ../cli
yarn build

# Verify no fs-extra in db package node_modules
ls packages/db/node_modules | grep fs-extra  # Should be empty
```

### 2. Test Pack Command
```bash
# Basic test with local CouchDB
./packages/cli/dist/cli.js pack sample-course-id

# Test with auth
./packages/cli/dist/cli.js pack biology-101 \
  --server http://localhost:5984 \
  --username admin \
  --password password

# Test with custom output
./packages/cli/dist/cli.js pack chemistry \
  --output ./test-output \
  --chunk-size 500 \
  --no-attachments
```

### 3. Validate Output Structure
```bash
# Check directory structure
ls static-courses/sample-course-id/
# Should show: manifest.json, chunks/, indices/

# Check manifest content
cat static-courses/sample-course-id/manifest.json | jq .

# Check chunks exist
ls static-courses/sample-course-id/chunks/

# Check indices exist  
ls static-courses/sample-course-id/indices/
```

## Key Benefits of Refactored Architecture

### 1. Web-Safe DB Package
- ✅ No file system dependencies in db package
- ✅ Can be safely bundled in web applications
- ✅ Tree-shaking friendly
- ✅ Pure data transformation functions

### 2. Clean Separation of Concerns
- **DB Package**: Data transformation logic
- **CLI Package**: File I/O and Node.js operations
- Better testing and maintainability

### 3. Flexible Output
- Packer returns structured data, not files
- CLI can choose compression, format, directory structure
- Future: Could support other outputs (S3, FTP, etc.)

## Success Criteria

✅ DB package builds without `fs-extra` dependency **COMPLETED**
✅ Packer returns `PackedCourseData` structure instead of writing files **COMPLETED**
✅ CLI package handles all file I/O operations
✅ CLI `pack` command successfully connects to CouchDB
✅ CLI `pack` command generates proper static file structure
✅ Generated manifest.json contains expected metadata
✅ Chunks and indices are written correctly
✅ Error handling provides clear feedback

## Time Estimate: ~45 minutes

**Progress**: Steps 1-2 completed (~15 minutes). Remaining: Steps 3-4 (~30 minutes).

The refactored architecture is cleaner and maintains the same timeline while providing better separation of concerns and web compatibility.