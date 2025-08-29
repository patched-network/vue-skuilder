# Todo: Studio Command Manifest Support Implementation

## Overview
Extend the existing `studio` command to accept an optional manifest file argument, enabling studio editing of deployed course data without requiring a full scaffolded project structure. This approach maintains backward compatibility while adding manifest support.

## Phase 0: Code Refactoring ✅ COMPLETED

### 0.1 Extract SUI Course Logic
- [x] 0.1.1 Create `handleSuiCourse()` function - **COMPLETED**
  - [x] 0.1.1.1 Move questions directory hashing logic out of `launchStudio()` - **COMPLETED**
  - [x] 0.1.1.2 Move studio-ui build logic to separate function - **COMPLETED**
  - [x] 0.1.1.3 Return structured result with questionsHash and studioUIPath - **COMPLETED**
- [x] 0.1.2 Create `handleManifestCourse()` function - **COMPLETED**
  - [x] 0.1.2.1 Simple function that returns default studio-ui build path - **COMPLETED**
  - [x] 0.1.2.2 Set questionsHash to 'manifest-mode' - **COMPLETED**
  - [x] 0.1.2.3 Skip all custom build complexity - **COMPLETED**
- [x] 0.1.3 Simplify `launchStudio()` main flow - **COMPLETED**
  - [x] 0.1.3.1 Call appropriate handler function based on input type - **COMPLETED**
  - [x] 0.1.3.2 Remove inline build logic for better readability - **COMPLETED**
  - [x] 0.1.3.3 Maintain same error handling patterns - **COMPLETED**

## Phase 1: Command Enhancement ✅ COMPLETED

### 1.1 Argument Detection
- [x] 1.1.1 Enhance existing `studio` command argument handling
  - [x] 1.1.1.1 Update help text to document manifest file support
  - [x] 1.1.1.2 Add detection logic for `.json` files vs directories
  - [x] 1.1.1.3 Update command examples to show both usage patterns
- [x] 1.1.2 Preserve existing behavior
  - [x] 1.1.2.1 Default to current directory when no argument provided
  - [x] 1.1.2.2 Maintain scaffolded course support unchanged
  - [x] 1.1.2.3 Keep all existing command options (port, no-browser, etc.)

### 1.2 Input Validation
- [x] 1.2.1 Create `validateManifestCourse()` function
  - [x] 1.2.1.1 Check manifest.json exists and is valid JSON file
  - [x] 1.2.1.2 Validate required manifest fields (courseId, courseName, etc.)
  - [x] 1.2.1.3 Check course data directory structure exists relative to manifest
  - [x] 1.2.1.4 Verify chunks/, indices/, and asset directories are present
- [x] 1.2.2 Update main validation logic
  - [x] 1.2.2.1 Add manifest vs directory detection in `launchStudio()`
  - [x] 1.2.2.2 Call appropriate validation function based on input type
  - [x] 1.2.2.3 Provide clear error messages for both input types

## Phase 2: Data Layer Integration ✅ COMPLETED

### 2.1 Course Data Unpacking
- [x] 2.1.1 Enhance `unpackCourseToStudio()` for dual input support
  - [x] 2.1.1.1 Add `isManifestMode` parameter to function signature
  - [x] 2.1.1.2 Skip scaffolded project directory scanning for manifest mode
  - [x] 2.1.1.3 Use manifest directory as direct course data path
- [x] 2.1.2 Path handling adaptation
  - [x] 2.1.2.1 Use `actualCoursePath` variable for course data location
  - [x] 2.1.2.2 Generate database names from course data directory
  - [x] 2.1.2.3 Maintain existing database naming for scaffolded courses

### 2.2 Static Data Integration
- [x] 2.2.1 Verify unpack process compatibility
  - [x] 2.2.1.1 Test existing unpack command works with manifest course structure
  - [x] 2.2.1.2 Validate with docs course data (2aeb8315ef78f3e89ca386992d00825b)
  - [x] 2.2.1.3 Ensure chunks/ and indices/ directories are processed correctly
