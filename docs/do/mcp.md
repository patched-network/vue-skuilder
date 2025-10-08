# Model Context Protocol (MCP) Server

Vue-Skuilder provides an MCP server that exposes course content and authoring capabilities to AI agents. This enables **agentic content authoring** and **intelligent curriculum management** at scale.

## Current Architecture

The MCP server is **course-scoped**, accepting a `CourseDBInterface` injection to provide isolated access to a specific course's content.

```typescript
import { MCPServer } from '@vue-skuilder/mcp';
import { getDataLayer } from '@vue-skuilder/db';

const courseDB = getDataLayer().getCourseDB('course-id');
const server = new MCPServer(courseDB, {
  enableSourceLinking: true,
  maxCardsPerQuery: 100,
  eloCalibrationMode: 'adaptive'
});
```

### Capabilities Overview

**14 Resources** (read-only data access):
- Course configuration and statistics
- Card querying with rich filtering (tags, DataShapes, ELO ranges)
- DataShape introspection and JSON schema generation
- Tag analytics and set operations (union/intersect/exclusive)

**4 Tools** (content management):
- `create_card` - Generate new cards with DataShape validation
- `update_card` - Modify existing cards (tags, ELO, data, sourceRef)
- `tag_card` - Bulk tag operations with ELO recalibration
- `delete_card` - Safe deletion with confirmation

**2 Prompts** (guided authoring):
- `fill-in-card-authoring` - Comprehensive guide for fill-in-the-blank cards
- `elo-scoring-guidance` - ELO calibration best practices

### Key Design Principles

**1. ELO-Aware Authoring**

The system guides agents to assign initial ELO ratings that provide "rough, sane sorting" (packages/mcp/src/prompts/elo-scoring-guidance.ts:21):

```typescript
// Agent queries existing course to establish baseline
const existingCards = await mcp.readResource('cards://elo/1000-1500');
const avgElo = existingCards.cards.reduce((sum, c) => sum + c.elo, 0) / existingCards.cards.length;

// Creates new cards relative to existing difficulty
await mcp.callTool('create_card', {
  datashape: 'fillIn',
  data: '...',
  elo: avgElo + 50  // Slightly harder than average
});
```

The platform then refines these ratings through **automated realtime adjustment** based on actual user performance (dual-dynamic ELO).

**2. DataShape-Aware Generation**

Agents query available DataShapes and their schemas:

```typescript
// Discover available question types
const shapes = await mcp.readResource('shapes://all');

// Get JSON schema for validation
const schema = await mcp.readResource('schema://Blanks');

// Generate compliant content
await mcp.callTool('create_card', {
  datashape: 'course.Blanks',
  data: { Input: '...' }  // Validated against schema
});
```

**3. Tag-Based Organization**

Rich tag operations enable sophisticated content discovery:

```typescript
// Find cards teaching BOTH concepts
const prereqCards = await mcp.readResource('tags://intersect/addition+subtraction');

// Find cards teaching EITHER concept
const relatedCards = await mcp.readResource('tags://union/multiplication+division');

// Find cards teaching X but NOT Y
const isolatedCards = await mcp.readResource('tags://exclusive/functions-recursion');
```

## Git-Based Content Provenance

The `sourceRef` field enables **real-time curriculum updates** tied to external source materials.

### Current State

`sourceRef` is defined in the tool schemas (packages/mcp/src/types/tools.ts:11) but **not yet fully implemented** in `update_card`. The infrastructure is in place for:

```typescript
await mcp.callTool('create_card', {
  datashape: 'fillIn',
  data: '...',
  sourceRef: 'github.com/org/repo/blob/main/docs/api.md#L42-L58'
});
```

### Planned Capabilities

**1. Source Line Tracking**

Cards "pegged" to specific lines in external repositories:

```typescript
{
  cardId: 'card-abc',
  sourceRef: {
    repo: 'github.com/kubernetes/kubernetes',
    path: 'docs/concepts/workloads/pods.md',
    lines: '15-30',
    commitHash: 'a1b2c3d4'
  }
}
```

**2. Git Diff-Based Updates**

When source material changes, agents identify affected cards:

