# Contributing

A Skuilder course application built with Vue 3, Vuetify, and Pinia.

## Data Layer

This project uses a static data layer with JSON files.

## Development

Install dependencies:
```bash
npm install
```

Start the development server:
```bash
npm run dev
```

Build for production:
```bash
npm run build
```

## Studio Mode (Content Editing)

This project supports **Studio Mode** - a content editing web interface for modifying course data:

```bash
npm run studio
```

Studio mode provides:
- **Visual Course Editor**: Interactive interface for editing course content
- **Live Preview**: See changes immediately in the browser
- **Hot Reload**: Changes are saved automatically to your course files
- **No Setup Required**: Built into the Skuilder CLI - just run the command

When you run `npm run studio`, it will:
1. Start a local CouchDB instance for temporary editing
2. Load your course data from `public/static-courses/`
3. Launch the studio interface at http://localhost:7174
4. Provide MCP server connection for, eg, Claude Code integration
5. Save changes back to your static course files when you flush

**Important**: Studio mode **overwrites** existing static data source files in `public/static-courses/`. Make sure to commit or backup your course data before making major edits.

### Claude Code Integration (MCP Server)

Studio mode automatically provides an MCP (Model Context Protocol) server for AI-powered course authoring with Claude Code. When you run `npm run studio`, it displays connection details like:

```bash
🔗 MCP Server: node ./node_modules/@vue-skuilder/cli/dist/mcp-server.js course-id 5985
📋 .mcp.json content:
{
  "mcpServers": {
    "vue-skuilder-studio": {
      "command": "./node_modules/@vue-skuilder/cli/dist/mcp-server.js",
      "args": ["course-id", "5985"],
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

Copy the generated `.mcp.json` content to your Claude Code configuration to enable:
- **AI Content Creation**: Generate course cards with fill-in-the-blank and multiple-choice questions
- **Smart Tagging**: Automatically tag cards and assign ELO difficulty ratings
- **Course Analysis**: Analyze existing course content and suggest improvements
- **Bulk Content Operations**: Create multiple cards at once with consistent formatting

## Configuration

Course configuration is managed in `skuilder.config.json`. You can modify:
- Course title
- Data layer settings
- Theme customization
- Database connection details (for dynamic data layer)

## Theme

Current theme: **default** (light mode)
- Primary: #1976D2
- Secondary: #424242
- Accent: #82B1FF

This theme includes both light and dark variants. The application will use the light theme by default, but users can toggle between light and dark modes in their settings.

### Theme Customization

To customize the theme colors, edit the `theme` section in `skuilder.config.json`:

```json
{
  "theme": {
    "name": "custom",
    "defaultMode": "light",
    "light": {
      "dark": false,
      "colors": {
        "primary": "#your-color",
        "secondary": "#your-color",
        "accent": "#your-color"
        // ... other semantic colors
      }
    },
    "dark": {
      "dark": true,
      "colors": {
        // ... dark variant colors
      }
    }
  }
}
```

The theme system supports all Vuetify semantic colors including error, success, warning, info, background, surface, and text colors. Changes to the configuration file are applied automatically on restart.

## Testing

Run end-to-end tests:
```bash
npm run test:e2e
```

Run tests in headless mode:
```bash
npm run test:e2e:headless
```

## Learn More

Visit the [Skuilder documentation](https://github.com/NiloCK/vue-skuilder) for more information about building course applications.
