# Connect Agents (MCP)

Vue-Skuilder provides a [Model Context Protocol](https://modelcontextprotocol.io) server that
exposes one course to an AI agent: its configuration, cards, data shapes, tags, and navigation
strategies, plus tools to author cards and strategies. The aim is **agent-assisted content
authoring** and **curriculum inspection**, with the human reviewing what the agent did.

::: info Status
The server and the tools below work today, against a CouchDB-backed course. Sections marked
*direction* describe where this is going and are not built.
:::

## Connecting

### Through studio mode

The easy path. `npm run studio` (see [Adding Content](./studio-mode)) starts a scratch CouchDB for
your course, prints the MCP command, and writes a `.mcp.json` to the directory you ran it from:

```json
{
  "mcpServers": {
    "vue-skuilder-studio": {
      "command": "./node_modules/@vue-skuilder/cli/dist/mcp-server.js",
      "args": ["<course-id>", "5985"],
      "env": {
        "COUCHDB_SERVER_URL": "localhost:5985",
        "COUCHDB_SERVER_PROTOCOL": "http",
        "COUCHDB_USERNAME": "admin",
        "COUCHDB_PASSWORD": "password"
      }
    }
  }
}
```

Start your agent (for example, Claude Code) in that directory and it can work on the open course.
Its changes go into the studio database, so they reach your static files only when you flush, and
show up in your diff.

### Against any CouchDB course

The same entry point works against any CouchDB course database; set the `COUCHDB_*` variables to
point at it. To embed the server in your own process, construct it from a course DB:

```typescript
import { MCPServer } from '@vue-skuilder/mcp';
import { initializeDataLayer, getDataLayer } from '@vue-skuilder/db';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

await initializeDataLayer({ type: 'couch', options: { /* COUCHDB_* settings */ } });
const courseDB = getDataLayer().getCourseDB('course-id');

const server = new MCPServer(courseDB, { maxCardsPerQuery: 50 });
await server.start(new StdioServerTransport());
```

## What the server offers

The server is **course-scoped**: one server, one course.

### Resources (read-only)

| URI | Returns |
|---|---|
| `course://config` | Course configuration and statistics |
| `cards://all` | Cards, paginated |
| `cards://tag/{tagName}` | Cards carrying a tag |
| `cards://shape/{shapeName}` | Cards of one data shape |
| `cards://elo/{min}-{max}` | Cards in an ELO range, e.g. `cards://elo/1000-1400` |
| `shapes://all`, `shapes://{shapeName}` | Data shapes and their fields |
| `schema://{dataShapeName}` | A data shape as JSON schema, for validating generated content |
| `tags://all`, `tags://stats`, `tags://distribution` | Tags, usage statistics, distribution |
| `tags://{tagName}` | One tag |
| `tags://union/{a}+{b}` | Cards with either tag |
| `tags://intersect/{a}+{b}` | Cards with both tags |
| `tags://exclusive/{a}-{b}` | Cards with the first tag but not the second |
| `strategies://all`, `strategies://{strategyId}` | Navigation strategy documents |
| `strategies://roles`, `strategies://role/{generator\|filter}` | Strategies by pipeline role |
| `strategies://schema/{implementingClass}` | The config schema for a strategy type |

### Tools

| Tool | Does |
|---|---|
| `create_card` | Create a card of a given data shape, with tags and a starting ELO; data is validated against the shape |
| `update_card` | Change a card's tags or ELO (data edits are not yet supported) |
| `tag_card` | Add or remove tags on a card, optionally adjusting its ELO |
| `delete_card` | Delete a card; requires `confirm: true` |
| `create_strategy` | Add a navigation strategy document (a generator or filter with its config) |

### Prompts

- `fill-in-card-authoring`: how to write cards in the default fill-in syntax (see
  [The Default Card Type](../learn/cards)).
- `elo-scoring-guidance`: how to choose starting ELO ratings.

## Design principles

**ELO-aware authoring.** An agent can't know a card's true difficulty, but it can place it sensibly
relative to the course. The guidance prompt asks for "rough, sane sorting": look at existing cards
in a range, then rate new ones relative to them. Learners' responses then refine card ratings
(on a CouchDB deployment; static courses freeze ratings at pack time).

**Shape-aware generation.** The agent reads a data shape's JSON schema before writing content, and
`create_card` validates against it, so generated cards are well-formed for their card type.

**Tags as the curriculum vocabulary.** Tags are how a course names its skills, and they are what
navigation strategies act on (prerequisites, interference, priority, skill pressure). Tag set
operations let an agent find gaps and overlaps; `create_strategy` lets it express structure, such
as a prerequisite graph over tags, as a strategy document the pipeline will run.

**Reviewable by a human.** Every operation is logged, and in studio mode every change lands in the
course files you commit, so agent work can be reviewed as a diff before it ships.

## Directions (not built)

These describe the intended path. None of the URIs or calls below exist yet.

### Source-linked content

`create_card` and `update_card` accept a `sourceRef` (for example,
`github.com/org/repo/blob/main/docs/api.md#L42-L58`), but it is not yet stored. The intent is to
peg cards to the source material they teach, so that when that source changes (a new API version,
a revised textbook section), an agent can find the affected cards from the diff, propose updates,
and flag stale ones.

### Feedback from learners

The MCP server reads course content but not learner outcomes. With read access to aggregate
performance (per-card success rates, common wrong answers, difficulty jumps between neighbouring
cards, tags where many learners stall), an agent could:

- write bridge cards where the difficulty curve has a gap;
- add scaffolding for skills where learners stall;
- propose prerequisite edges suggested by failure patterns.

### Larger authoring pipelines

Extraction from a source (a textbook, a codebase's API), card generation in several difficulty
variants, review by a second agent, and publication, each step scoped by the same course-level
tools. Multi-modal cards (audio, images) would need attachment support in `create_card`.

### A map for AI tutors

The directions above have agents authoring a course. The other direction is an LLM tutor using
one. A course holds an authored structure (cards, tags, prerequisite and hierarchy strategies) and
a learned one (card ratings; a learner's history and per-skill ratings; the provenance of each
card picked for them). Together they form a structured map of a domain and of one learner's place
in it, which a tutor could query as part of its retrieval and goal-setting: what this learner has
mastered, what comes next and why, which cards practise the step it is about to explain. Today the
MCP server exposes course content only, not learner state.

### Across courses

Recognising reusable content across courses, and adapting it per course. This depends on the
package and cross-course identity work described in [`skuilder.json`](../skuilder.json.md).
