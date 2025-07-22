# MCP Server Configuration

## Adding the Vue-Skuilder MCP Server to Claude Code

### Local Configuration (Default)

For personal use, add the server to your local configuration:

```bash
claude mcp add stumcptmp node "~/pn/vue-skuilder/studio-mcp/packages/cli/dist/mcp-server.js 2aeb8315ef78f3e89ca386992d00825b"
```

### Project Configuration (Shared)

For team collaboration, configure the server to project scope so it's shared via `.mcp.json`. You can either use the CLI command or create the file directly.

#### Using CLI Command

```bash
claude mcp add stumcptmp -s project node "./packages/cli/dist/mcp-server.js" "2aeb8315ef78f3e89ca386992d00825b"
```

#### Creating .mcp.json Directly

Alternatively, create a `.mcp.json` file manually at the project root:

```json
{
  "mcpServers": {
    "stumcptmp": {
      "command": "./packages/cli/dist/mcp-server.js",
      "args": ["2aeb8315ef78f3e89ca386992d00825b"],
      "env": {}
    }
  }
}
```

#### Using Environment Variables in Project Config

For flexible course selection across different environments, either use the CLI:

```bash
claude mcp add stumcptmp -s project -e COURSE_ID=2aeb8315ef78f3e89ca386992d00825b node "./packages/cli/dist/mcp-server.js" "${COURSE_ID}"
```

Or create the `.mcp.json` file directly with environment variable expansion:

```json
{
  "mcpServers": {
    "stumcptmp": {
      "command": "./packages/cli/dist/mcp-server.js",
      "args": ["${COURSE_ID}"],
      "env": {
        "COURSE_ID": "2aeb8315ef78f3e89ca386992d00825b"
      }
    }
  }
}
```

### Command Breakdown

- `stumcptmp` - Server name identifier
- `-s project` - Store configuration in shared `.mcp.json` file
- `node` - Command to execute (or use `./packages/cli/dist/mcp-server.js` directly)
- `~/pn/vue-skuilder/studio-mcp/packages/cli/dist/mcp-server.js` - Path to compiled MCP server
- `2aeb8315ef78f3e89ca386992d00825b` - Course ID to connect to

### Verification

After adding the server, verify the configuration:

```bash
claude mcp list
claude mcp get stumcptmp
```

## Generating .mcp.json from Studio Builds

The `studio` command automatically displays MCP connection information when launching a studio session. You can use this information to programmatically generate `.mcp.json` files.

### Using Studio Command Output

When running `skuilder studio`, the command outputs MCP connection details:

```bash
skuilder studio ./my-course
# ... studio startup output ...
🔗 MCP Server: node /path/to/cli/dist/mcp-server.js unpacked_courseId_20250122_abc123 5985
   Connect MCP clients using the command above
   Environment variables for MCP:
     COUCHDB_SERVER_URL=localhost:5985
     COUCHDB_SERVER_PROTOCOL=http
     COUCHDB_USERNAME=admin
     COUCHDB_PASSWORD=password
```

### Programmatic .mcp.json Generation

Based on the studio command output, you can generate an `.mcp.json` file:

```json
{
  "mcpServers": {
    "vue-skuilder-studio": {
      "command": "./packages/cli/dist/mcp-server.js",
      "args": ["unpacked_courseId_20250122_abc123", "5985"],
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

### Dynamic Course/Database Selection

For flexible studio sessions with different courses, use environment variables:

```json
{
  "mcpServers": {
    "vue-skuilder-studio": {
      "command": "./packages/cli/dist/mcp-server.js",
      "args": ["${STUDIO_DATABASE_NAME:-unpacked_default}", "${STUDIO_PORT:-5985}"],
      "env": {
        "COUCHDB_SERVER_URL": "${COUCHDB_SERVER_URL:-localhost:5985}",
        "COUCHDB_SERVER_PROTOCOL": "${COUCHDB_SERVER_PROTOCOL:-http}",
        "COUCHDB_USERNAME": "${COUCHDB_USERNAME:-admin}",
        "COUCHDB_PASSWORD": "${COUCHDB_PASSWORD:-password}"
      }
    }
  }
}
```

### Notes

- **Local scope**: Configuration private to you in this project only
- **Project scope**: Configuration shared with team via `.mcp.json` (should be committed to git)
- **Direct file creation**: You can manually create/edit `.mcp.json` instead of using CLI commands - Claude Code reads this file on startup
- **Studio integration**: Use `skuilder studio` output to get exact MCP connection parameters
- **Dynamic databases**: Studio creates temporary databases with names like `unpacked_courseId_timestamp_hash`
- Requires CouchDB to be running (studio command handles this automatically)
- After configuration changes, restart Claude Code to load the new server
- Claude Code will prompt for approval before using project-scoped servers from `.mcp.json`