---
title: Data Layer
---

# Data Layer

Skuilder's components reach their data through interfaces defined in `@vue-skuilder/db`:

```ts
interface DataLayerProvider {
  getUserDB(): UserDBInterface;                // the current learner
  getCourseDB(courseId: string): CourseDBInterface;
  getCoursesDB(): CoursesDBInterface;          // course lookup and configs
  getClassroomDB(classId: string, type: 'student' | 'teacher'): Promise<ClassroomDBInterface>;
  getAdminDB(): AdminDBInterface;
  isReadOnly(): boolean;
  // ...initialize(), teardown(), ensureCourseSynced?()
}
```

The study session, card rendering, SRS scheduling and the navigation pipeline are written against
these interfaces, so the same application logic runs on a live CouchDB backend or on a static
deployment with no backend at all.

## Initialization

Applications configure their data provider once at startup. The two implementations are selected
by `type`:

::: code-group
```ts [couch (live backend)]
import { initializeDataLayer } from '@vue-skuilder/db';

await initializeDataLayer({
  type: 'couch',
  options: {
    COUCHDB_SERVER_PROTOCOL: 'https',
    COUCHDB_SERVER_URL: 'couch.example.com/',
    COURSE_IDS: ['my-course-id'],    // optional: courses this app serves
    appVersion: import.meta.env.VITE_GIT_SHA, // optional: stamped on session records
  },
});
```

```ts [static (no backend)]
import { initializeDataLayer } from '@vue-skuilder/db';

// The app's root skuilder.json names the courses it loads.
const rootManifestUrl = '/skuilder.json';
const rootManifest = await (await fetch(rootManifestUrl)).json();

await initializeDataLayer({
  type: 'static',
  options: {
    rootManifest,
    rootManifestUrl: new URL(rootManifestUrl, window.location.href).href,
  },
});
```
:::

`standalone-ui` (what the CLI scaffolds) does exactly this, choosing the type from
`dataLayerType` in its `skuilder.config.json`. See [`skuilder.json`](../skuilder.json.md) for the
manifest format.

After initialization, use `getDataLayer()` anywhere:

```ts
import { getDataLayer } from '@vue-skuilder/db';

const courseDB = getDataLayer().getCourseDB('course-123');
const userDB = getDataLayer().getUserDB();
```

## Core Interfaces

These are large interfaces; the excerpts below show their shape. The source in
`packages/db/src/core/interfaces/` is the reference.

### UserDBInterface

The learner's own data: course registrations, card history, scheduled reviews, ratings, study
session records, and per-strategy state.

```ts
interface UserDBInterface {
  // Registration
  getCourseRegistrationsDoc(): Promise<CourseRegistrationDoc>;
  registerForCourse(courseId: string, previewMode?: boolean): Promise<PouchDB.Core.Response>;

  // History and scheduling
  putCardRecord<T extends CardRecord>(record: T): Promise<CardHistory<CardRecord>>;
  getPendingReviews(courseId?: string): Promise<ScheduledCard[]>;
  getSeenCards(courseId?: string): Promise<string[]>;

  // Ratings
  updateUserElo(courseId: string, elo: CourseElo): Promise<PouchDB.Core.Response>;

  // State a navigation strategy (or the app) keeps for this learner
  getStrategyState<T>(courseId: string, strategyKey: string): Promise<T | null>;
  putStrategyState<T>(courseId: string, strategyKey: string, data: T): Promise<void>;

  // Session records, accounts, classrooms, ...
}
```

### CourseDBInterface

Course content: configuration, cards, tags, ratings, and navigation strategy documents. A course
DB is also a `StudyContentSource`: asking it for weighted cards runs the course's navigation
pipeline.

```ts
interface CourseDBInterface extends NavigationStrategyManager, StudyContentSource {
  getCourseID(): string;
  getCourseConfig(): Promise<CourseConfig>;

  // Content
  getCourseDoc<T>(id: string): Promise<T>;
  getCardsCenteredAtELO(options, filter?): Promise<StudySessionItem[]>;
  getAppliedTags(cardId: string): Promise<PouchDB.Query.Response<TagStub>>;
  getTag(tagName: string): Promise<Tag>;

  // Authoring
  addNote(/* ... */): Promise<DataLayerResult>;
  addTagToCard(cardId: string, tagId: string, updateELO?: boolean): Promise<PouchDB.Core.Response>;

  // Strategies (NavigationStrategyManager)
  getAllNavigationStrategies(): Promise<ContentNavigationStrategyData[]>;
  addNavigationStrategy(data: ContentNavigationStrategyData): Promise<void>;
}
```