- [ ] 2.2.2 Asset handling verification
  - [ ] 2.2.2.1 Confirm asset paths are preserved during unpack
  - [ ] 2.2.2.2 Verify media files remain accessible in studio UI

## Phase 3: Studio UI Optimization ✅ COMPLETED

### 3.1 Build Process Simplification
- [x] 3.1.1 Add manifest mode detection to build logic - **COMPLETED**
  - [x] 3.1.1.1 Skip questions directory hashing for manifest mode - **COMPLETED**
  - [x] 3.1.1.2 Use default studio-ui build directly - **COMPLETED**
  - [x] 3.1.1.3 Set questionsHash to 'manifest-mode' identifier - **COMPLETED**
- [x] 3.1.2 Build path optimization - **COMPLETED**
  - [x] 3.1.2.1 Use shared build directory for manifest-based sessions - **COMPLETED**
  - [x] 3.1.2.2 Eliminate per-course build caching for manifests - **COMPLETED**
  - [x] 3.1.2.3 Maintain fast startup for manifest editing - **COMPLETED**

### 3.2 Studio UI Configuration
- [ ] 3.2.1 Maintain existing studio UI setup
  - [ ] 3.2.1.1 Use same CouchDB injection pattern for both modes
  - [ ] 3.2.1.2 Keep existing Express API endpoint configuration
  - [ ] 3.2.1.3 Preserve studio UI metadata display functionality
- [ ] 3.2.2 Flush to Static adaptation
  - [ ] 3.2.2.1 Ensure "Flush to Static" writes to correct location for manifests
  - [ ] 3.2.2.2 Test round-trip editing workflow (manifest → studio → flush → manifest)

## Phase 4: Express Backend Integration

### 4.1 Backend Configuration
- [ ] 4.1.1 Verify existing Express backend works with manifest courses
  - [ ] 4.1.1.1 Test course ID recognition from unpacked manifest data
  - [ ] 4.1.1.2 Confirm CouchDB connection setup works for both modes
  - [ ] 4.1.1.3 Validate CORS configuration remains functional
- [ ] 4.1.2 API endpoint verification
  - [ ] 4.1.2.1 Test course data CRUD operations with manifest data
  - [ ] 4.1.2.2 Verify card editing works with manifest-sourced content
  - [ ] 4.1.2.3 Confirm tag and ELO management functions correctly

### 4.2 Data Persistence
- [ ] 4.2.1 Test existing "Flush to Static" with manifest courses
  - [ ] 4.2.1.1 Verify flush command writes to manifest directory correctly
  - [ ] 4.2.1.2 Confirm chunks/ and indices/ directories are updated properly
  - [ ] 4.2.1.3 Test manifest.json file is updated with any metadata changes
- [ ] 4.2.2 Safety verification
  - [ ] 4.2.2.1 Confirm existing backup mechanisms work with manifest mode
  - [ ] 4.2.2.2 Test atomic write operations preserve data integrity
  - [ ] 4.2.2.3 Validate error handling doesn't corrupt manifest files

## Phase 5: MCP Integration

### 5.1 MCP Server Verification
- [ ] 5.1.1 Test existing MCP server setup with manifest courses
  - [ ] 5.1.1.1 Verify courseId extraction works from manifest-unpacked data
  - [ ] 5.1.1.2 Confirm .mcp.json generation includes correct course details
  - [ ] 5.1.1.3 Test MCP connection info display for both input modes
- [ ] 5.1.2 MCP functionality validation
  - [ ] 5.1.2.1 Test all MCP resources work with manifest-sourced data
  - [ ] 5.1.2.2 Verify card creation and editing via MCP with manifest courses
  - [ ] 5.1.2.3 Confirm tag and ELO management functions through MCP

## Phase 6: Testing and Validation