```typescript
// Fetch git diff
const diff = await fetchGitDiff('kubernetes/kubernetes', 'main', 'v1.29.0');

// Find affected cards via sourceRef
const affectedCards = await findCardsBySourceRef(diff.changedFiles);

// Agent reviews changes and updates cards
for (const card of affectedCards) {
  const updatedContent = await agent.adaptToSourceChange(
    card.data,
    diff.getChangesForFile(card.sourceRef.path)
  );

  await mcp.callTool('update_card', {
    cardId: card.id,
    data: updatedContent,
    sourceRef: updateCommitHash(card.sourceRef, diff.newCommit)
  });
}
```

**3. Curriculum Staleness Detection**

Agents monitor source repositories and flag outdated content:

```typescript
// Daily scan
const staleCards = await courseDB.getCardsWhere(
  card => isSourceRefStale(card.sourceRef, maxDaysOld = 90)
);

// Notify maintainers or auto-update
await agent.reviewAndUpdateStaleCards(staleCards);
```

## Agentic Content Authoring

The MCP server enables **retrieval-augmented curriculum development** at scale.

### Use Case: Textbook → Interactive Course

**Phase 1: Content Extraction**

Agent parses source material and identifies pedagogical units:

```typescript
// Extract chapters, sections, concepts from PDF/markdown
const textbook = await parseSource('linear-algebra-textbook.pdf');

for (const chapter of textbook.chapters) {
  // Identify key concepts
  const concepts = await agent.extractConcepts(chapter);

  // Generate tags for concept graph
  const tags = concepts.map(c => c.name.toLowerCase().replace(/\s/g, '-'));

  // Create tag documents with descriptions
  for (const concept of concepts) {
    await courseDB.createTag(concept.name, 'agent');
    await courseDB.updateTag({
      name: concept.name,
      snippet: concept.definition,
      wiki: concept.detailedExplanation
    });
  }
}
```

**Phase 2: Card Generation**

Agent creates cards using `fill-in-card-authoring` prompt guidance:

```typescript
for (const concept of concepts) {
  // Query for relative ELO based on existing cards
  const similarCards = await mcp.readResource(`tags://all/${concept.name}`);
  const baseElo = similarCards.avgElo || 1000;

  // Generate multiple difficulty variants
  const variants = await agent.generateCardVariants(concept, [
    { type: 'definition', elo: baseElo - 200 },
    { type: 'application', elo: baseElo },
    { type: 'problem-solving', elo: baseElo + 300 }
  ]);

  for (const variant of variants) {
    await mcp.callTool('create_card', {
      datashape: 'fillIn',
      data: variant.content,
      tags: [concept.name, ...variant.additionalTags],
      elo: variant.elo,
      sourceRef: `textbook.pdf#page-${concept.pageNumber}`
    });
  }
}
```

**Phase 3: Concept Dependency Mapping**

Agent builds prerequisite graph for custom `ContentNavigator`:

```typescript
// Analyze concept relationships
const dependencies = await agent.inferPrerequisites(concepts);

// Create navigation strategy document
await courseDB.createNavigationStrategy({
  name: 'LinearAlgebraDependencies',
  implementingClass: 'conceptDependency',
  serializedData: JSON.stringify({
    graph: dependencies,
    unlockThreshold: 0.8  // 80% mastery to unlock dependents
  })
});
```

### Use Case: Codebase Documentation → API Course

**Ingest Phase**

```typescript
// Parse TypeScript project
const project = await parseTypeScriptProject('path/to/repo');

for (const classDecl of project.classes) {
  // Extract methods and their documentation
  for (const method of classDecl.methods) {
    const jsdoc = extractJSDoc(method);

    await mcp.callTool('create_card', {
      datashape: 'fillIn',
      data: generateAPICard(classDecl.name, method, jsdoc),
      tags: ['api', classDecl.name.toLowerCase(), method.name],
      elo: inferEloFromComplexity(method),
      sourceRef: `${classDecl.file}#L${method.startLine}-L${method.endLine}`
    });
  }
}
```

**Update Phase** (when API changes)

```typescript
// Watch for commits
const latestCommit = await fetchLatestCommit('org/repo');

