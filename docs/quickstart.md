This document describes the creation of a new, empty `skuilder` course using the Skuilder CLI. The documents that follow tell how to populate and customize the course.

# Prerequisites

- nodejs 18+
- npm or yarn
- docker

# Init

The `skuilder` cli contains a setup wizard to . For the below commands, replace `mycourse` with the name of the directory you'd like your project to be created in.

```bash
npx skuilder init mycourse
# or,
# npm install -g skuilder
# skuilder init mycourse
```

The below options create the simplest working course with no reliance on existing infrastructure. __NOTE__, the rest of the **Do** tutorial presumes you've taken this path.

``` bash
? Course title:
My Course Title

? Data layer type:
Static

? Would you like to import course data from a CouchDB Server?
No

? Select Theme:
(Your choice - see the Themes doc for updating this in your built app)
```

You now have your own new standalone static site as a new npm package. The static site stores user data locally (and presumes a singleoton user per browser), and serves course content from JSON files that are bundled into the webapp.

# Build & Serve

To run your app:

```bash
cd myCourse
npm install
npm run dev
```

There is just one problem: your app has no content, and because it is statically hosted, you cannot add to it through the 'front door' of the served application. Do not fear - the scaffolded app includes a helper script from the CLI for just this purpose.

```json {10}
"scripts": {
  "dev": "vite",
  "build": "npm run build:webapp && npm run build:lib",
  "build:webapp": "vite build",
  "build:lib": "BUILD_MODE=library vite build",
  "preview": "vite preview",
  "test:e2e": "cypress open",
  "test:e2e:headless": "cypress run",
  "ci:e2e": "vite dev & wait-on http://localhost:6173 && cypress run",
  "studio": "skuilder studio"
},
```

Onward!