### 6.1 Core Functionality Testing
- [ ] 6.1.1 Test with docs course manifest
  - [ ] 6.1.1.1 Launch `skuilder studio docs/public/static-courses/2aeb8315ef78f3e89ca386992d00825b/manifest.json`
  - [ ] 6.1.1.2 Verify manifest detection and validation works correctly
  - [ ] 6.1.1.3 Confirm CouchDB unpacking processes manifest course data
  - [ ] 6.1.1.4 Test studio UI loads and displays manifest course content
- [ ] 6.1.2 End-to-end workflow testing
  - [ ] 6.1.2.1 Edit course content in studio UI
  - [ ] 6.1.2.2 Test "Flush to Static" writes back to manifest directory
  - [ ] 6.1.2.3 Verify edited data persists correctly in manifest structure
  - [ ] 6.1.2.4 Test MCP integration works with manifest-based studio session

### 6.2 Backward Compatibility Testing
- [ ] 6.2.1 Scaffolded course verification
  - [ ] 6.2.1.1 Test existing scaffolded course workflows remain unchanged
  - [ ] 6.2.1.2 Verify `skuilder studio` (no args) still works in course directories
  - [ ] 6.2.1.3 Confirm `skuilder studio .` behavior is preserved
- [ ] 6.2.2 Error handling validation
  - [ ] 6.2.2.1 Test clear error messages for invalid manifest files
  - [ ] 6.2.2.2 Verify helpful guidance when neither manifest nor course detected
  - [ ] 6.2.2.3 Confirm existing error handling works for scaffolded courses

## Phase 7: Documentation and Examples

### 7.1 Command Documentation
- [ ] 7.1.1 Update studio command help text
  - [ ] 7.1.1.1 Add manifest file usage examples
  - [ ] 7.1.1.2 Document dual input mode (directory or manifest.json)
  - [ ] 7.1.1.3 Include workflow examples for editing deployed courses
- [ ] 7.1.2 Usage guide updates
  - [ ] 7.1.2.1 Document how to edit deployed course content with manifests
  - [ ] 7.1.2.2 Update MCP integration examples for both modes
  - [ ] 7.1.2.3 Add best practices for manifest-based editing workflow

### 7.2 Usage Examples
- [ ] 7.2.1 Document common workflows
  - [ ] 7.2.1.1 `skuilder studio manifest.json` for deployed course editing
  - [ ] 7.2.1.2 `skuilder studio .` for scaffolded course development
  - [ ] 7.2.1.3 Adding new cards and questions in both modes
- [ ] 7.2.2 Integration with deployment pipeline
  - [ ] 7.2.2.1 Manifest-based: Edit → Flush → Commit → Deploy workflow
  - [ ] 7.2.2.2 Scaffolded course: Edit → Pack → Deploy workflow

## Success Criteria

- ✅ `skuilder studio <manifest.json>` launches successfully with manifest detection - **COMPLETED**
- ✅ `skuilder studio` (existing behavior) remains unchanged for scaffolded courses - **IMPLEMENTED**
- 🔄 Studio UI loads with course data from both input types - **IN PROGRESS**
- 🔄 Course editing works in studio interface for both modes - **PENDING**
- 🔄 "Flush to Static" writes changes back to correct location (manifest dir or project) - **PENDING**
- 🔄 MCP integration enables Claude Code course editing for both modes - **PENDING**
- ✅ Clear error messages distinguish between manifest and directory validation failures - **COMPLETED**
- ✅ Works with deployed docs course data via manifest path - **COMPLETED**

## Notes

### Key Advantages of Unified Command
- **Backward Compatible**: Existing workflows unchanged
- **Simpler**: Single command to learn and maintain
- **Flexible**: Auto-detects input type (directory vs manifest.json)
- **Practical**: Direct editing of deployed content without separate command

### Integration with Docs Pipeline
- Edit course content via `skuilder studio docs/public/static-courses/.../manifest.json`
- Changes flush to original manifest location
- Commit changes and redeploy docs
- Interactive demo updates automatically

### Technical Implementation Notes
- Manifest mode skips custom questions build for faster startup
- Uses existing unpack/flush mechanisms with path adjustments
- Preserves all existing CouchDB, Express, and MCP integration
- Single codebase maintains both workflows