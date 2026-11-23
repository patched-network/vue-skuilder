# Themes

Skuilder uses Vuetify 3, and its [theming system](https://vuetifyjs.com/en/features/theme/) can be used to customize colors, typography, and more.

The basic structure is:

```json
{
  "theme": {
    "name": "my-custom-theme",
    "defaultMode": "light",
    "light": {
      "dark": false,
      "colors": {
        "primary": "#1976D2",
        "secondary": "#424242",
        "accent": "#82B1FF",
        "error": "#F44336",
        "warning": "#FF9800",
        "info": "#2196F3",
        "success": "#4CAF50"
      }
    },
    "dark": {
      "dark": true,
      "colors": {
        "primary": "#2196F3",
        "secondary": "#90A4AE",
        "accent": "#82B1FF",
        "error": "#EF5350",
        "warning": "#FFA726",
        "info": "#42A5F5",
        "success": "#66BB6A"
      }
    }
  }
}
```

## Configuration Location

In a scaffolded course, the theme is defined in your `skuilder.config.json` file at the root of your course directory (the same location where you have your `package.json`). Changes apply on the next `npm run dev` or build.

`skuilder init` offers four starting presets (`default`, `medical`, `educational`, `corporate`, also selectable with `--theme`). Each writes a full light and dark palette into `skuilder.config.json`, which you can then edit freely. Any [Vuetify semantic color](https://vuetifyjs.com/en/features/theme/) can be set, including `background`, `surface`, and the `on-*` text colors.

## User Theme Switching

Users can toggle between modes in the settings menu, and their preference will be remembered across sessions.
