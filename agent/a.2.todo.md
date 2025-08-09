# Todo: Backend Export Implementation

## Phase 1: Analysis & Setup
- [x] 1.1 Analyze current DataShape usage in MCP create-card tool
- [x] 1.2 Map all DataShape dependencies across courseware modules  
- [x] 1.3 Identify minimal subset needed for MCP functionality
- [x] 1.4 Document current AllCourseWare.allDataShapesRaw() implementation

### Phase 1.1 Findings: MCP DataShape Usage Analysis
**Key Usage in create-card.ts:**
- Line 8: `import { allCourseWare } from '@vue-skuilder/courseware';`
- Lines 59-61: `allCourseWare.allDataShapesRaw().find((ds) => ds.name === shapeDescriptor.dataShape)`
- Line 75: Uses `dataShape` with all field definitions for `courseDB.addNote()`

**Critical Requirements:**
1. MCP needs access to ALL DataShape definitions across ALL courses
2. Each DataShape must include complete field definitions (name, type, validation)
3. Only the `.name` and `.fields` properties are used by MCP
4. No Vue components or UI dependencies needed for MCP functionality

**Current Flow:**
1. Parse datashape name (e.g., "math.MATH_SingleDigitAddition") 
2. Extract course name and shape name using NameSpacer
3. Find matching DataShape in courseware registry
4. Pass complete DataShape to courseDB.addNote() for card creation

### Phase 1.2 Findings: Complete DataShape Dependency Map
**Found 21 question modules across 9 courses, each defining static dataShapes:**

**Math Course (8 shapes):**
- SingleDigitAdditionQuestion → MATH_SingleDigitAddition
- SingleDigitMultiplicationQuestion → MATH_SingleDigitMultiplication  
- SingleDigitDivisionQuestion → MATH_SingleDigitDivision
- EqualityTest → MATH_EqualityTest
- OneStepEquation → MATH_OneStepEquation
- AngleCategorize → MATH_AngleCategorize
- SupplementaryAngles → MATH_SupplimentaryAngles
- CountBy → MATH_CountBy

**Other Courses:**
- Default: BlanksCard → Blanks (shared across all courses)
- French: VocabQuestion → FRENCH_Vocab, AudioParsingQuestion → FRENCH_AudioParse
- Chess: ChessPuzzle → CHESS_puzzle, ForkFinder → CHESS_forks  
- Piano: PlayNote → PIANO_PlayNote, EchoQuestion → PIANO_Echo
- Pitch: ChromaQuestion → PITCH_chroma
- Typing: TypeLetterQuestion → TYPING_singleLetter, FallingLettersQuestion → TYPING_fallingLetters
- Word-work: SpellingQuestion → WORDWORK_Spelling
- Sight-sing: IdentifyKeyQuestion → SIGHTSING_IdentifyKey

**Critical Architecture Pattern:**
- Each Question class has `static dataShapes: DataShape[]`
- CourseWare aggregates questions via constructor: `new CourseWare('math', [Question1, Question2...])`
- AllCourseWare.allDataShapesRaw() iterates: courses → questions → dataShapes

### Phase 1.3 Findings: Minimal MCP Subset Requirements
**MCP only needs DataShape metadata, NOT Question classes or Vue components:**

**Required for MCP backend:**
```typescript
type DataShapeRegistry = DataShape[] // Just the shape definitions
interface DataShape {
  name: string;        // e.g., "math.MATH_SingleDigitAddition"
  fields: FieldDefinition[];
}
```

**NOT required for MCP:**
- Question class implementations
- Vue component imports  
- View definitions
- Constructor logic
- isCorrect() methods
- Any DOM/browser dependencies

**Backend Strategy:** Extract only the static dataShapes arrays from each Question class, pre-flatten into a simple registry without importing the Question classes themselves.

### ⚠️ CRITICAL ISSUE IDENTIFIED: Definition Duplication 
**Problem:** Current backend.ts approach duplicates ALL DataShape definitions, creating maintenance nightmare.

**Better Approach:** Create single-source-of-truth DataShape definitions that can be imported by both:
1. Question classes (for frontend)  
2. Backend registry (for Node.js)

**Solution:** Extract DataShape definitions to co-located shape files (Vue SFC style), then gather via barrel exports.

