# Plan: Static DB Implementation for Navigation Strategies

**Objective**: Port the dynamic navigation strategy logic to the `static` data layer implementation to ensure feature parity for read-only operations.

**Background**: The `static` data layer is a read-only implementation used for packaged courses. All course data, including navigation strategies, must be pre-processed and included in the static course bundle by the `CouchDBToStaticPacker`.

### Required Changes

1.  **Update `CouchDBToStaticPacker`**:
    *   The packer, located at `packages/db/src/util/packer/CouchDBToStaticPacker.ts`, must be updated to find and include documents of type `DocType.NAVIGATION_STRATEGY`.
    *   These documents should be added to the data chunks, and the `manifest.json` must be updated to reflect their inclusion.

2.  **Implement `getNavigationStrategy` in `StaticCourseDB`**:
    *   The method in `packages/db/src/impl/static/courseDB.ts` needs to be implemented.
    *   It will receive a strategy ID and use the `StaticDataUnpacker` to find and return the corresponding strategy document from the loaded chunk data.

3.  **Implement `surfaceNavigationStrategy` in `StaticCourseDB`**:
    *   This method also needs to be implemented in `packages/db/src/impl/static/courseDB.ts`.
    *   It should read the `defaultNavigationStrategyId` from the `CourseConfig` object, which is stored in the course `manifest.json`.
    *   It will then call its own `getNavigationStrategy` method to fetch the correct strategy data.
    *   If no ID is specified, it should fall back to the default ELO strategy, just like the CouchDB implementation.

### Action Items

- [ ] Update `CouchDBToStaticPacker` to include `NAVIGATION_STRATEGY` documents in the static course bundle.
- [ ] Implement `getNavigationStrategy` in `packages/db/src/impl/static/courseDB.ts`.
- [ ] Implement `surfaceNavigationStrategy` in `packages/db/src/impl/static/courseDB.ts`.
