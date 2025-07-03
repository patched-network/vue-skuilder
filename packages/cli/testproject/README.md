# Testproject

A Skuilder course application built with Vue 3, Vuetify, and Pinia.

## Data Layer

This project uses a static data layer with JSON files.

**Imported Courses:**
- 2aeb8315ef78f3e89ca386992d00825b

Course data is stored in `public/static-courses/` and loaded automatically.

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
