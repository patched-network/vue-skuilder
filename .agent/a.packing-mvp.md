# Packing MVP Plan

## Objective
Create a minimal viable packing system that allows converting CouchDB course databases to static files via a CLI command. This focuses purely on the packing functionality to enable testing and validation.

## Architecture Overview

### 1. Move Packer to DB Package
**Location**: `packages/db/src/util/packer/`
**Purpose**: Make packing functionality available to other packages in the monorepo

**File Structure**:
```
packages/db/src/util/packer/
├── index.ts                 # Main exports
├── CouchDBToStaticPacker.ts # Core packing logic
├── StaticDataUnpacker.ts    # Reading packed data (for validation)
└── types.ts                 # Shared interfaces
```

### 2. Expose Packer in DB Package Exports
**Update**: `packages/db/src/index.ts` and `packages/db/tsup.config.ts`
**Purpose**: Make packer available for import by CLI package

### 3. Add Pack Command to CLI
**Location**: `packages/cli/src/commands/pack.ts`
**Purpose**: Provide user-facing command for packing CouchDB to static files

## Implementation Steps

### Step 1: Reorganize Packer Code (15 mins)

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

export interface PackerConfig {
  chunkSize: number;
  outputDir: string;
  includeAttachments: boolean;
  compressionLevel?: number;
}

// ... other interfaces from original packer.ts
```

Move and refactor existing packer code:
- Extract `CouchDBToStaticPacker` class to separate file
- Extract `StaticDataUnpacker` class to separate file  
- Create clean exports in `index.ts`

### Step 2: Update DB Package Exports (5 mins)

Update `packages/db/tsup.config.ts`:
```typescript
export default defineConfig({
  entry: [
    'src/index.ts',
    'src/core/index.ts',
    'src/pouch/index.ts',
    'src/util/packer/index.ts'  // Add packer export
  ],
  // ... rest of config
});
```

Update `packages/db/package.json` exports:
```json
{
  "exports": {
    ".": { /* existing */ },
    "./core": { /* existing */ },
    "./pouch": { /* existing */ },
    "./packer": {
      "types": "./dist/util/packer/index.d.ts",
      "import": "./dist/util/packer/index.mjs", 
      "require": "./dist/util/packer/index.js"
    }
  }
}
```

### Step 3: Add Dependencies to DB Package (2 mins)

Update `packages/db/package.json`:
```json
{
  "dependencies": {
    // ... existing deps
    "fs-extra": "^11.2.0"
  }
}
```

### Step 4: Create CLI Pack Command (20 mins)

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
    } catch (error) {
      throw new Error(`Failed to connect to database: ${error.message}`);
    }

    // Create output directory
    const outputDir = path.resolve(options.output, courseId);
    await fs.ensureDir(outputDir);

    // Configure packer
    const packerConfig: PackerConfig = {
      outputDir,
      chunkSize: parseInt(options.chunkSize),
      includeAttachments: !options.noAttachments,
    };

    console.log(chalk.gray(`📁 Output directory: ${outputDir}`));
    console.log(chalk.gray(`📦 Chunk size: ${packerConfig.chunkSize} documents`));

    // Pack the course
    const packer = new CouchDBToStaticPacker(packerConfig);
    const manifest = await packer.packCourse(sourceDB, courseId);

    // Success summary
    console.log(chalk.green('\n✅ Successfully packed course!'));
    console.log(chalk.white(`📊 Course: ${manifest.courseName}`));
    console.log(chalk.white(`📄 Documents: ${manifest.documentCount}`));
    console.log(chalk.white(`🗂️  Chunks: ${manifest.chunks.length}`));
    console.log(chalk.white(`🗃️  Indices: ${manifest.indices.length}`));
    console.log(chalk.white(`📁 Location: ${outputDir}`));

  } catch (error) {
    console.error(chalk.red('\n❌ Packing failed:'));
    console.error(chalk.red(error.message));
    process.exit(1);
  }
}
```

### Step 5: Update CLI Main File (3 mins)

Update `packages/cli/src/cli.ts`:
```typescript
// Add import
import { createPackCommand } from './commands/pack.js';

// Add to program
program.addCommand(createPackCommand());
```

### Step 6: Add Dependencies to CLI Package (2 mins)

Update `packages/cli/package.json`:
```json
{
  "dependencies": {
    // ... existing deps
    "@vue-skuilder/db": "workspace:*",
    "pouchdb": "^9.0.0"
  }
}
```

## Testing Plan

### 1. Build and Link
```bash
# Build db package first
cd packages/db
yarn build

# Build cli package
cd ../cli  
yarn build

# Test from root
yarn build
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
  --chunk-size 500
```

### 3. Validate Output
- Check manifest.json exists and is valid
- Verify chunks directory and files
- Verify indices directory and files
- Test file sizes are reasonable

## Success Criteria

✅ Packer functionality moved to `packages/db/src/util/packer/`
✅ Packer exported from db package and importable by CLI
✅ CLI `pack` command successfully connects to CouchDB
✅ CLI `pack` command generates static files with proper structure
✅ Generated manifest.json contains expected metadata
✅ Error handling provides clear feedback for common failures
✅ Help text and examples are clear and useful

## Known Limitations (Acceptable for MVP)

- No verification/validation of packed output
- No progress indicators for large courses
- No resume capability for interrupted packing
- Basic error handling only
- No compression options exposed in CLI

## Time Estimate: ~45 minutes

This provides the core functionality needed to test packing CouchDB courses to static files, without the complexity of the full static data layer implementation.