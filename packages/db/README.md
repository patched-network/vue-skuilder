# @vue-skuilder/db

Database abstraction layer for vue-skuilder.

## Structure

The package is organized into:

- `core/` - Core interfaces and types for database operations
- `pouch/` - PouchDB implementation of the core interfaces

## Usage

```typescript
// Import the default implementation
import { getUserDB } from '@vue-skuilder/db';

// Or import from a specific namespace
import { DBInterfaces } from '@vue-skuilder/db/core';
import { PouchImplementation } from '@vue-skuilder/db/pouch';
```
