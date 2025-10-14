# Plan: Lichess Chess Puzzle Bulk Import

## Selected Approach

**CLI-based Streaming Importer** with validator fixes

### Rationale
- 521MB / ~2M puzzles requires efficient streaming
- `courseDB.addNote()` available directly in database layer (no UI needed)
- Single-use operation for static course creation
- Can process chopped files in parallel if needed

## Architecture

```
┌─────────────────────┐
│ CLI Command         │
│ import-puzzles      │
└──────┬──────────────┘
       │
       ├─> CSV Parser (streaming)
       │   └─> ParsedPuzzle { puzzleData, tags, elo }
       │
       ├─> Puzzle Processor
       │   ├─> Extract themes → tags
       │   ├─> Extract openings → "opening:" prefixed tags
       │   ├─> Map rating → elo
       │   └─> courseDB.addNote(...)
       │
       └─> Progress Tracking
           ├─> Count: processed / failed / total
           └─> Rate: puzzles/second
```

## Implementation Phases

### Phase 1: Validator Fixes (Critical)
Fix buggy validator that rejects valid Lichess data

**Files**:
- `packages/courseware/src/chess/questions/puzzle/index.ts`

**Changes**:
1. Fix error message (line 36): "10 fields" not "8 fields"
2. Verify split logic: CSV format produces 10 elements
3. Add defensive parsing: handle empty fields (trailing commas)
4. Optionally: make validator more lenient or skip field count check

### Phase 2: CSV Parser Module
Create dedicated CSV puzzle parser

**Files**:
- `packages/common/src/bulkImport/csvPuzzleParser.ts` (new)
- `packages/common/src/bulkImport/index.ts` (update exports)

**Interface**:
```typescript
interface ParsedPuzzle {
  puzzleData: string;  // Full CSV row as comma-delimited string
  tags: string[];      // Themes + "opening:" prefixed openings
  elo: number;         // Lichess rating
  rawData?: {          // Optional: for debugging
    puzzleId: string;
    fen: string;
    moves: string;
    themes: string[];
    openings: string[];
  };
}

function parsePuzzleCSV(csvLine: string): ParsedPuzzle | null;
function parsePuzzleCSVStream(
  filePath: string,
  onPuzzle: (puzzle: ParsedPuzzle) => Promise<void>,
  onProgress?: (count: number) => void
): Promise<{ total: number; failed: number }>;
```

**Tag Extraction Logic**:
```
Themes column (index 7): "backRankMate endgame mate mateIn2 short"
  → Split on space
  → Each becomes tag: ["backRankMate", "endgame", "mate", "mateIn2", "short"]

OpeningTags column (index 9): "Italian_Game Italian_Game_Classical_Variation"
  → Split on space
  → Prefix each: ["opening:Italian_Game", "opening:Italian_Game_Classical_Variation"]
  → Handle empty: "" → []

Combined: [...themes, ...prefixedOpenings]
```

### Phase 3: CLI Import Command
Create new CLI command for puzzle import

**Files**:
- `packages/cli/src/commands/import-puzzles.ts` (new)
- `packages/cli/src/cli.ts` (register command)

**Command Signature**:
```bash
skuilder import-puzzles <csv-file> <courseId> [options]

Options:
  -s, --server <url>           CouchDB server URL (default: http://localhost:5984)
  -u, --username <username>    CouchDB username
  -p, --password <password>    CouchDB password
  --batch-size <size>          Batch size for commits (default: 100)
  --skip-validation            Skip puzzle data validation
  --dry-run                    Parse CSV but don't insert
  --from-line <n>              Start from line N (for resuming)
  --limit <n>                  Import only first N puzzles
```

**Implementation**:
1. Connect to CouchDB
2. Get or create course database
3. Stream CSV file line by line
4. Parse each line to `ParsedPuzzle`
5. Batch inserts (commit every N puzzles)
6. Track progress and errors
7. Write error log for failed imports

### Phase 4: Puzzle Processor
Add puzzle-specific processing logic

**Files**:
- `packages/db/src/core/bulkImport/puzzleProcessor.ts` (new)
- `packages/db/src/core/bulkImport/index.ts` (update exports)

**Function**:
```typescript
async function importPuzzle(
  puzzle: ParsedPuzzle,
  courseDB: CourseDBInterface,
  config: {
    courseCode: string;
    userName: string;
    dataShape: DataShape;
    skipValidation?: boolean;
  }
): Promise<ImportResult>
```

