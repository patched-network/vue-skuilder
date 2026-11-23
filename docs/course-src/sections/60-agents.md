---
section: agents
title: Agents (MCP)
pages: do/mcp
---

## intro agents-intro

**Skuilder speaks MCP.** An MCP server exposes one course to an agent: cards, data shapes and
their JSON schemas, tags and tag set operations, and navigation strategies, with tools to create,
tag and delete cards and to add strategies.

`npm run studio` writes a `.mcp.json`, so an agent started in your project can work on the course
you have open. Its edits reach your files only when you flush, so they arrive as a reviewable
diff.

[Read: Connect Agents](/vue-skuilder/do/mcp.html)

## card ag-scope elo=1000

The skuilder MCP server is scoped to {{one course||every course on a server|one learner}}.

## card ag-schema elo=1060

Before writing a card, an agent can read the data shape's {{JSON schema||Vue component|database index}}, and `create_card` validates against it.

## card ag-elo elo=1100

The ELO guidance asks an agent for "rough, sane sorting": rate new cards {{relative to existing cards in the course||on an absolute 0 to 100 scale}}.

## card ag-review elo=1040

In studio mode, an agent's edits reach your files only when you flush, so they {{show up in your diff for review||go straight to production}}.

## card ag-strategy elo=1120

Besides cards, an agent can add structure, such as a prerequisite graph over tags, with the {{create_strategy||tag_card|update_card}} tool.
