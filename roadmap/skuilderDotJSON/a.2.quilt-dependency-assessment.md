# Assessment: Quilt-Based Content Dependency System

## Context

The goal is to create a `quilt.json` specification that enables educational content sharing and dependency management. This allows courses to depend on and reuse content from other courses without duplication, while maintaining clear interfaces for content consumption.

## Use Case Example

A Doomsday algorithm course needs modular arithmetic (mod 7) content. Instead of duplicating this content, it should be able to:
- Declare a dependency on a `math` quilt
- Specify it only needs the `mod7` subset
- Let the math course determine how to best serve that need

## Core Architecture

### ContentSource Interface Analysis

From `@packages/db/src/core/interfaces/contentSource.ts`, the key interface is:

```typescript
export interface StudyContentSource {
  getPendingReviews(): Promise<(StudySessionReviewItem & ScheduledCard)[]>;
  getNewCards(n?: number): Promise<StudySessionNewItem[]>;
}
```

### Proposed Quilt Structure

```json
{
  "serviceDef": {
    "name": "ContentSource",
    "version": "1.0",
    "adapter": "StaticDataLayerProvider"
  },
  "metadata": {
    "id": "math-core-v1",
    "name": "Core Mathematics",
    "version": "1.0.0",
    "description": "Foundational math concepts",
    "author": "...",
    "license": "..."
  },
  "provides": {
    "skills": [
      {
        "id": "modular-arithmetic",
        "name": "Modular Arithmetic",
        "subsets": ["mod7", "mod12", "general-modular"]
      },
      {
        "id": "basic-algebra",
        "name": "Basic Algebra",
        "subsets": ["linear-equations", "quadratic-equations"]
      }
    ]
  },
  "dependencies": {
    "requires": [
      {
        "quilt": "arithmetic-basics",
        "version": "^1.0.0",
        "skills": ["addition", "subtraction", "multiplication"]
      }
    ],
    "suggests": [
      {
        "quilt": "number-theory",
        "version": "^2.0.0",
        "skills": ["prime-factorization"],
        "reason": "Enhanced explanations for modular arithmetic"
      }
    ]
  },
  "content": {
    "source": {
      "type": "static",
      "path": "./courses/math-core"
    },
    "index": {
      "skills": {
        "modular-arithmetic": {
          "cards": ["mod-intro-001", "mod7-examples-001", "mod7-practice-001"],
          "prerequisites": ["multiplication", "division-remainder"],
          "difficulty": "intermediate"
        }
      }
    }
  }
}
```

## Key Components

### 1. Service Definition
- **Interface compatibility**: Which ContentSource version this quilt implements
- **Adapter specification**: How the quilt's data gets consumed (StaticDataLayerProvider, CouchDataLayerProvider, etc.)

### 2. Skill Taxonomy
- **Provides**: What educational skills/concepts this quilt offers
- **Subsets**: Granular divisions of skills for precise dependency management
- **Prerequisites**: Skills needed before accessing this content

### 3. Dependency Management
- **Requires**: Hard dependencies on other quilts
- **Suggests**: Soft dependencies that enhance the experience
- **Version constraints**: Semantic versioning for compatibility

### 4. Content Mapping
- **Source location**: Where the actual content lives
- **Skill indexing**: Maps skills to specific cards/content
- **Metadata**: Difficulty, prerequisites, learning objectives

## Implementation Considerations

### Content Discovery
```typescript
interface QuiltRegistry {
  findQuiltsBySkill(skill: string): Promise<QuiltDescriptor[]>;
  resolveQuilt(id: string, version: string): Promise<QuiltInstance>;
  validateDependencies(quilt: QuiltDescriptor): Promise<ValidationResult>;
}
```

### Dependency Resolution
```typescript
interface DependencyResolver {
  resolveSkillChain(requiredSkills: string[]): Promise<ContentPlan>;
  buildStudySession(plan: ContentPlan, user: UserDBInterface): Promise<StudyContentSource>;
}
```

### Content Filtering
```typescript
interface ContentFilter {
  filterBySkills(source: StudyContentSource, skills: string[]): StudyContentSource;
  filterByDifficulty(source: StudyContentSource, level: DifficultyLevel): StudyContentSource;
  filterByPrerequisites(source: StudyContentSource, userSkills: string[]): StudyContentSource;
}
```

## Benefits

### 1. Content Reusability
- Courses can share foundational content without duplication
- Specialized courses can focus on their unique value-add
- Consistent presentation of core concepts across the ecosystem

### 2. Modular Architecture
- Clean separation of concerns
- Easier maintenance and updates
- Scalable content ecosystem

### 3. Adaptive Learning
- Precise skill targeting
- Prerequisite enforcement
- Intelligent content recommendations

### 4. Ecosystem Growth
- Lower barrier to creating specialized courses
- Encourages contribution to shared knowledge bases
- Natural evolution toward comprehensive curriculum coverage

## Challenges

### 1. Skill Taxonomy Standardization
- Need agreed-upon skill identifiers
- Difficulty levels must be consistent
- Prerequisite relationships need validation

### 2. Content Quality Assurance
- Ensure dependencies provide quality content
- Version compatibility across skill updates
- Consistent learning experience across quilts

### 3. Performance Implications
- Dependency resolution complexity
- Content loading from multiple sources
- Caching strategies for composed content

## Recommendation

This quilt-based approach addresses a real architectural need in educational content systems. It enables:

1. **Composable curricula** where courses can be built from reusable skill-based components
2. **Efficient content creation** by leveraging existing, well-tested educational content
3. **Consistent learning experiences** through standardized skill taxonomies
4. **Scalable content ecosystems** that grow organically

The proposed structure balances flexibility with standardization, providing clear interfaces while allowing for diverse content sources and presentation styles.

### Next Steps

1. **Define core skill taxonomy** for foundational subjects
2. **Implement dependency resolver** in the CLI
3. **Create quilt registry** for content discovery
4. **Build content filtering system** for subset selection
5. **Develop migration tools** to convert existing courses to quilts

This approach transforms Vue Skuilder from a course platform into a composable educational content ecosystem.