**Card Data Structure**:
```typescript
const cardData = {
  puzzleData: puzzle.puzzleData,  // Full CSV row
  Uploads: [],
};

// Create with ELO structure
const elo = {
  global: { score: puzzle.elo, count: 1 },
  tags: puzzle.tags.reduce((acc, tag) => {
    acc[tag] = { score: puzzle.elo, count: 1 };
    return acc;
  }, {}),
  misc: {},
};

await courseDB.addNote(
  config.courseCode,
  config.dataShape,
  cardData,
  config.userName,
  puzzle.tags,
  undefined, // attachments
  elo
);
```

### Phase 5: Course Setup & Packing
Create course and pack to static format

**Course Creation**:
```bash
# Option A: Use existing course
skuilder import-puzzles puzzles.csv my-chess-course

# Option B: Create new course first (if init supports it)
# Or create manually via UI/API
```

**Packing to Static**:
```bash
# After import completes
skuilder pack my-chess-course \
  --server http://localhost:5984 \
  --username admin \
  --password password \
  --output ./static-courses
```

**GitHub Pages Deployment**:
```bash
# Create new repo
cd static-courses/my-chess-course
git init
git add .
git commit -m "Initial chess puzzles course"
git remote add origin https://github.com/user/chess-puzzles.git
git push -u origin main

# Enable GitHub Pages in repo settings → Pages → Source: main branch
```

## Error Handling Strategy

### Expected Error Types
1. **Malformed CSV**: Missing fields, wrong delimiter
2. **Validation Failures**: Validator rejects valid data (Phase 1 addresses)
3. **Database Errors**: Connection issues, quota limits
4. **Resource Limits**: Memory, disk space

### Mitigation
1. **Graceful Failures**: Log error, continue with next puzzle
2. **Error Log File**: Write failed puzzles to `import-errors.csv` for review
3. **Resume Support**: `--from-line` flag to resume interrupted imports
4. **Batch Commits**: Commit in batches to reduce transaction overhead
5. **Progress Checkpoints**: Print status every 1000 puzzles

### Acceptable Loss Rate
User indicated lossy ingestion OK. Target: < 5% failure rate.

## Testing Strategy

### Unit Tests
1. `csvPuzzleParser.ts`: Test tag extraction, field parsing
2. `puzzleProcessor.ts`: Test card data structure creation
3. Validator: Test with known-good Lichess data

### Integration Tests
1. Import small CSV (10-100 puzzles) to local CouchDB
2. Verify cards created correctly
3. Verify tags and ELO assigned
4. Pack and verify static course works

### Load Testing
1. Import 10K puzzles: measure time, memory
2. Import full dataset: measure time, failures
3. Verify packed course size reasonable

## Timeline Estimate

| Phase | Task | Time | Dependencies |
|-------|------|------|--------------|
| 1 | Fix validator | 30 min | None |
| 2 | CSV parser | 2 hours | None |
| 3 | CLI command | 2 hours | Phase 2 |
| 4 | Puzzle processor | 1.5 hours | Phase 2 |
| 5 | Course setup & docs | 1 hour | Phase 3, 4 |
| Testing | Unit + integration | 1 hour | All |

**Total**: ~8 hours (1 day)

## File Checklist

### New Files
- [ ] `packages/common/src/bulkImport/csvPuzzleParser.ts`
- [ ] `packages/db/src/core/bulkImport/puzzleProcessor.ts`
- [ ] `packages/cli/src/commands/import-puzzles.ts`

### Modified Files
- [ ] `packages/courseware/src/chess/questions/puzzle/index.ts` (validator fix)
- [ ] `packages/common/src/bulkImport/index.ts` (export parser)
- [ ] `packages/db/src/core/bulkImport/index.ts` (export processor)
- [ ] `packages/cli/src/cli.ts` (register command)

### Documentation
- [ ] README for import command usage
- [ ] Error handling documentation
- [ ] Example import workflow

## Next Steps

After plan approval:
1. Create detailed todo list with subtasks
2. Implement Phase 1 (validator fix) - quickest win
3. Implement Phase 2 (parser) and Phase 4 (processor) in parallel
4. Implement Phase 3 (CLI command)
5. Test with small dataset
6. Run full import
7. Pack to static
8. Deploy to GitHub Pages

## Open Questions

1. **Course Metadata**: What should the course be named? Description? Any specific configuration?
2. **User Attribution**: What username should be used for `addNote()` calls?
3. **DataShape Selection**: Confirm using `DataShapeName.CHESS_puzzle` from courseware
4. **File Location**: Where is your local Lichess CSV? (for testing path resolution)
5. **Chopped Files**: Do you want support for the ~2900 chopped files, or just the single 521MB file?
