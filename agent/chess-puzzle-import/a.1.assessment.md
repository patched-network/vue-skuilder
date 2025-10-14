# Assessment: Lichess Chess Puzzle Bulk Import

## Context

We need to adapt the vue-skuilder bulk import functionality to ingest chess puzzles from the Lichess puzzle database CSV format, create a large puzzle-based course in CouchDB, and then pack it as a static course for GitHub Pages hosting.

## Current State Analysis

### Existing Bulk Import System

**Location**: `packages/common/src/bulkImport/`, `packages/db/src/core/bulkImport/`

**Current Design**:
- Parser: `parseBulkTextToCards()` in `cardParser.ts`
- Format: Markdown-based with metadata footer
- Delimiter: `\n---\n---\n` between cards
- Metadata: `tags: tag1, tag2` and `elo: 1500`
- Output: `ParsedCard[]` with shape `{markdown: string, tags: string[], elo?: number}`

**Card Processor**:
- Function: `importParsedCards()` in `cardProcessor.ts`
- Takes `ParsedCard[]` and converts to database cards
- Creates cards via `courseDB.addNote(courseCode, dataShape, cardData, ...)`
- Currently designed for markdown content in the `Input` field

### Chess Puzzle DataShape

**Location**: `packages/courseware/src/chess/questions/puzzle/index.ts`

**DataShape Definition**:
- Name: `DataShapeName.CHESS_puzzle`
- Field: `puzzleData` (type: `FieldType.CHESS_PUZZLE`)
- Validator: Expects 10 comma-separated fields (CSV format)
- Constructor parses: `id, fen, moves, rating, _, _, _, themes, gameUrl, openingTags`

**Lichess CSV Format**:
```
PuzzleId,FEN,Moves,Rating,RatingDeviation,Popularity,NbPlays,Themes,GameUrl,OpeningTags
```

**Example**:
```
00AfG,r1bqkb1r/pppp1ppp/2n5/1B2p3/3Pn3/5N2/PPP2PPP/RNBQK2R b KQkq - 3 5,e4g5 f3e5 g5e6 e5f7,1300,80,95,320,advantage long mate material,https://lichess.org/MaTXj3z7#7,Italian_Game Italian_Game_Classical_Variation
```

### Packer System

**Location**: `packages/db/src/util/packer/`, `packages/cli/src/commands/pack.ts`

**Status**: ✅ Fully functional
- `CouchDBToStaticPacker` handles all card types
- CLI command `pack` ready to use
- Supports: chunks, indices (ELO, tags), attachments
- Output: Static JSON files + manifest for static data layer

## Gap Analysis

### Primary Gaps

1. **Format Mismatch**: Current parser expects markdown with delimiter `\n---\n---\n`, but Lichess provides CSV rows
2. **Field Mapping**: Current system populates `Input` field, but puzzles need `puzzleData` field
3. **Data Volume**: Lichess database is large (2M+ puzzles); need efficient batch processing
4. **UI Integration**: BulkImportView.vue hardcoded for markdown format in textarea placeholder

### Secondary Considerations

1. **Tag Extraction**: Lichess CSV has `Themes` and `OpeningTags` columns that map naturally to vue-skuilder tags
2. **ELO Mapping**: Lichess CSV has `Rating` column that maps to vue-skuilder ELO
3. **Validation**: Puzzle validator currently has a bug (says "8 fields" but checks for 10)
4. **Preview**: CardPreviewList component may need adaptation for puzzle preview

## Options

### Option A: Extend Existing Parser (Low Effort, Mixed Concerns)

**Approach**: Add CSV parsing mode to `cardParser.ts`

**Changes**:
- Add `format` parameter: `'markdown' | 'csv'` to `parseBulkTextToCards()`
- Add CSV parsing logic using standard CSV parser
- Extend `ParsedCard` to include `puzzleData` field
- Update UI to toggle format

**Pros**:
- Minimal code changes
- Reuses existing processor infrastructure
- Single UI entry point

**Cons**:
- Mixes two unrelated formats in same code
- `ParsedCard` interface becomes less cohesive
- Harder to optimize for large CSV datasets

**Effort**: ~2-3 hours

### Option B: Parallel CSV Import Pipeline (Recommended)

**Approach**: Create dedicated CSV import system alongside existing bulk import

**Changes**:
- New parser: `packages/common/src/bulkImport/csvPuzzleParser.ts`
- New interface: `ParsedPuzzle` with shape `{puzzleData: string, tags: string[], elo: number}`
- New processor: `packages/db/src/core/bulkImport/puzzleProcessor.ts` (or extend existing with type guards)
- UI: Add format selector or separate tab in BulkImportView.vue
- Reuse card processor with field mapping logic

**Pros**:
- Clean separation of concerns
- Easier to test and debug
- Can optimize CSV parser for large files
- Existing markdown import unchanged
- Future-proof for other CSV imports

**Cons**:
- More code to write
- Some logic duplication (validation, DB insertion)

**Effort**: ~4-6 hours

### Option C: CLI-Only CSV Importer (Fast, Technical Users Only)

**Approach**: Create standalone CLI command for CSV import

**Changes**:
- New CLI command: `packages/cli/src/commands/import-puzzles.ts`
- Direct CSV parsing with streaming for large files
- Bypass UI entirely
- Uses `courseDB.addNote()` directly

**Pros**:
- Fastest to implement
- Best performance for large datasets
- Can use Node.js streaming