// Find affected API methods via git diff
const apiChanges = await parseAPIDiff(latestCommit.diff);

for (const change of apiChanges) {
  // Find cards referencing this API
  const affectedCards = await findCardsBySourceRef(change.file, change.lines);

  for (const card of affectedCards) {
    if (change.type === 'removed') {
      // Archive deprecated API cards
      await mcp.callTool('tag_card', {
        cardId: card.id,
        action: 'add',
        tags: ['deprecated', `removed-in-${latestCommit.version}`]
      });
    } else if (change.type === 'modified') {
      // Update card content
      const updatedCard = await agent.adaptCardToAPIChange(card, change);
      await mcp.callTool('update_card', {
        cardId: card.id,
        data: updatedCard,
        sourceRef: updateLineNumbers(card.sourceRef, change.lineDelta)
      });
    }
  }
}
```

## Pedagogical Integration

The MCP server provides **read-only access to student data** for curriculum analysis and intervention (planned).

### Student Flow Analysis

**Aggregate Performance Metrics**

```typescript
// Resource: `analytics://cards/{cardId}/performance`
{
  cardId: 'card-123',
  attempts: 1523,
  successRate: 0.67,
  avgTimeSpent: 8.2,  // seconds
  eloConvergence: {
    initial: 1200,
    current: 1450,
    stdDev: 120
  },
  commonErrors: [
    { userAnswer: 'O(n²)', count: 234 },
    { userAnswer: 'O(n)', count: 89 }
  ]
}
```

**Gap Detection**

Agent identifies difficulty spikes in card sequences:

```typescript
const cardsByElo = await mcp.readResource('cards://all?sort=elo');

const gaps = [];
for (let i = 1; i < cardsByElo.cards.length; i++) {
  const eloDelta = cardsByElo.cards[i].elo - cardsByElo.cards[i-1].elo;
  if (eloDelta > 300) {  // Large jump
    gaps.push({
      before: cardsByElo.cards[i-1],
      after: cardsByElo.cards[i],
      delta: eloDelta,
      tags: intersection(cardsByElo.cards[i-1].tags, cardsByElo.cards[i].tags)
    });
  }
}

// Generate intermediate cards to fill gaps
for (const gap of gaps) {
  const bridgeCards = await agent.generateBridgeContent(
    gap.before,
    gap.after,
    targetElo = (gap.before.elo + gap.after.elo) / 2
  );

  for (const card of bridgeCards) {
    await mcp.callTool('create_card', card);
  }
}
```

### Personalized Interventions

**Tag-Specific Scaffolding**

When users struggle with specific concepts, agents inject targeted support:

```typescript
// Resource: `analytics://users/{userId}/weak-tags`
{
  userId: 'user-42',
  weakTags: [
    { tag: 'pointers', eloGap: -250, failureRate: 0.45 },
    { tag: 'recursion', eloGap: -180, failureRate: 0.38 }
  ]
}

// Agent creates custom intervention cards
for (const weakness of weakTags) {
  // Find easier cards on the same topic
  const scaffoldCards = await mcp.readResource(
    `cards://tag/${weakness.tag}?elo=${userElo - 200}-${userElo - 100}`
  );

  if (scaffoldCards.cards.length < 5) {
    // Generate additional scaffolding
    const newCards = await agent.generateScaffoldContent(
      weakness.tag,
      targetElo = userElo - 150,
      count = 5
    );

    for (const card of newCards) {
      await mcp.callTool('create_card', {
        ...card,
        tags: [...card.tags, `scaffold-${userId}`, 'auto-generated']
      });
    }
  }

  // Inject into user's custom ContentNavigator
  await userDB.updateNavigationStrategy(userId, {
    type: 'intervention',
    target: weakness.tag,
    cards: scaffoldCards.cards.map(c => c.id)
  });
}
```

**Concept Prerequisite Enforcement**

Agent analyzes failure patterns to identify missing prerequisites:

```typescript
// User fails cards tagged "binary-search-trees"
const failures = await fetchFailures(userId, 'binary-search-trees');

