# TODO: Nominal Tag Types

## Status: NOT STARTED

## Problem

Tag identification in the codebase is ambiguous. Two representations are used interchangeably:

- **TagName**: Human-readable name (e.g., `"scales"`, `"C Major"`)
- **TagID**: Prefixed document ID (e.g., `"TAG-scales"`, `"TAG-C Major"`)

The `getTagID()` function normalizes between them:

```typescript
// packages/db/src/impl/couch/courseAPI.ts
export function getTagID(tagName: string): string {
  const tagPrefix = DocType.TAG.valueOf() + '-';
  if (tagName.indexOf(tagPrefix) === 0) {
    return tagName;
  } else {
    return tagPrefix + tagName;
  }
}
```

This defensive pattern (accepting either form) suggests the ambiguity causes friction. Function signatures like `getTag(courseID: string, tagName: string)` don't indicate whether they expect a name or ID.

## Proposed Solution: Branded Types

Use TypeScript branded types to distinguish tag names from tag IDs at compile time:

```typescript
// Branded type definitions
type TagName = string & { readonly __brand: 'TagName' };
type TagID = string & { readonly __brand: 'TagID' };

// Smart constructors
function tagName(s: string): TagName {
  // Strip prefix if present (normalize to name)
  const prefix = DocType.TAG.valueOf() + '-';
  return (s.startsWith(prefix) ? s.slice(prefix.length) : s) as TagName;
}

function tagID(name: TagName): TagID {
  return `${DocType.TAG.valueOf()}-${name}` as TagID;
}

// Now function signatures are self-documenting:
function getTag(courseID: string, tagName: TagName): Promise<Tag>;
function addTagToCard(courseID: string, cardID: string, tagID: TagID): Promise<Response>;
```

## Benefits

1. **Self-documenting APIs**: Function signatures indicate expected format
2. **Compile-time safety**: Can't accidentally pass a TagID where TagName expected
3. **Reduced defensive code**: No need for `getTagID()` normalization everywhere
4. **IDE support**: Autocomplete and type hints clarify intent

## Implementation Steps

### Step 1: Define Branded Types

- [ ] Create `packages/db/src/core/types/tagTypes.ts`
- [ ] Define `TagName` and `TagID` branded types
- [ ] Create smart constructors with normalization
- [ ] Export from `packages/db/src/core/types/index.ts`

### Step 2: Update Tag Interface

- [ ] Update `Tag.name` to be `TagName` type
- [ ] Update `Tag._id` typing if applicable

### Step 3: Update CourseDB Interface

- [ ] Update `getTag(tagName: TagName)`
- [ ] Update `createTag(tagName: TagName, ...)`
- [ ] Update `addTagToCard(cardId, tagId: TagID)`
- [ ] Update `removeTagFromCard(cardId, tagId: TagID)`

### Step 4: Update Implementations

- [ ] `packages/db/src/impl/couch/courseDB.ts`
- [ ] `packages/db/src/impl/couch/courseAPI.ts`
- [ ] `packages/db/src/impl/static/courseDB.ts` (if applicable)

### Step 5: Update Consumers

- [ ] Navigation strategies using tags
- [ ] Classroom tag assignments
- [ ] MCP tag resources
- [ ] UI components displaying/selecting tags

## Files Affected

| File | Changes |
|------|---------|
| `core/types/tagTypes.ts` | New file with branded types |
| `core/types/types-legacy.ts` | Update `Tag` interface |
| `core/interfaces/courseDB.ts` | Update method signatures |
| `impl/couch/courseAPI.ts` | Update `getTagID`, `addTagToCard` |
| `impl/couch/courseDB.ts` | Update tag-related functions |
| Multiple navigators | Update tag handling |

## Migration Strategy

1. Start with type definitions that are compatible with plain strings
2. Add branded types gradually, file by file
3. Use `as TagName` / `as TagID` at boundaries during migration
4. Tighten constraints once all code is updated

## Considerations

- **Runtime cost**: Zero - branded types are compile-time only
- **Breaking change**: Moderate - requires updating call sites
- **Effort**: Medium - touches many files but changes are mechanical

## Related

- `TagFilter` interface uses `string[]` for simplicity; could use `TagName[]` after this work
- Hierarchical tags (e.g., `"parent>child"`) may need additional consideration