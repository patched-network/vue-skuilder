---
title: Data Layer
---

# Data Layer

Most data access relationships between skuilder components are mediated by interface definitions:

```ts
interface UserDBInterface{...}
interface StudyContentSource{...}
interface CourseDBInterface{...}
interface ClassroomDBInterface{...}
// etc
```

and accesed via the parent `DataLayerProvider` interface provided by the `@vue-skuilder/db` package. In practice, applications configure their data provider once:

:::  code-group
```ts [someapp/src/main.ts]
// `db` import and initialization
import { initializeDataLayer } from '@vue-skuilder/db';

await initializeDataLayer({
  type: 'couch',
  options: {
    COUCHDB_SERVER_PROTOCOL: ENV.COUCHDB_SERVER_PROTOCOL,
    COUCHDB_SERVER_URL: ENV.COUCHDB_SERVER_URL,
  },
});
```
:::

and then use the global `getDataLayer()` for a access to specific resources:

```ts
import { getDataLayer } from '@vue-skuilder/db';

const crsDB = getDataLayer.getCourseDB('crsID');
````

# Implementations

Skuilder wants to be both [local-first](https://www.inkandswitch.com/essay/local-first/) and SaaS / Platform ready. To that end, it uses PouchDB/CouchDB as client and server data stores,