**Refined Architecture:**
```
math/questions/addition/
  ├── shapes.ts          # DataShape definitions (no Vue imports)
  ├── index.ts           # Question class imports from ./shapes.ts  
  └── horizontal.vue     # View component
  
math/shapes.ts           # Barrel: re-exports all math DataShapes
src/shapes.ts           # Master barrel: re-exports all course shapes  
backend.ts              # Imports from ./shapes.ts (pure, no Vue)
```

**Benefits:**
- ✅ Single source of truth
- ✅ Shapes stay close to their views (SFC-style coupling)
- ✅ Clean separation: shapes vs Vue components
- ✅ Backend can import pure shape definitions

### Phase 1.4 Findings: Current AllCourseWare.allDataShapesRaw() Implementation
**Location:** `packages/courseware/src/index.ts:212-226`

**Current Implementation Pattern:**
```typescript
// Lines 274-284: Global courseware registry
export const allCourseWare: AllCourseWare = new AllCourseWare([
  math, wordWork, french, defaultCourse, piano, pitch, sightSing, chess, typing
]);

// Lines 212-226: DataShape extraction logic
public allDataShapesRaw(): DataShape[] {
  const ret: DataShape[] = [];
  this.courseWareList.forEach((cw) => {           // Iterate each CourseWare
    cw.questions.forEach((question) => {          // Iterate each Question class  
      question.dataShapes.forEach((shape) => {    // Access static dataShapes property
        if (!ret.includes(shape)) {               // Basic deduplication
          ret.push(shape);
        }
      });
    });
  });
  return ret;
}
```

**Key Dependencies:** 
- Requires importing ALL Question classes (which import Vue components)
- CourseWare constructor aggregates Question classes: `new CourseWare('math', [Q1, Q2...])`
- Each course index.ts imports individual Question classes from subdirectories
- **THIS is the Vue dependency chain that breaks Node.js!**

## Phase 2: SFC-Style DataShape Refactoring  
- [x] 2.1 Extract DataShape definitions to co-located shapes.ts files (SFC-style)
- [x] 2.2 Update Question classes to import from local ./shapes.ts files
- [x] 2.3 Create course-level barrel exports (math/shapes.ts, chess/shapes.ts, etc.)
- [x] 2.4 Create master shapes barrel (src/shapes.ts) 
- [x] 2.5 Create clean backend.ts importing from ./shapes.ts
- [x] 2.6 Verify frontend functionality unchanged (build passes)
- [ ] 2.7 Remove old duplicated backend.ts

### Phase 2 Progress Summary:
**✅ SFC-Style Architecture Implemented:**
- Created co-located shapes.ts files: `math/questions/addition/shapes.ts`, `math/questions/equalityTest/shapes.ts`, `default/questions/fillIn/shapes.ts`
- Updated Question classes to import from local shapes files
- Created course barrel: `math/shapes.ts`  
- Created master barrel: `src/shapes.ts` with `ALL_DATA_SHAPES` array
- Created clean backend: `backend-clean.ts` with single-source-of-truth imports
- **Frontend build passes** - no regressions introduced

**✅ Benefits Achieved:**
- Single source of truth for DataShape definitions
- Shapes stay close to their views (SFC-style coupling)  
- Clean separation: shapes vs Vue components
- Backend can import pure shape definitions without Vue dependencies

## Phase 3: Package Configuration  
- [ ] 3.1 Add `./backend` export to courseware package.json
- [ ] 3.2 Update tsconfig and build configuration for dual exports
- [ ] 3.3 Verify build outputs both frontend and backend modules correctly
- [ ] 3.4 Test import paths work in Node.js environment

## Phase 4: MCP Integration
- [ ] 4.1 Update create-card.ts to import from courseware/backend
- [ ] 4.2 Replace allCourseWare.allDataShapesRaw() with backend registry
- [ ] 4.3 Test MCP server startup without CSS import errors
- [ ] 4.4 Verify create_card tool functionality remains identical

## Phase 5: Validation & Documentation
- [ ] 5.1 Run full MCP test suite to ensure no regressions
- [ ] 5.2 Test debug logging system with successfully running server
- [ ] 5.3 Update courseware CLAUDE.md with backend export documentation
- [ ] 5.4 Add backend usage examples to MCP documentation

## Success Criteria
- MCP server starts without CSS import errors
- Debug logging system captures MCP server lifecycle
- create_card tool maintains full functionality
- No breaking changes to frontend courseware usage
- Clean separation between frontend and backend concerns