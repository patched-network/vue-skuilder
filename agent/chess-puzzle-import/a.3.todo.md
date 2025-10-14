# Todo: Lichess Chess Puzzle Bulk Import

## Phase 1: Validator Fixes (Critical Path)

- [x] 1.1 Read and understand current puzzle validator
- [x] 1.2 Fix error message: "8 fields" → "10 fields"
- [x] 1.3 Verify split logic handles 10-element arrays
- [x] 1.4 Add defensive parsing for empty fields (trailing commas)
- [x] 1.5 Test validator with sample Lichess data
- [x] 1.6 Make validator more lenient for bulk import (accepts 9-10 fields, validates required fields)

## Phase 2: CSV Parser Module (Standalone Script)

- [x] 2.1 Create `agent/chess-puzzle-import/csvPuzzleParser.ts`
- [x] 2.2 Implement `ParsedPuzzle` interface
- [x] 2.3 Implement `parsePuzzleCSV(csvLine)` function
  - [x] 2.3.1 Split CSV line on commas
  - [x] 2.3.2 Extract themes (index 7), split on spaces
  - [x] 2.3.3 Extract openings (index 9), split on spaces, add "opening:" prefix
  - [x] 2.3.4 Handle empty opening tags field
  - [x] 2.3.5 Combine tags: [...themes, ...prefixedOpenings]
  - [x] 2.3.6 Extract rating (index 3) as elo
  - [x] 2.3.7 Reconstruct full puzzleData string (stores full CSV row)
- [x] 2.4 Implement `parsePuzzleCSVStream()` function with Node.js readline
- [x] 2.5 Add progress callback support (with ParseStats interface)
- [x] 2.6 Add error handling for malformed lines
- [x] 2.7 Test parser with Lichess sample data (8/8 tests pass)

## Phase 3: Standalone Import Script

- [ ] 3.1 Create `agent/chess-puzzle-import/import-script.ts`
- [ ] 3.2 Add command-line argument parsing (minimist or yargs)
- [ ] 3.3 Implement main import logic
  - [ ] 3.3.1 Connect to CouchDB with PouchDB
  - [ ] 3.3.2 Get DataLayer and CourseDB interface
  - [ ] 3.3.3 Get DataShape for CHESS_puzzle from courseware
  - [ ] 3.3.4 Initialize progress tracking
  - [ ] 3.3.5 Stream CSV file with parsePuzzleCSVStream()
  - [ ] 3.3.6 For each puzzle: call courseDB.addNote() directly
  - [ ] 3.3.7 Build ELO structure (global + per-tag)
  - [ ] 3.3.8 Track errors and write to error log
  - [ ] 3.3.9 Print final statistics
- [ ] 3.4 Add progress indicator (e.g., every 1000 puzzles)
- [ ] 3.5 Add error log file creation
- [ ] 3.6 Add options support: --dry-run, --limit, --from-line, --batch-size
- [ ] 3.7 Create package.json for local script dependencies

## Phase 4: Case Study Documentation

- [ ] 4.1 Create `agent/chess-puzzle-import/case-study.md`
- [ ] 4.2 Document the use case and requirements
- [ ] 4.3 Document the architecture decisions
- [ ] 4.4 Provide step-by-step implementation guide
- [ ] 4.5 Include code examples for key patterns
- [ ] 4.6 Document generalizable patterns:
  - [ ] 4.6.1 Using CourseDB interface directly
  - [ ] 4.6.2 Mapping external data to DataShapes
  - [ ] 4.6.3 Handling bulk imports efficiently
  - [ ] 4.6.4 Tag extraction patterns
  - [ ] 4.6.5 ELO mapping strategies
- [ ] 4.7 Document packing and deployment process
- [ ] 4.8 Include troubleshooting tips
- [ ] 4.9 Add "Lessons Learned" section

## Phase 5: Testing

- [ ] 5.1 Unit test: csvPuzzleParser with sample data
  - [ ] 5.1.1 Test tag extraction from themes
  - [ ] 5.1.2 Test opening tag prefixing
  - [ ] 5.1.3 Test empty opening tags handling
  - [ ] 5.1.4 Test full puzzleData reconstruction
- [ ] 5.2 Unit test: puzzleProcessor card creation
- [ ] 5.3 Unit test: fixed validator with Lichess data
- [ ] 5.4 Integration test: import 10 puzzles to local CouchDB
- [ ] 5.5 Integration test: verify cards created correctly
- [ ] 5.6 Integration test: verify tags assigned correctly
- [ ] 5.7 Integration test: verify ELO values correct
- [ ] 5.8 Load test: import 1000 puzzles, measure time/memory
- [ ] 5.9 Verify packed course loads in static player

## Phase 6: Full Import & Deployment

- [ ] 6.1 Ensure CouchDB running locally
- [ ] 6.2 Create or select target course
- [ ] 6.3 Run import script on full dataset
  - Command: `npx ts-node agent/chess-puzzle-import/import-script.ts <path-to-csv> <courseId>`
- [ ] 6.4 Monitor progress and error rate
- [ ] 6.5 Review error log for patterns
- [ ] 6.6 Pack course to static format
  - Command: `yarn workspace @vue-skuilder/cli pack <courseId> --output ./static-courses`
- [ ] 6.7 Verify manifest.json and chunks created
- [ ] 6.8 Test static course locally
- [ ] 6.9 Create GitHub repository
- [ ] 6.10 Push static course files to GitHub
- [ ] 6.11 Enable GitHub Pages
- [ ] 6.12 Verify course loads from GitHub Pages

## Phase 7: Documentation & Cleanup

- [ ] 7.1 Document import-puzzles command usage
- [ ] 7.2 Document typical workflow (import → pack → deploy)
- [ ] 7.3 Document error handling and recovery
- [ ] 7.4 Add examples to CLI help text
- [ ] 7.5 Update project README if needed

## Notes

- Phases 2 and 3 can be implemented in parallel
- Phase 1 is critical path - fixes validator before testing
- Target loss rate: < 5% of puzzles
- Batch commits every 100 puzzles to balance speed and recoverability
- Use --limit flag during development to test with subset

## Success Criteria

- [ ] Can import full Lichess dataset (521MB, ~2M puzzles)
- [ ] < 5% puzzle loss due to validation or errors
- [ ] Import completes in reasonable time (< 2 hours)
- [ ] Packed static course works in standalone player
- [ ] Course deployed to GitHub Pages and loads correctly
- [ ] Tags extracted and prefixed correctly
- [ ] ELO values mapped correctly