// Agent checks if user has mastered prerequisites
const prerequisites = ['recursion', 'linked-lists', 'tree-traversal'];
const userMastery = await checkTagMastery(userId, prerequisites);

const unmetPrereqs = userMastery.filter(p => p.eloGap < -100);

if (unmetPrereqs.length > 0) {
  // Create custom navigation strategy
  await userDB.setNavigationStrategy(userId, {
    name: 'PrerequisiteRemediation',
    implementingClass: 'prerequisiteEnforcement',
    serializedData: JSON.stringify({
      targetConcept: 'binary-search-trees',
      requiredTags: unmetPrereqs.map(p => p.tag),
      minMasteryThreshold: 0.75
    })
  });
}
```

## Architecture Benefits

### 1. Declarative Content Generation

Agents describe desired content; MCP handles storage, validation, and ELO integration:

```typescript
// Agent focuses on pedagogy, not database operations
await mcp.callTool('create_card', {
  datashape: 'fillIn',
  data: generateQuestion(concept),
  tags: inferTags(concept),
  elo: estimateDifficulty(concept)
});
```

### 2. Course-Level Isolation

MCP servers are scoped to individual courses, enabling:
- Multi-tenant agent deployments
- Course-specific authoring styles
- Independent curriculum evolution

### 3. Feedback Loop Integration

MCP connects authoring with pedagogy (planned):

```typescript
// Agent creates cards
await agent.generateCurriculum(sourceContent);

// Users study cards
await studySession.run();

// Agent observes outcomes
const analytics = await mcp.readResource('analytics://cards/recent');

// Agent refines curriculum
await agent.patchCurriculumBasedOnData(analytics);
```

### 4. Human-in-the-Loop

MCP operations are **logged and auditable** (packages/mcp/src/server.ts:84):

```typescript
this.logger.info(`MCP Server: Creating card with datashape '${input.datashape}'`);
```

Enabling humans to:
- Review agent-generated content
- Override ELO assignments
- Flag problematic cards
- Approve bulk operations

## Future Directions

### 1. Streaming Card Generation

Real-time curriculum authoring with progress feedback:

```typescript
const stream = agent.generateCurriculumStream(textbook);

for await (const card of stream) {
  await mcp.callTool('create_card', card);
  console.log(`Created ${stream.completed}/${stream.total} cards`);
}
```

### 2. Multi-Modal Content

Extend MCP to support image, audio, and video attachments:

```typescript
await mcp.callTool('create_card', {
  datashape: 'Piano_Echo',
  data: { melody: [60, 62, 64, 65] },
  attachments: {
    'reference.mp3': await fetchAudio(url)
  },
  sourceRef: 'music-theory-book.pdf#page-42'
});
```

### 3. Collaborative Authoring

Multiple agents with specialized roles:

```typescript
// Content extraction agent
const concepts = await extractorAgent.parse(textbook);

// Card generation agent
const draftCards = await authorAgent.generateCards(concepts);

// Review agent
const approvedCards = await reviewAgent.validate(draftCards);

// Publishing agent
for (const card of approvedCards) {
  await mcp.callTool('create_card', card);
}
```

### 4. Cross-Course Knowledge Transfer

Agents identify reusable content across courses:

```typescript
// Agent recognizes "sorting algorithms" appears in multiple courses
const sortingCards = await mcp.readResource('tags://all/sorting');

// Generates course-specific variants
await agent.adaptCardsForCourse(sortingCards, 'intro-cs');
await agent.adaptCardsForCourse(sortingCards, 'algorithms-advanced');
```

---

## Summary

The MCP server transforms Vue-Skuilder into a **platform for intelligent curriculum development**:

**Today**: Agents author content with DataShape validation, ELO guidance, and tag-based organization.

**Tomorrow**: Agents maintain living curricula that evolve with source materials, adapt to student performance, and provide personalized interventions.

**The Vision**: A future where educational content is **dynamically generated**, **continuously refined**, and **individually optimized** through human-agent collaboration.

The MCP server provides the foundation for this vision by exposing Vue-Skuilder's rich pedagogical infrastructure to AI systems while maintaining the platform's commitment to data-driven, research-friendly adaptive learning.