**Cons**:
- No UI integration
- Requires technical knowledge
- No preview before import
- Less user-friendly

**Effort**: ~3-4 hours

### Option D: Format Auto-Detection (User-Friendly, Complex)

**Approach**: Single import interface that detects format automatically

**Changes**:
- Add format detection heuristic (check for CSV header, markdown delimiter)
- Route to appropriate parser based on detection
- Unified UI

**Pros**:
- Most user-friendly
- Single entry point
- Handles both formats transparently

**Cons**:
- Complex validation logic
- Potential for misdetection
- Harder to provide format-specific help text

**Effort**: ~5-7 hours

## Recommendation

**Option B: Parallel CSV Import Pipeline**

### Rationale

1. **Clean Architecture**: Separates concerns while reusing infrastructure
2. **Maintainability**: Future CSV imports (other puzzle sources, card types) can follow same pattern
3. **User Experience**: UI can provide format-specific guidance and validation
4. **Testing**: Isolated testing of CSV parsing vs markdown parsing
5. **Performance**: Can optimize CSV parser separately (streaming, batching)

### Implementation Strategy

**Phase 1: Core CSV Parsing (Minimal)**
- Create CSV parser function that outputs `ParsedCard[]` with puzzleData in markdown field
- Minimal UI changes (dropdown or radio button for format selection)
- Reuse existing card processor with field mapping

**Phase 2: Dedicated Types (Clean)**
- Create `ParsedPuzzle` interface
- Update processor to handle puzzle-specific fields
- Add puzzle preview in CardPreviewList

**Phase 3: Optimization (Scale)**
- Add streaming for large CSV files
- Add progress indicators
- Add CSV validation and error reporting

## Additional Considerations

### Bug Fixes Needed

1. **Puzzle Validator**: Error message says "8 fields" but checks for 10 (line 36 in `puzzle/index.ts`)
2. **Field Order**: Constructor uses index 8 for themes, but CSV shows themes at index 7

### Tag Strategy

**Lichess Themes**: `advantage long mate material` (space-separated)
**Lichess Openings**: `Italian_Game Italian_Game_Classical_Variation` (space-separated, underscore for spaces)

**Recommended Mapping**:
- Parse both Themes and OpeningTags columns
- Split on spaces
- Combine into single tag array
- Optional: prefix opening tags with `opening:` for distinction

### ELO Strategy

**Lichess Rating**: Direct integer (e.g., 1300)
**Recommended Mapping**: Use directly as vue-skuilder ELO

### Volume Considerations

**Lichess Database Size**: ~2M puzzles
**Recommendations**:
- Start with subset (e.g., rating range 1200-2000)
- Add pagination/streaming for full import
- Consider CLI for initial bulk load, UI for additions

## Questions

1. **Scope**: Do you want to import the entire Lichess puzzle database or a filtered subset?
>>> we'll do the whole thing. I have a local copy, both as a single 521mb CSV file and as ~2900 'chopped' csv files.
2. **UI vs CLI**: Do you need UI-based import, or is CLI acceptable for initial load?
>>> either is OK, but some of the infra for 'adding things to the database' exists only in the UI I think. Proove me wrong if this isn't the case!
3. **Tag Prefix**: Should opening tags be prefixed (e.g., `opening:Italian_Game`) or kept as-is?
>>> I'm *more* concerned with the theme tags, but we could do openings as well, and yes - they should be prefixd `opening>` I think. (matches some other convention)
4. **Incremental**: Do you need support for incremental imports (add more puzzles later)?
>>> not immediately. building a static course here.
5. **Validation**: Should we validate FEN strings and move sequences, or trust Lichess data?
>>> no - trusting lichess's data here. but NOTE - our existing validation of these strings is not perfect. Adding chess puzzles via the DataInputForm sometimes rejects strings from the CSV file, which I assumer is *my* error and not corrupted data. We are OK with losing some percentage of the data - the db is large and 'overloaded', so lossy injestion (up to a reasonable limit) is OK.


>>>
NB:

in case there is any discrepency, here are some lines from our local copy:

aIBfE,3r1k2/pR2N1bp/6p1/7n/8/8/PPPB1PPP/6K1 w - - 3 23,d2b4 d8d1 b4e1 d1e1,600,108,94,488,backRankMate endgame mate mateIn2 short,https://lichess.org/DJMQsaKA#45,
AIbIx,1k3b2/ppp1q3/3p1N1p/3P1PpP/2P1Q1P1/1P6/P7/1K6 b - - 2 43,e7f6 e4e8 f6d8 e8d8,600,101,87,652,endgame mate mateIn2 queensideAttack short,https://lichess.org/sZ0JJZm0/black#86,
aiE0V,2kr1r2/ppp1n2p/4q1p1/6Q1/8/8/PP3PPP/3RR1K1 w - - 0 22,e1e6 d8d1 e6e1 d1e1,600,91,73,182,endgame hangingPiece mate mateIn2 short,https://lichess.org/uXQWCdhL#43,
aiHV3,3r2k1/pp3ppp/5p2/5q2/3Q4/5PP1/PP5P/R3R1K1 b - - 0 21,d8d4 e1e8,600,105,85,230,backRankMate endgame mate mateIn1 oneMove queenRookEndgame,https://lichess.org/Eal2rOeN/black#42,

It's from a little while ago, so it's *possible* that lichess's format evolved in the meantime.

<<<
