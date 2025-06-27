# Studio Mode Assessment for SUI Courses

## Current State Analysis

Based on issue #791 and the codebase, the static-to-live migration functionality has been implemented. Now the proposal is to create a "studio mode" for standalone-ui (sui) courses that leverages the existing platform-ui and express backend infrastructure.

## Proposed Architecture Analysis

### Core Concept
```
sui + devDependencies(pui, express) + couchdb scripts
↓
yarn studio → unpack → launch express + platform-ui → edit → repack
```

### Technical Feasibility

**✅ Strengths:**
- Reuses existing, battle-tested platform-ui editing interface
- Leverages proven express backend for attachment processing
- Maintains consistency with main development workflow
- Zero UI duplication - exactly what issue #791 recommended
- Natural integration with existing `skuilder unpack` command

**⚠️ Considerations:**
- sui package size will increase significantly with pui/express as devDependencies
- CouchDB management complexity in sui context
- Potential version synchronization issues between sui and main monorepo

## Implementation Options

### Option 1: Full Integration (Your Proposal)
```json
// sui package.json
{
  "devDependencies": {
    "@vue-skuilder/platform-ui": "workspace:*",
    "@vue-skuilder/express": "workspace:*"
  },
  "scripts": {
    "studio": "sui-studio",
    "couchdb:start": "...",
    "couchdb:stop": "..."
  }
}
```

**Pros:**
- Self-contained studio environment
- Clear separation of concerns
- Familiar yarn scripts pattern

**Cons:**
- Heavy devDependencies
- CouchDB installation/management burden on course developers
- Complex build tooling requirements

### Option 2: CLI-Driven Studio Mode
Keep studio functionality in the main CLI but make it work seamlessly with sui courses:

```bash
# From within a sui course directory
skuilder studio .
# Automatically detects sui course, manages temp CouchDB, launches studio
```

**Pros:**
- Lighter sui package
- Centralized studio tooling
- Better version control
- Easier maintenance

**Cons:**
- Requires main skuilder CLI to be globally installed
- Less self-contained

### Option 3: Hybrid Approach
Minimal sui integration with CLI delegation:

```json
// sui package.json
{
  "scripts": {
    "studio": "skuilder studio ."
  }
}
```

**Pros:**
- Best of both worlds
- Familiar interface for course developers
- Minimal sui package bloat
- Leverages existing infrastructure

## Technical Implementation Details

### CouchDB Management
Based on existing monorepo patterns:
- `yarn couchdb:start` using Docker/local CouchDB
- Temporary database creation for studio sessions
- Automatic cleanup on studio exit

### Workflow Integration
1. **Detection**: Identify sui course structure
2. **Unpack**: Use existing `StaticToCouchDBMigrator`
3. **Launch**: Start express backend + platform-ui dev server
4. **Edit**: Full platform-ui editing capabilities
5. **Pack**: Use existing packing workflow to update static files

### Development Experience
```bash
cd my-sui-course/
yarn studio
# → Launches browser with full editing interface
# → Make changes
# → yarn studio:pack (or automatic on exit)
```

## Risk Assessment

**Low Risk:**
- Reusing proven components
- Clear separation of concerns
- Follows established patterns

**Medium Risk:**
- Version synchronization between sui and main repo
- CouchDB setup complexity for course developers
- Potential port conflicts in development

**High Risk:**
- None identified

# Recommendation

**Option 3: Hybrid Approach** is the most balanced solution.

**Implementation Strategy:**
1. Add minimal studio script to sui package.json that delegates to main CLI
2. Enhance main CLI with sui course detection and studio mode
3. Leverage existing unpack/pack infrastructure
4. Use temporary CouchDB instances with automatic cleanup
5. Launch platform-ui in "studio mode" with sui-specific configurations

**Benefits:**
- Minimal sui package bloat
- Familiar developer experience (`yarn studio`)
- Centralized maintenance of studio tooling
- Reuses all existing infrastructure
- Easy to iterate and improve

**Next Steps:**
1. Prototype CLI studio command with sui detection
2. Implement temporary CouchDB management
3. Create sui-specific platform-ui launch configuration
4. Add studio script to sui template