### StudyContentSource

The interface between content and a study session. It has one required method:

```ts
interface StudyContentSource {
  getWeightedCards(limit: number): Promise<GeneratorResult>; // scored candidates, plus optional hints
  // optional: setEphemeralHints, setSessionId, notePresented, getOrchestrationContext
}
```

`getStudySource(sourceId, user)` turns a `ContentSourceID` into a source. For a course it returns
the course DB. With a `tagFilter`, it returns a `TagFilteredContentSource` that serves only cards
carrying the given tags. That source currently reads tags straight from CouchDB, so it doesn't work
with the static data layer.

## Implementations

Skuilder aims to be both [local-first](https://www.inkandswitch.com/essay/local-first/) and
platform-ready.

### CouchDB / PouchDB

The full implementation:

- **Learner data** lives in a per-user PouchDB in the browser, synced to that user's database on
  CouchDB. Study works offline and syncs when it can. Before sign-up, a guest learner works locally;
  on sign-up, the guest's data can be carried over.
- **Course data** is read from the course's CouchDB database. A course can opt in to local
  replication (`CourseConfig.localSync.enabled`): the app copies the course database into the
  browser once, reads from the copy, and still writes rating updates to the server. This suits
  courses whose content changes rarely.
- **Ratings**: card ratings are updated on the server from every learner's responses, so a
  course's difficulty estimates improve as it is used.
- **Accounts, classrooms, admin**: supported, with the `express` backend handling the operations
  that need server privileges.

### Static

For deployments with no backend (a course on GitHub Pages, a docs site demo):

- **Course data** is a packed bundle of JSON files: a manifest, chunks of documents, and
  precomputed indices (by ELO, by tag). It is served from any static host, including another
  origin.
- **Learner data** lives in a PouchDB in the browser (IndexedDB) with no sync. History, reviews,
  ratings and strategy state all persist on that device.
- **Read-only course**: card ratings are frozen at pack time, and nothing can be authored at
  runtime. There are no accounts, classrooms or admin functions.
- **Strategy documents** in the bundle are loaded, so a static course runs the same navigation
  pipeline as a live one.

A static bundle is produced from a CouchDB course with `skuilder pack`, and loaded back for
editing with `skuilder unpack` or `skuilder studio` (see the [CLI](../cli)).

## Navigation Strategies

Navigation strategies are stored as documents in the course database:

```ts
interface ContentNavigationStrategyData {
  _id: `NAVIGATION_STRATEGY-${string}`;
  docType: DocType.NAVIGATION_STRATEGY;
  name: string;
  description: string;
  implementingClass: string; // e.g. 'hierarchyDefinition', or a class your app registered
  serializedData: string;    // JSON config for that class
}
```

When a session asks a course for cards, the course DB:

1. reads its strategy documents;
2. assembles them into a pipeline (generators propose candidates, filters adjust scores), adding
   the default ELO and SRS generators and the ELO distance filter where absent;
3. runs it, caching the assembled pipeline for a few minutes.

With no strategy documents at all, the default pipeline is used. See [Pedagogy](./pedagogy) for the
built-in strategies and [Navigation Strategies](../extend/navigation-strategies) for writing your own.

## Extending the Data Layer

To support a new backend or storage mechanism:

1. Implement the core interfaces (`UserDBInterface`, `CourseDBInterface`, `CoursesDBInterface`,
   and stubs for the rest).
2. Add an option to `initializeDataLayer()` that constructs your provider.

The application logic (study sessions, card rendering, SRS scheduling) remains unchanged. Be aware
that the interfaces were shaped by PouchDB and return PouchDB response types in places, so a
non-PouchDB backend has some adapting to do. The static implementation is a worked example of that.
