/* eslint-disable max-len */
export function createEloScoringGuidancePrompt(): string {
  return `# GUIDE: ELO Scoring for Content

This guide provides guidance for agents on assigning ELO ratings to content. The ELO system helps provide initial difficulty sorting for new content.

## Understanding ELO Ratings

ELO ratings use a chess-like rating scale to indicate content difficulty:

- **100-500**: Beginner level, basic knowledge
- **500-1000**: Some knowledge, early understanding
- **1000-1500**: Intermediate knowledge
- **1500-2000**: Advanced understanding
- **2000-2400**: Expert level
- **2400+**: Elite/master level

## Key Principles

### 1. Rough Initial Sorting
- Your ELO assignments provide **rough, sane sorting** of new content
- Aim for reasonable relative difficulty between cards, not perfect precision
- The system will refine these ratings over time based on real-world performance

### 2. Automated Refinement
- The platform performs **automated realtime adjustment** of ELO ratings based on actual user performance
- This convergence forcing function holds **most of the responsibility** for arranging relative difficulty
- Your initial ratings serve as a starting point, not the final word

### 3. Content-Based Guidelines

#### Basic Knowledge (100-500)
- Simple facts and definitions
- Basic vocabulary
- Elementary concepts
- **Example**: "The capital of France is {{Paris}}"

#### Early Understanding (500-1000)
- Simple applications of concepts
- Basic problem-solving
- Common patterns and rules
- **Example**: "In JavaScript, use {{let|var}} to declare a reassignable variable"

#### Intermediate Knowledge (1000-1500)
- More complex applications
- Understanding relationships between concepts
- Moderate problem-solving skills
- **Example**: "Which sorting algorithm has O(n log n) average time complexity? {{mergesort|heapsort||bubblesort|insertionsort}}"

#### Advanced Understanding (1500-2000)
- Complex problem-solving
- Deep conceptual understanding
- Advanced techniques and patterns
- **Example**: "In Go, what happens when you close a channel that's already closed? {{runtime panic||returns false|blocks forever|does nothing}}"

#### Expert Level (2000-2400)
- Specialized knowledge
- Advanced edge cases
- Professional-level understanding
- **Example**: "What's the difference between TCP_NODELAY and TCP_CORK socket options?"

#### Elite/Master Level (2400+)
- Cutting-edge knowledge
- Rare edge cases
- Research-level understanding
- **Example**: "How does the Linux kernel's CFS scheduler handle nice values in relation to vruntime calculations?"

## Practical Application

### When Assigning ELO Ratings:

1. **Consider the target audience**: Who would reasonably be expected to know this?
2. **Assess cognitive load**: How much thinking/reasoning is required?
3. **Evaluate prerequisite knowledge**: What must someone know first?
4. **Compare relatively**: Is this harder or easier than other cards on similar topics?

### Common Patterns:

- **Definitions and facts**: Usually 100-800
- **Basic syntax/usage**: Usually 400-1200
- **Concept application**: Usually 800-1600
- **Problem-solving**: Usually 1200-2000
- **Advanced techniques**: Usually 1600-2400+

## Establishing Goalposts for Agentic Runs

### Reference Live Course Data
When appending data to existing courses, try to use existing data to understand the baseline against which we create. ELO is relative and not absolute.

1. **Query existing course statistics** using available MCP resources:
   - \`course://config\` - Get overall course ELO distribution
   - \`tags://stats\` - Understand tag usage patterns
   - \`cards://elo/{range}\` - Sample cards in different difficulty ranges

2. **Establish relative ranges** based on existing content:
   - If the course has cards ranging 800-1600, aim for similar distribution
   - If creating beginner content for an advanced course, adjust baseline accordingly
   - Use tag-specific ELO patterns to inform ratings for similar topics

### Example Goalpost Process
\`\`\`
1. Query: cards://elo/1000-1500 (check intermediate range)
2. Observe: 23 cards average 1250 ELO on "javascript" tag
3. Target: New JavaScript cards should cluster around 1200-1300
4. Create: Cards with relative difficulty within established range
\`\`\`

## Remember

- **It's okay to be approximate** - the system will adjust based on real performance
- **Consistency matters more than perfection** - try to be consistent within topic areas
- **Focus on relative difficulty** - how does this compare to other cards you've created? re: factual content - specialization matters - more esoteric knowledge should be rated higher
- **Use live data as your anchor** - let existing course content guide your rating decisions

Your ELO assignments provide the initial scaffolding that allows the platform's adaptive algorithms to efficiently converge on optimal difficulty ratings.`;
}
