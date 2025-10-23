# Runtime Configuration

## Overview

The `common-ui` library supports runtime configuration through a global `window.__SKUILDER_CONFIG__` object. This is necessary because library code is pre-built and cannot access build-time environment variables from consuming applications.

## Configuration Priority

Configuration values are resolved in this order:
1. **Build-time env vars** (`import.meta.env.VITE_*`) - Only works if the consuming app's bundler processes the library code
2. **Runtime config** (`window.__SKUILDER_CONFIG__`) - Always works, set by consuming app at startup
3. **Fallback** - Empty string or default values

## Usage in Consuming Apps

Set `window.__SKUILDER_CONFIG__` **before** importing any `@vue-skuilder` packages:

```typescript
// In your main.ts / main.js - BEFORE imports
window.__SKUILDER_CONFIG__ = {
  apiBase: '/express',  // API base path for auth/backend calls
  // Add other runtime config here as needed
};

// Now import vue-skuilder packages
import { useAuthStore } from '@vue-skuilder/common-ui';
```

## Available Configuration

### `apiBase` (string)

Base path for API calls to the Express backend.

- **Default**: `''` (empty string, uses relative paths)
- **Example**: `'/express'` - prepends `/express` to all auth API calls
- **Used by**: `authAPI.ts` service functions

**Example**:
```typescript
window.__SKUILDER_CONFIG__ = {
  apiBase: '/express',
};

// Results in calls like:
// - /express/auth/send-verification
// - /express/auth/verify
// - /express/auth/status
```

## Debugging

All services that use runtime config will log their configuration source and resolved values:

```
[authAPI] getApiBase() called
[authAPI]   source: window.__SKUILDER_CONFIG__.apiBase
[authAPI]   result: /express
```

## TypeScript Support

The global type declaration is included in the library:

```typescript
declare global {
  interface Window {
    __SKUILDER_CONFIG__?: {
      apiBase?: string;
      [key: string]: any;
    };
  }
}
```

## Adding New Config Values

When adding new runtime config values:

1. Add the property to the `Window.__SKUILDER_CONFIG__` interface
2. Document it in this file
3. Add appropriate logging when the value is accessed
4. Consider build-time env var as primary source, runtime config as fallback
