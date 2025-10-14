# Case Study: Populating a Vue-Skuilder Course from External Data

## Overview

This document demonstrates how to import content into a vue-skuilder course from an arbitrary external data source. We use the **Lichess Chess Puzzle Database** as a concrete example, showing how to:

- Parse external data formats (CSV)
- Map external data to vue-skuilder DataShapes
- Use the database layer directly (bypassing the UI)
- Handle bulk imports efficiently (2M+ records)
- Pack and deploy as a static course

This pattern is generalizable to any external data source: vocabulary lists, quiz banks, flashcard collections, etc.

## Use Case: Lichess Puzzle Database

**Source**: [Lichess Open Database](https://database.lichess.org/#puzzles)
**Format**: CSV with 10 columns
**Volume**: ~2M chess puzzles (521MB file)
**Target**: Vue-skuilder course using CHESS_puzzle DataShape

### Sample Data

```csv
PuzzleId,FEN,Moves,Rating,RatingDeviation,Popularity,NbPlays,Themes,GameUrl,OpeningTags
aIBfE,3r1k2/pR2N1bp/6p1/7n/8/8/PPPB1PPP/6K1 w - - 3 23,d2b4 d8d1 b4e1 d1e1,600,108,94,488,backRankMate endgame mate mateIn2 short,https://lichess.org/DJMQsaKA#45,
AIbIx,1k3b2/ppp1q3/3p1N1p/3P1PpP/2P1Q1P1/1P6/P7/1K6 b - - 2 43,e7f6 e4e8 f6d8 e8d8,600,101,87,652,endgame mate mateIn2 queensideAttack short,https://lichess.org/sZ0JJZm0/black#86,
```

## Step 1: Understanding the Target DataShape

### Examine Existing DataShape

**File**: `packages/courseware/src/chess/questions/puzzle/index.ts`

```typescript
export class ChessPuzzle extends Question {
  public static dataShapes: DataShape[] = [
    {
      name: DataShapeName.CHESS_puzzle,
      fields: [
        {
          name: 'puzzleData',
          type: FieldType.CHESS_PUZZLE,
          validator: {
            instructions: 'insert a valid fen string',
            test: function (s: string) {
              const split = s.split(',');
              if (split.length != 10) {
                return { status: Status.error, msg: 'puzzleData must have 10 comma-separated fields' };
              }
              return { status: Status.ok, msg: '' };
            },
          },
        },
      ],
    },
  ];

  constructor(data: ViewData[]) {
    super(data);
    const [id, fen, movesStr, rating, , , , themes] = (data[0].puzzleData as string).split(',');
    this.id = id;
    this.fen = fen;
    this.moves = movesStr.split(' ');
    this.rating = parseInt(rating, 10);
    this.themes = themes.split(' ');
  }
}
```

### Key Insights

1. **Field Name**: `puzzleData` (not `Input` like markdown cards)
2. **Field Type**: `FieldType.CHESS_PUZZLE`
3. **Format**: Full CSV row as comma-delimited string
4. **Validator**: Expects exactly 10 comma-separated values
5. **Constructor**: Parses specific columns by index

## Step 2: Architecture Decision

### Why Standalone Script?

**Problem**: Vue-skuilder CLI is content-agnostic. Adding content-specific import commands would pollute the namespace.

**Solution**: Create a one-off standalone script in the agent directory.

**Benefits**:
- ✅ Reuses database layer (`@vue-skuilder/db`)
- ✅ No CLI namespace pollution
- ✅ Can be discarded or kept as needed
- ✅ Easy to adapt for other imports

### Script Location

```
agent/chess-puzzle-import/
├── import-script.ts       # Main orchestration
├── csvPuzzleParser.ts     # CSV parsing logic
├── package.json           # Local dependencies
├── case-study.md          # This document
└── error-log.csv          # Generated: failed imports
```

## Step 3: Data Mapping Strategy

### Source → Target Mapping

| CSV Column | Index | Target | Notes |
|------------|-------|--------|-------|
| PuzzleId | 0 | (included in puzzleData) | Used by Question constructor |
| FEN | 1 | (included in puzzleData) | Chess position |
| Moves | 2 | (included in puzzleData) | Space-separated UCI moves |
| Rating | 3 | **→ `elo` parameter** | Lichess difficulty |
| RatingDeviation | 4 | (included but unused) | - |
| Popularity | 5 | (included but unused) | - |
| NbPlays | 6 | (included but unused) | - |
| Themes | 7 | **→ `tags` array** | Space-separated themes |
| GameUrl | 8 | (included in puzzleData) | Source game |
| OpeningTags | 9 | **→ `tags` array (prefixed)** | Space-separated openings |

### Tag Extraction Logic

**Input**:
- Themes: `"backRankMate endgame mate mateIn2 short"`
- OpeningTags: `"Italian_Game Italian_Game_Classical_Variation"` (may be empty)

**Output**:
```javascript
tags = [
  "backRankMate",
  "endgame",
  "mate",
  "mateIn2",
  "short",
  "opening:Italian_Game",
  "opening:Italian_Game_Classical_Variation"
]
```

**Code**:
```typescript
function extractTags(themes: string, openings: string): string[] {
  const themeTags = themes.split(' ').filter(t => t.trim());
  const openingTags = openings
    ? openings.split(' ').filter(o => o.trim()).map(o => `opening:${o}`)
    : [];
  return [...themeTags, ...openingTags];
}
```

## Step 4: CSV Parser Implementation

### Parser Interface

```typescript
// agent/chess-puzzle-import/csvPuzzleParser.ts

export interface ParsedPuzzle {
  puzzleData: string;      // Full CSV row
  tags: string[];          // Extracted themes + openings
  elo: number;             // Lichess rating
  puzzleId: string;        // For logging/debugging
}

export function parsePuzzleCSV(csvLine: string): ParsedPuzzle | null {
  const fields = csvLine.split(',');

  if (fields.length !== 10) {
    console.warn(`Invalid CSV line: expected 10 fields, got ${fields.length}`);
    return null;
  }

  const [puzzleId, , , ratingStr, , , , themes, , openings] = fields;

  return {
    puzzleData: csvLine,  // Store entire row
    tags: extractTags(themes, openings),
    elo: parseInt(ratingStr, 10) || 1500,
    puzzleId,
  };
}

export async function parsePuzzleCSVStream(
  filePath: string,
  onPuzzle: (puzzle: ParsedPuzzle) => Promise<void>,
  onProgress?: (count: number) => void
): Promise<{ total: number; failed: number }> {
  const fs = require('fs');
  const readline = require('readline');

  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let lineNumber = 0;
  let processed = 0;
  let failed = 0;

  for await (const line of rl) {
    lineNumber++;

    // Skip header
    if (lineNumber === 1) continue;

    const puzzle = parsePuzzleCSV(line);

    if (puzzle) {
      try {
        await onPuzzle(puzzle);
        processed++;

        if (onProgress && processed % 1000 === 0) {
          onProgress(processed);
        }
      } catch (error) {
        console.error(`Failed to import puzzle ${puzzle.puzzleId}:`, error);
        failed++;
      }
    } else {
      failed++;
    }
  }

  return { total: processed, failed };
}
```

## Step 5: Using the Database Layer Directly

### Accessing CourseDB Interface

```typescript
// agent/chess-puzzle-import/import-script.ts

import PouchDB from 'pouchdb';
import { getDataLayer } from '@vue-skuilder/db';
import { DataShapeName } from '@vue-skuilder/common';
import { getAllDataShapesRaw } from '@vue-skuilder/courseware/backend';

async function connectToDatabase(courseId: string, serverUrl: string) {
  // Configure PouchDB connection
  const dbUrl = `${serverUrl}/coursedb-${courseId}`;
  const sourceDB = new PouchDB(dbUrl, {
    auth: {
      username: process.env.COUCH_USER || 'admin',
      password: process.env.COUCH_PASSWORD || 'password',
    }
  });

  // Get CourseDB interface
  const dataLayer = getDataLayer();
  const courseDB = dataLayer.getCourseDB(courseId);

  // Get DataShape
  const allDataShapes = getAllDataShapesRaw();
  const puzzleDataShape = allDataShapes.find(
    ds => ds.name === DataShapeName.CHESS_puzzle
  );

  if (!puzzleDataShape) {
    throw new Error('CHESS_puzzle DataShape not found');
  }

  return { courseDB, puzzleDataShape };
}
```

### Inserting Cards with addNote()

```typescript
async function importPuzzle(
  puzzle: ParsedPuzzle,
  courseDB: CourseDBInterface,
  dataShape: DataShape,
  courseCode: string,
  userName: string
) {
  // Create card data structure
  const cardData = {
    puzzleData: puzzle.puzzleData,  // Full CSV row in the correct field
    Uploads: [],
  };

  // Build ELO structure
  const tagsElo: Record<string, { score: number; count: number }> = {};
  for (const tag of puzzle.tags) {
    tagsElo[tag] = {
      score: puzzle.elo,
      count: 1,
    };
  }

  const elo = {
    global: {
      score: puzzle.elo,
      count: 1,
    },
    tags: tagsElo,
    misc: {},
  };

  // Insert card
  const result = await courseDB.addNote(
    courseCode,
    dataShape,
    cardData,
    userName,
    puzzle.tags,
    undefined, // attachments
    elo
  );

  return result;
}
```

## Step 6: Main Script Orchestration

```typescript
// agent/chess-puzzle-import/import-script.ts

async function main() {
  const args = process.argv.slice(2);
  const [csvFile, courseId] = args;

  if (!csvFile || !courseId) {
    console.error('Usage: ts-node import-script.ts <csv-file> <courseId>');
    process.exit(1);
  }

  console.log(`🔧 Importing puzzles from: ${csvFile}`);
  console.log(`📚 Target course: ${courseId}`);

  // Connect
  const { courseDB, puzzleDataShape } = await connectToDatabase(
    courseId,
    'http://localhost:5984'
  );

  // Get course config for course code
  const courseConfig = await courseDB.getCourseConfig();
  const courseCode = courseConfig.code || 'chess';

  // Import with streaming
  let imported = 0;
  let failed = 0;
  const errors: Array<{ puzzleId: string; error: string }> = [];

  const { total } = await parsePuzzleCSVStream(
    csvFile,
    async (puzzle) => {
      try {
        await importPuzzle(
          puzzle,
          courseDB,
          puzzleDataShape,
          courseCode,
          'importer'
        );
        imported++;
      } catch (error) {
        failed++;
        errors.push({
          puzzleId: puzzle.puzzleId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
    (count) => {
      console.log(`📊 Processed: ${count} puzzles`);
    }
  );

  // Write error log
  if (errors.length > 0) {
    const fs = require('fs');
    const errorLog = errors.map(e => `${e.puzzleId},${e.error}`).join('\n');
    fs.writeFileSync('error-log.csv', 'PuzzleId,Error\n' + errorLog);
    console.log(`⚠️  Wrote ${errors.length} errors to error-log.csv`);
  }

  // Summary
  console.log(`\n✅ Import complete!`);
  console.log(`📊 Total: ${total}`);
  console.log(`✅ Imported: ${imported}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Success rate: ${((imported / total) * 100).toFixed(2)}%`);
}

main().catch(console.error);
```

## Step 7: Execution

### Setup

```bash
cd agent/chess-puzzle-import

# Create package.json (if needed for dependencies)
npm init -y
npm install --save-dev typescript @types/node ts-node
```

### Run Import

```bash
# Start CouchDB first
yarn dev:couchdb

# Run import
npx ts-node import-script.ts /path/to/lichess_db_puzzle.csv my-chess-course
```

### Monitor Progress

```
🔧 Importing puzzles from: /data/lichess_db_puzzle.csv
📚 Target course: my-chess-course
📊 Processed: 1000 puzzles
📊 Processed: 2000 puzzles
...
📊 Processed: 2000000 puzzles

✅ Import complete!
📊 Total: 2000000
✅ Imported: 1950000
❌ Failed: 50000
📈 Success rate: 97.50%
```

## Step 8: Packing & Deployment

### Pack to Static Format

```bash
# Use existing CLI pack command
yarn workspace @vue-skuilder/cli pack my-chess-course \
  --server http://localhost:5984 \
  --username admin \
  --password password \
  --output ./static-courses
```

### Deploy to GitHub Pages

```bash
cd static-courses/my-chess-course

git init
git add .
git commit -m "Chess puzzles course - 1.95M puzzles from Lichess"

# Create repo on GitHub, then:
git remote add origin https://github.com/username/chess-puzzles.git
git branch -M main
git push -u origin main

# Enable GitHub Pages in repo settings
# Source: main branch, root directory
```

### Access Course

```
https://username.github.io/chess-puzzles/
```

## Generalizable Patterns

### Pattern 1: External Data Import

**Steps**:
1. Identify target DataShape
2. Parse external format
3. Map data to DataShape fields
4. Extract metadata (tags, ELO)
5. Use `courseDB.addNote()` directly

**Applicable to**:
- Vocabulary lists (CSV/JSON → flashcards)
- Quiz banks (XML/JSON → questions)
- Anki decks (APKG → cards)
- Wikipedia articles (scraping → reading comprehension)

### Pattern 2: Tag Extraction

**Strategy**: Derive meaningful tags from external metadata

**Examples**:
- **Puzzle themes**: `"backRankMate mate"` → `["backRankMate", "mate"]`
- **Word categories**: `"noun,animal,mammal"` → `["noun", "animal", "mammal"]`
- **Difficulty levels**: `rating=1500` → `["difficulty:medium"]`

**Code Pattern**:
```typescript
function extractTags(metadata: ExternalMetadata): string[] {
  const tags: string[] = [];

  // Domain-specific tags
  if (metadata.category) tags.push(...metadata.category.split(','));

  // Difficulty-based tags
  if (metadata.difficulty) tags.push(`difficulty:${metadata.difficulty}`);

  // Prefixed taxonomies
  if (metadata.topics) {
    tags.push(...metadata.topics.map(t => `topic:${t}`));
  }

  return tags.filter(t => t.trim());
}
```

### Pattern 3: ELO Mapping

**Strategy**: Map external difficulty ratings to vue-skuilder ELO

**Mapping Functions**:
```typescript
// Direct mapping (when scales align)
function directEloMapping(externalRating: number): number {
  return externalRating;  // Lichess uses similar scale
}

// Linear scaling
function scaleEloMapping(externalRating: number, min: number, max: number): number {
  // Map [min, max] to [800, 2400]
  return 800 + ((externalRating - min) / (max - min)) * 1600;
}

// Categorical mapping
function categoricalEloMapping(difficulty: string): number {
  const mapping = {
    'easy': 1000,
    'medium': 1500,
    'hard': 2000,
    'expert': 2500,
  };
  return mapping[difficulty] || 1500;
}
```

### Pattern 4: Bulk Import Efficiency

**Techniques**:
- **Streaming**: Process files line-by-line (don't load entire file)
- **Batching**: Commit every N records
- **Progress tracking**: Log every 1000 records
- **Error isolation**: Continue on individual failures
- **Error logging**: Write failed records to file

**Code Pattern**:
```typescript
const BATCH_SIZE = 100;
let buffer: CardData[] = [];

await streamData(source, async (record) => {
  buffer.push(record);

  if (buffer.length >= BATCH_SIZE) {
    await flushBuffer(buffer);
    buffer = [];
  }
});

// Flush remaining
if (buffer.length > 0) {
  await flushBuffer(buffer);
}
```

### Pattern 5: Validation Strategy

**Options**:
1. **Strict**: Validate all data, reject invalid records
2. **Lenient**: Accept imperfect data, log warnings
3. **Trust**: Skip validation for known-good sources

**For bulk imports, recommend Lenient approach**:
```typescript
function validateLenient(data: any): { valid: boolean; warnings: string[] } {
  const warnings: string[] = [];

  // Critical checks
  if (!data.requiredField) {
    return { valid: false, warnings: ['Missing required field'] };
  }

  // Non-critical checks
  if (!data.optionalField) {
    warnings.push('Optional field missing, using default');
  }

  return { valid: true, warnings };
}
```

## Troubleshooting

### Common Issues

1. **Validator rejects valid data**
   - **Symptom**: High failure rate with seemingly valid records
   - **Solution**: Review DataShape validator, make more lenient for bulk import
   - **Example**: Chess puzzle validator had wrong field count in error message

2. **Memory exhaustion**
   - **Symptom**: Script crashes on large files
   - **Solution**: Use streaming instead of loading entire file
   - **Example**: Use `readline` for CSV, not `fs.readFileSync()`

3. **CouchDB connection errors**
   - **Symptom**: Random connection failures during import
   - **Solution**: Add retry logic, reduce batch size

4. **Slow import speed**
   - **Symptom**: < 100 records/second
   - **Solution**: Increase batch size, use bulk insert API if available

### Debugging Tips

```typescript
// Add dry-run mode
const DRY_RUN = process.env.DRY_RUN === 'true';

if (DRY_RUN) {
  console.log('Would insert:', cardData);
} else {
  await courseDB.addNote(...);
}

// Add limit for testing
const LIMIT = parseInt(process.env.LIMIT || '0');
if (LIMIT > 0 && processed >= LIMIT) {
  console.log(`Reached limit of ${LIMIT}, stopping`);
  break;
}

// Usage: LIMIT=100 DRY_RUN=true npx ts-node import-script.ts ...
```

## Lessons Learned

### Architectural

1. **Keep importer separate from CLI**: Content-specific importers don't belong in the framework
2. **Reuse database layer**: `CourseDBInterface` is sufficient, no UI needed
3. **DataShape flexibility**: Can store full CSV row in single field for deferred parsing

### Technical

1. **Streaming is essential**: 521MB CSV requires streaming, not in-memory loading
2. **Error isolation matters**: One bad record shouldn't kill entire import
3. **Progress feedback**: Log every N records for user confidence
4. **Validator alignment**: DataShape validator must match actual data format

### Operational

1. **Test with subset first**: Use `--limit 1000` before full import
2. **Monitor error rate**: > 10% failures indicates systemic issue
3. **Error logs are valuable**: Failed records help debug validators
4. **Batch size tuning**: Balance speed vs. recoverability

## Next Steps

### For This Import

1. Fix puzzle validator error message
2. Run import with `--limit 1000` to verify
3. Check error log for patterns
4. Run full import
5. Pack and deploy

### For Future Imports

1. Extract reusable patterns into shared utilities
2. Consider generic import framework with plugins
3. Document other data source examples (Anki, Quizlet, etc.)
4. Add web UI for one-off imports (upload CSV, map columns, import)

## Conclusion

This case study demonstrates that vue-skuilder can efficiently import large datasets from external sources by:

- Using the database layer directly (`CourseDBInterface`)
- Creating domain-specific parsing logic
- Mapping external data to DataShape fields
- Handling errors gracefully
- Packing to static format for deployment

The pattern is generalizable: any external data source can be imported by adapting the parser and mapping logic, while reusing the database infrastructure.

The standalone script approach avoids framework pollution while providing full access to vue-skuilder's capabilities.
