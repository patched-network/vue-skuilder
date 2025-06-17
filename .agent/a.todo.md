# TODO: CLI Pack Command Binary Attachment Extraction

## Overview
Implement binary attachment extraction for the CLI pack command to create fully static, self-contained course data. Use document ID-namespaced directory structure to prevent filename collisions.

## Phase 1: Core Packer Enhancement (Critical Path) ✅ COMPLETED
**Location**: `packages/cli/src/commands/pack.ts` and `packages/db/src/util/packer/`

### 1.1 Extend CouchDBToStaticPacker Class ✅
- [x] Add `includeAttachments` handling to extract binary data (not just metadata)
- [x] Implement `extractDocumentAttachments()` method for binary file extraction  
- [x] Add document ID directory creation logic (`attachments/{docId}/`)
- [x] Transform attachment stubs to include relative file paths

### 1.2 Add CouchDB Attachment API Integration ✅
- [x] Implement attachment download via `/{db}/{docid}/{attname}` endpoint
- [x] Add basic error handling - fail fast on missing/corrupted attachments
- [x] Implement concurrent download (no rate limiting needed for MVP)

### 1.3 File System Operations ✅
- [x] Create attachment directory structure (`attachments/{docId}/`)
- [x] Generate proper filenames with extensions from content-type
- [x] Implement basic filename sanitization (via getFileExtension mapping)

### 1.4 Document Transformation Logic ✅
- [x] Update attachment stubs with file paths instead of `stub: true`
- [x] Preserve attachment metadata (content_type, length, digest)
- [x] Remove `revpos` and other CouchDB-specific fields
- [x] Ensure transformed documents work with static DB runtime

**Implementation Notes:**
- Added `AttachmentData` interface to handle binary data with metadata
- Enhanced `PackedCourseData` to include `attachments` Map  
- Used PouchDB's `getAttachment()` API for binary data extraction
- Implemented concurrent extraction with `Promise.all()`
- File extension mapping supports common media types (images, audio, video, documents)
- CLI outputs attachment count in success summary
- Both packages build and lint successfully


## Phase 2: Static Database Runtime Enhancement ✅ COMPLETED
**Location**: `packages/db/src/impl/static/`

### 2.1 Internal Static Runtime Enhancement ✅
- [x] Add internal attachment path resolution logic (no interface changes)
- [x] Ensure existing document serving works with new attachment path structure
- [x] Verify attachment URLs resolve correctly in existing frontend components

### 2.2 Update StaticDataUnpacker ✅
- [x] Add attachment path resolution logic
- [x] Support both browser (fetch) and Node.js (fs) environments
- [x] Implement attachment file loading (no caching needed for MVP)
- [x] Add error handling for missing attachment files

### 2.3 StaticCourseDB Enhancement ✅
- [x] Add helper methods for attachment URL resolution
- [x] Add helper methods for attachment blob loading
- [x] Keep methods internal (no interface changes)

**Implementation Notes:**
- Added `getAttachmentUrl()`, `getAttachmentPath()`, and `getAttachmentBlob()` methods to StaticDataUnpacker
- Uses same browser/Node.js file loading pattern as chunks and indices
- StaticCourseDB delegates to unpacker methods for attachment access
- Follows existing caching and error handling patterns
- No breaking changes to existing interfaces
- Package builds and lints successfully

## Phase 3: Frontend Integration and Testing
**Location**: Frontend components and content renderers

### 3.1 Update Content Rendering Components
- [ ] Verify `fillIn.vue` works with new attachment path structure
- [ ] Update any hardcoded attachment URL patterns
- [ ] Test image/audio rendering in static mode
- [ ] Ensure download functionality works with static attachments

### 3.2 Component Integration Testing
- [ ] Test `MediaDragDropUploader` created content renders in static mode
- [ ] Verify course components load attachments correctly
- [ ] Test attachment URL resolution across different deployment scenarios
- [ ] Validate attachment serving in standalone-ui environment

### 3.3 End-to-End Validation
- [ ] Pack a real course with diverse attachments (images, audio, documents)
- [ ] Deploy packed course to static hosting
- [ ] Verify all attachments load and display correctly
- [ ] Test performance with large attachment sets


## Implementation Notes

### Key File Locations
- **Packer Core**: `packages/db/src/util/packer/CouchDBToStaticPacker.ts`
- **CLI Command**: `packages/cli/src/commands/pack.ts`
- **Static Runtime**: `packages/db/src/static/StaticCourseDB.ts`
- **Types**: `packages/db/src/util/packer/types.ts`

### Testing Strategy
- **Unit Tests**: Test attachment extraction logic in isolation
- **Integration Tests**: Test full pack → static serve → render pipeline
- **Basic Error Tests**: Fail fast on network failures, missing attachments

### Rollback Strategy
- All changes are additive and backward compatible
- Existing static courses continue working without attachments
- `--no-attachments` flag preserves current behavior (unchanged)

### Dependencies
- No new external dependencies required
- Uses existing fetch/fs abstractions in static DB runtime
- Leverages existing CouchDB connection logic in packer

## Success Criteria
- [ ] CLI pack command extracts all binary attachments to document-namespaced directories
- [ ] Packed courses are fully self-contained with no CouchDB dependencies
- [ ] Static courses render all attachments correctly in standalone-ui
- [ ] Backward compatibility maintained for existing functionality
- [ ] Implementation fails fast and clearly on errors (no complex retry logic)