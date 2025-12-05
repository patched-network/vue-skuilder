---
title: Data Layer
---

# Data Layer

Most data access relationships between skuilder components are mediated by interface definitions:

```ts
interface UserDBInterface { /* ... */ }
interface CourseDBInterface { /* ... */ }
interface StudyContentSource { /* ... */ }
interface ClassroomDBInterface { /* ... */ }
// etc
```

This abstraction enables different deployment contexts (local-first static sites, live CouchDB backends, hybrid) to share the same application logic.

## Initialization

Applications configure their data provider once at startup:

::: code-group
```ts [someapp/src/main.ts]
import { initializeDataLayer } from '@vue-skuilder/db';

await initializeDataLayer({
  type: 'couch',
  options: {
    COUCHDB_SERVER_PROTOCOL: ENV.COUCHDB_SERVER_PROTOCOL,
    COUCHDB_SERVER_URL: ENV.COUCHDB_SERVER_URL,
  },
});
```

```ts [static-app/src/main.ts]
import { initializeDataLayer } from '@vue-skuilder/db';

await initializeDataLayer({
  type: 'static',
  options: {
    courseManifest: '/courses/manifest.json',
  },
});
```
:::

After initialization, use `getDataLayer()` for access to specific resources:

```ts
import { getDataLayer } from '@vue-skuilder/db';

const courseDB = getDataLayer().getCourseDB('course-123');
const userDB = getDataLayer().getUserDB();
```

## Core Interfaces

### UserDBInterface

Manages user-specific data: course registrations, card history, ELO ratings, scheduled reviews.

```ts
interface UserDBInterface {
  // Course registration
  getCourseRegistrations(): Promise<CourseRegistration[]>;
  registerForCourse(courseId: string): Promise<void>;

  // Card history
  getCardHistory(cardId: string): Promise<CardHistory>;
  putCardRecord(record: CardRecord): Promise<void>;

  // Review scheduling
  getPendingReviews(courseId: string): Promise<ScheduledCard[]>;

  // ELO ratings
  getCourseElo(courseId: string): Promise<CourseElo>;
}
```

### CourseDBInterface

Provides read access to course content: cards, tags, data shapes, and navigation strategies.

```ts
interface CourseDBInterface {
  getCourseID(): string;
  getCourseConfig(): Promise<CourseConfig>;

  // Content access
  getCard(cardId: string): Promise<CardData>;
  getCardsByTag(tagId: string): Promise<CardData[]>;
  getAppliedTags(cardId: string): Promise<string[]>;

  // Navigation
  createNavigator(user: UserDBInterface): Promise<StudyContentSource>;
  getAllNavigationStrategies(): Promise<NavigationStrategyDoc[]>;
}
```

### StudyContentSource

The interface between course content and the study session. Navigation strategies implement this interface.

```ts
interface StudyContentSource {
  getNewCards(n?: number): Promise<StudySessionNewItem[]>;
  getPendingReviews(): Promise<StudySessionReviewItem[]>;
}
```

The `createNavigator()` method on `CourseDBInterface` constructs an appropriate `StudyContentSource` based on the course's configured navigation strategies.

## Implementations

Skuilder aims to be both [local-first](https://www.inkandswitch.com/essay/local-first/) and platform-ready.

### CouchDB / PouchDB

The primary implementation uses PouchDB on the client and CouchDB on the server:

- **Client**: PouchDB stores user data locally, syncs when online
- **Server**: CouchDB provides persistence, replication, and multi-user support
- **Sync**: Automatic bidirectional sync when connectivity allows

This enables offline study sessions with eventual consistency.

### Static

For standalone deployments without a backend:

- **Course data**: Bundled as static JSON, served from CDN or local files
- **User data**: Stored in browser IndexedDB via PouchDB
- **No sync**: User data stays on the device

Ideal for single-course deployments, demos, and local development.

## Navigation Strategies

Navigation strategies are stored as documents in the course database:

```ts
interface NavigationStrategyDoc {
  _id: string;
  docType: 'NAVIGATION_STRATEGY';
  name: string;
  strategyType: 'elo' | 'srs' | 'hierarchyDefinition' | 'interferenceMitigator' | 'relativePriority';
  serializedData: string;  // JSON config specific to strategy type
}
```

When `createNavigator()` is called, the system:

1. Fetches all navigation strategy documents for the course
2. Assembles them into a pipeline (generators produce candidates, filters refine scores)
3. Returns a `StudyContentSource` that uses this pipeline

If no strategies are configured, a default ELO-based navigator is used.

See the [Pedagogy System](./pedagogy) doc for details on available strategy types and their configuration.

## Extending the Data Layer

To support a new backend or storage mechanism:

1. Implement the core interfaces (`UserDBInterface`, `CourseDBInterface`, etc.)
2. Create an initialization function that sets up the provider
3. Register it as an option in `initializeDataLayer()`

The application logic — study sessions, card rendering, SRS scheduling — remains unchanged.