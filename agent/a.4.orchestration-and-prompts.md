# Assessment: Orchestration & Prompts for MCP Content Mining

## Context & Requirements Synthesis

### User Priorities Identified
1. **Two Primary Mining Modes**:
   - **Greenfield content mining** - Starting from scratch with new source material
   - **Diff content mining** - Analyzing changes/updates to existing content
2. **Rough ELO estimation** - Platform handles real-time convergence, agents provide sane initial sorting
3. **Leverage existing patterns** from `@packages/edit-ui/src/components/BulkImportView.vue`
4. **Atomic tool composition** - Agents orchestrate using create_card, update_card, etc.
5. **Flexible guidance** - Prompts suggest strategies without rigid constraints

### Existing Bulk Import Knowledge
From `/agent/mcp/prompt-bulk.md`, the platform already has:
- **Detailed fillIn formatting rules** - `{{answer}}`, `{{multiple|options}}`, `{{correct||distractor1|distractor2}}`
- **ELO calibration guidelines** - 100-500 beginner, 500-1000 early, 1000-1500 intermediate, etc.
- **Tag formatting conventions** - no spaces, dots/hyphens allowed, comma-separated
- **Card separation syntax** - double `---` lines
- **Markdown support** - code blocks, formatting within questions and answers
- **Content best practices** - concise answers, clear questions, code examples

## MCP Prompts vs Tools Analysis

### Why Prompts Are Superior for Content Mining

**MCP Prompts provide:**
- ✅ **Expert guidance** without execution constraints  
- ✅ **Parameter customization** for different contexts
- ✅ **Agent autonomy** - can adapt, combine, or ignore advice
- ✅ **Composability** - work with agent's own intelligence
- ✅ **Maintainability** - easy to update expertise without code changes

**Compared to orchestrator tools which would:**
- ❌ **Lock in rigid workflows** that may not fit all scenarios
- ❌ **Hide decision-making** from agent reasoning
- ❌ **Create debugging complexity** with nested tool calls
- ❌ **Limit creativity** with predefined patterns

### Agent Decision Process for Prompts

**Agent prompt selection workflow:**
1. **User request analysis** - "Generate quizzes from this Go codebase"
2. **Available prompts discovery** - Lists MCP prompts via protocol
3. **Context matching** - Identifies this as greenfield mining scenario
4. **Prompt invocation** - Calls `greenfield_content_mining` with repo context
5. **Guidance integration** - Synthesizes prompt advice with own reasoning
6. **Tool orchestration** - Uses create_card, tag_card atomically following strategy

## Proposed MCP Prompt Architecture

### Core Prompt Templates (4 Essential)

#### 1. `greenfield_content_mining`
**Purpose:** Guide systematic analysis of new source material for comprehensive courseware creation

**Parameters:**
- `sourceType` - "codebase", "documentation", "tutorials", "papers"
- `domain` - "programming", "math", "science", etc.
- `targetAudience` - "beginner", "intermediate", "advanced"
- `scopeConstraint` - "single-file", "module", "full-project"

**Template provides:**
- **Repository structure analysis** - How to identify key concepts vs implementation details
- **Content prioritization** - Core concepts first, edge cases later
- **Knowledge dependency mapping** - Prerequisites and logical sequencing
- **Coverage strategies** - Breadth vs depth decisions
- **ELO estimation guidance** - Initial difficulty assessment based on concept complexity

#### 2. `diff_content_mining` 
**Purpose:** Guide analysis of changes/updates to identify new quiz opportunities

**Parameters:**
- `changeType` - "feature-addition", "refactor", "bug-fix", "docs-update"
- `diffScope` - "lines-changed", "files-affected", "concepts-modified"
- `existingCoverage` - "sparse", "moderate", "comprehensive"

**Template provides:**
- **Change impact analysis** - What concepts are newly introduced vs modified
- **Gap identification** - What existing cards need updates vs new creation
- **Incremental strategies** - How to build on existing content
- **Deprecation handling** - Managing outdated concepts
- **Version tracking** - Linking content to specific code versions

#### 3. `fillIn_question_crafting`
**Purpose:** Guide creation of effective fill-in-the-blank questions using Vue-Skuilder syntax

