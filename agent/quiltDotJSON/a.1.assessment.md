# Assessment: skuilder.json Specification

## Context

The user wants to create a `skuilder.json` specification to formally define what constitutes a Skuilder project, similar to how `package.json` defines an npm package.

## Current Project Analysis

### Existing Structure

The Vue Skuilder project currently uses `skuilder.config.json` with a basic structure:

```json
{
  "title": "Project Name",
  "dataLayerType": "static" | "couch",
  "course": "courseId-uuid",
  "couchdbUrl": "http://localhost:5984",
  "theme": {...}
}
```

### Identified Gaps

1. **Missing project metadata**: no version, author, description
2. **Fragmented configuration**: parameters scattered across different files
3. **Lack of validation**: no JSON schema for validation
4. **No dependency management**: Skuilder dependencies not specified
5. **Incomplete deployment configuration**: limited options

## Proposed Options

### Option 1: Minimal Extension
- Extend existing `skuilder.config.json`
- Add basic metadata and validation
- Minimal impact on existing projects

**Advantages:**
- Simple migration
- Backward compatibility
- Minimal changes

**Disadvantages:**
- Limited functionality
- No complete standardization

### Option 2: Complete Specification
- Create a new complete `skuilder.json` specification
- Include all aspects: metadata, configuration, deployment
- Complete JSON schema with validation

**Advantages:**
- Complete standardization
- Maximum flexibility
- Advanced tooling possible

**Disadvantages:**
- Migration required for existing projects
- Increased complexity

### Option 3: Hybrid Approach
- Maintain `skuilder.config.json` for compatibility
- Introduce optional `skuilder.json` with advanced features
- Progressive migration

**Advantages:**
- Smooth transition
- User choice
- Controlled evolution

**Disadvantages:**
- Two formats to maintain
- Potential confusion

## Unique Features to Specify

### 1. Course System
- Supported question types
- Learning data structure
- Educational metadata

### 2. Dual Data Layer
- Static vs dynamic configuration
- CouchDB parameters
- Synchronization

### 3. Educational Themes
- Business presets
- Visual customization
- Dark/light modes

### 4. Studio Tools
- Edit mode configuration
- Development parameters
- Pack/unpack workflow

### 5. Plugin Architecture
- Extensible question types
- Learning domains
- Custom components

## Key Specification Elements

### Proposed Structure

```json
{
  "$schema": "https://schema.skuilder.org/project/v1.0.json",
  "version": "1.0",
  "project": {
    "name": "string",
    "title": "string", 
    "description": "string",
    "version": "string",
    "author": "string",
    "license": "string"
  },
  "skuilder": {
    "version": "string",
    "type": "standalone" | "platform",
    "dataLayer": {
      "type": "static" | "couch",
      "static": {...},
      "couch": {...}
    }
  },
  "ui": {
    "theme": {...},
    "branding": {...},
    "features": {...}
  },
  "courses": {
    "registry": "string",
    "categories": ["string"],
    "questionTypes": ["string"],
    "dataShapes": ["string"]
  },
  "build": {...},
  "development": {...},
  "deployment": {...},
  "scripts": {...}
}
```

### Benefits of this Approach

1. **Standardization**: Consistent structure for all projects
2. **Validation**: JSON schema for automatic validation
3. **Tooling**: Auto-completion and validation in editors
4. **Flexibility**: Support for multiple configurations
5. **Scalability**: Versioning and automatic migration

## Recommendation

**I recommend Option 2: Complete Specification** for the following reasons:

1. **Necessary standardization**: The project is mature enough to benefit from a complete specification
2. **Advanced tooling**: A complete specification enables more sophisticated CLI tools
3. **Ecosystem**: Facilitates template creation and integration with other tools
4. **Documentation**: The specification serves as living documentation of the framework
5. **Manageable migration**: The CLI can automate migration from `skuilder.config.json`

### Recommended Next Steps

1. **Define complete JSON schema** with validation
2. **Create templates** for different project types
3. **Implement migration** from current format
4. **Develop tooling** (validation, auto-completion)
5. **Document** the specification with examples

This approach will position Vue Skuilder as a professional educational framework with clear standards and excellent developer experience.