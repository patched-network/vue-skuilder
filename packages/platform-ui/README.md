# Skuilder

A platform for collaborative authoring of interactive tutoring systems. Wikipedia for Duolingo, Anki, etc, with emphasis on:

- one-click participation as a learner
- rapid convergence on appropriately challenging content
- low barriers to participation as authors (eg, easy content authoring / editing / tranlation / sorting)
- opportunites for participation at high levels of abstraction (eg, apis for uploading procedurally generatec content, query language for procedurally declaring links between content)
- self-healing courses, via the reporting of learning bottlenecks to the authoring community
- opportunities for courses to inherit content from one another

# Development

There are three components to this repository:

- couchdb database layer
- express.js and node.js based server layer
- vue-cli based front end

## couchdb database layer

- ... can be installed according to instructions from couchdb.org
- can be configured with `couchdb/skuilder.ini` according to instructions for your OS at http://docs.couchdb.org/en/latest/config/intro.html
- after installation, a control panel can be viewed at http://localhost:5984/\_utils/

## express.js server layer

- install dependencies via `npm install` or `yarn install` in the `./express/` directory
- build with typescript's `tsc`
- run the built `/dist/express/src/app.js` file with node

## Vue SPA PWA

- install dependencies via `npm install` or `yarn install` in the `./vue/` directory
- `npm run serve` or `yarn serve` creates an in-memory build that is hosted by the webpack dev-server at `localhost:8080`

the included `./vue/.env.development` file assumes default locations for local couch and node servers: `localhost:5984/` and `localhost:3000/`. These values can be overwritten in a `.env.development.local` file.

This project is scaffolded with [vue-cli 3](https://cli.vuejs.org/). See the vue-cli docs for more detail on build / deployment / environment configuation.

### Debugging

The project can be debugged inside of VSCode using the existing settings from `./vscode/launch.json`. After starting a development server with `yarn serve` / `npm run serve`, hitting F5 will launch VSCode's debugger and attach to the process. Launch configurations for Firefox and Chrome are present. They need the VSCode [debugger for firefox](https://marketplace.visualstudio.com/items?itemName=hbenl.vscode-firefox-debug) and [debugger for chrome](https://marketplace.visualstudio.com/items?itemName=msjsdiag.debugger-for-chrome) exensions, respectively.

The debugger respects hot-reloads of the project, but note that `.env` files are only read on the initial run of `yarn serve` / `npm run serve`, so any changes to these files will require a restart of the development server.

Component state / props / virtual DOM exploration is also available in the browser via [vue-devtools](https://github.com/vuejs/vue-devtools).

- [Firefox Addon](https://addons.mozilla.org/en-US/firefox/addon/vue-js-devtools/)
- [Chrome Extension](https://chrome.google.com/webstore/detail/vuejs-devtools/nhdogjmejiglipccpnnnanhbledajbpd)

### Production Build

Check for relevant flags in `/src/ENVIRONMENT_VARS.ts` before building for production.

- `npm run build` or `yarn build` outputs a static web page in the `/build` folder.

# Licence

The project in general follows the AGPL-3.0 licence. However, materials in `/src/base-course/` fall under the MIT licence (this folder will eventually be pulled to its own repository/package - see #3).

[AGPL-3.0](https://opensource.org/licenses/AGPL-3.0)

[MIT](https://opensource.org/licenses/MIT)