**Parameters:**
- `contentType` - "code", "theory", "api-usage", "troubleshooting"  
- `cognitiveLevel` - "recall", "application", "analysis", "synthesis"
- `answerComplexity` - "single-word", "short-phrase", "code-snippet"

**Template provides:**
- **Format patterns** from bulk import experience:
  - `{{simple_answer}}` for direct recall
  - `{{option1|option2}}` for multiple acceptable answers
  - `{{correct||distractor1|distractor2}}` for multiple choice
- **Code integration best practices** - Balancing context with focused questions
- **Answer entropy management** - Keeping answers matchable while meaningful
- **Distractor selection** - Common mistakes and plausible alternatives

#### 4. `elo_rough_calibration`
**Purpose:** Guide initial ELO estimation knowing real-world performance will refine

**Parameters:**
- `conceptComplexity` - "fundamental", "applied", "nuanced", "edge-case"
- `prerequisiteDepth` - "none", "basic", "substantial", "advanced"  
- `cognitiveLoad` - "recall", "comprehension", "application", "analysis"

**Template provides:**
- **Initial ELO bands** refined from bulk import guidelines:
  - 100-500: Basic vocabulary, simple facts
  - 500-1000: Applied knowledge, straightforward procedures  
  - 1000-1500: Integration concepts, moderate problem-solving
  - 1500-2000: Complex applications, multi-step reasoning
  - 2000+: Expert insights, edge cases, advanced synthesis
- **Comparative benchmarking** - How to assess relative to existing content
- **Uncertainty handling** - When to err conservative vs aggressive
- **Refinement expectations** - Understanding platform will auto-adjust

## Prompt Implementation Strategy

### MCP Technical Integration

**Prompt registration pattern:**
```typescript
this.mcpServer.registerPrompt(
  'greenfield_content_mining',
  {
    title: 'Greenfield Content Mining Strategy',
    description: 'Systematic approach for mining new source material',
    arguments: [
      { name: 'sourceType', description: 'Type of source material being analyzed' },
      { name: 'domain', description: 'Subject domain of the content' },
      { name: 'targetAudience', description: 'Intended learning audience level' },
      { name: 'scopeConstraint', description: 'Scope of analysis (file, module, project)' }
    ]
  },
  async (args) => ({
    messages: [
      {
        role: 'user', 
        content: generateGreenfield ContentMiningPrompt(args)
      }
    ]
  })
);
```

### Content Strategy

**Prompts should contain:**
- ✅ **Structured methodologies** - Step-by-step approaches
- ✅ **Decision frameworks** - When to choose different strategies
- ✅ **Quality criteria** - What makes good vs poor questions
- ✅ **Practical examples** - Concrete patterns for different content types
- ✅ **Vue-Skuilder specific** - Leverage platform features and conventions

**Prompts should NOT contain:**
- ❌ **Rigid scripts** - Agents need flexibility
- ❌ **Implementation details** - Keep focused on strategy
- ❌ **Tool invocation** - Agents decide when to use create_card, etc.
- ❌ **Fixed sequences** - Allow for creative orchestration

## Organizational Benefits

### Separation of Concerns
- **Prompts**: Domain expertise and strategy guidance
- **Agent**: Intelligence, creativity, and orchestration
- **Tools**: Atomic operations (create, update, tag, delete)
- **Platform**: Real-time ELO convergence and performance tracking

### Maintainability  
- **Prompt updates** don't require code changes
- **Strategy evolution** can be managed independently
- **Domain expertise** centralized and reusable
- **Testing simplified** - prompts testable in isolation

### Scalability
- **New domains** just need new prompt templates
- **Different agent types** can use same prompt guidance
- **Cross-platform portability** via MCP standard
- **Expertise sharing** across agent implementations

## Recommendation

Implement the 4 core prompt templates as Phase 2.2, replacing the complex orchestrator tool approach. This provides the perfect balance of expert guidance with agent autonomy, leveraging existing Vue-Skuilder patterns while maintaining full flexibility for creative content mining strategies.

The agent can then choose appropriate prompts based on context, synthesize the guidance with their own reasoning, and execute via the atomic tools we've already implemented.