# @vue-skuilder/db

Database abstraction layer for vue-skuilder.

## Status

Abstraction in progress. Currently this is a smaller ball of mud that was separated out from the main ball of mud.

## Structure

The package is organized into:

- `core/` - Core interfaces and types for database operations
- `pouch/` - PouchDB implementation of the core interfaces
- `study/` - utilities for managing active study sessions

## Usage

```typescript
// Import the default implementation
import { getUserDB } from '@vue-skuilder/db';

// Or import from a specific namespace
import { DBInterfaces } from '@vue-skuilder/db/core';
import { PouchImplementation } from '@vue-skuilder/db/pouch';
```
