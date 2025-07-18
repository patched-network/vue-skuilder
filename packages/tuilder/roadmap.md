# Tuilder MVP Roadmap

This document outlines the phased development plan for `tuilder`, a terminal-based UI for `vue-skuilder` courses.

## Core Technologies
- **Language**: TypeScript
- **CLI Framework**: Node.js
- **UI**: Ink (React-based)
- **Command Parsing**: yargs
- **Packaging**: npm (within the existing yarn workspace)

---

### Phase 1: Project Scaffolding & "Hello, Ink"

**Status**: Complete

**Goal**: Create the new `tuilder` package and confirm the `ink` setup works.

**Steps**:
1.  **Create Directory**: `mkdir -p packages/tuilder`
2.  **Initialize `package.json`**:
    - Create `packages/tuilder/package.json`.
    - Set `name`: `"@vue-skuilder/tuilder"`.
    - Add `bin`: `"tuilder": "./dist/cli.js"`.
    - **Dependencies**: `ink`, `react`, `yargs`.
    - **Dev Dependencies**: `typescript`, `eslint`, `@types/node`, `@types/react`, `@types/yargs`.
3.  **Setup TypeScript**:
    - Create `packages/tuilder/tsconfig.json` extending the root `tsconfig.base.json`.
    - Configure it for `react` JSX (`"jsx": "react"`).
4.  **Create Entrypoint**:
    - `src/cli.ts`: The main entry point that will use `yargs` to parse commands.
    - `src/App.tsx`: The root Ink/React component.
5.  **"Hello, Ink"**:
    - Implement a simple component in `App.tsx` that renders "Welcome to Tuilder!" using Ink's `<Text>` component.
    - Hook it up to `cli.ts` to render on execution.
6.  **Add Scripts to `package.json`**:
    - `build`: `tsc`
    - `start`: `node dist/cli.js`
    - `dev`: `tsc --watch`

---

### Phase 2: Authentication Flow

**Status**: Complete

**Goal**: Implement CouchDB sign-up and login, reusing existing monorepo packages.

**Steps**:
1.  **Add Dependencies**:
    - Add `@vue-skuilder/db` and `@vue-skuilder/common` as workspace dependencies.
2.  **Create UI Components**:
    - `src/components/LoginView.tsx`: Renders input fields for username/password using `ink-text-input`.
    - `src/components/SignupView.tsx`: Similar to `LoginView` for new account creation.
    - `src/components/Spinner.tsx`: A loading spinner for network requests.
3.  **Implement Auth Logic**:
    - In a `src/services/auth.ts` file, import and use functions from `@vue-skuilder/db` to make the actual API calls to CouchDB.
4.  **Implement Session Management**:
    - Upon successful login, securely store the authentication token.
    - A good location is `~/.config/tuilder/session.json`.
    - The CLI should check for this token on startup to see if the user is already logged in.

---

### Phase 3: Core Study Experience

**Status**: Incomplete

**Goal**: Render questions and handle user input for a live course.

**Steps**:
1.  **Add Dependency**:
    - Add `@vue-skuilder/courseware` as a workspace dependency.
2.  **Data Fetching**:
    - After login, use the `@vue-skuilder/db` adapter to fetch the user's course data and queue of questions.
3.  **Develop Core UI Components**:
    - `src/components/StudyView.tsx`: The main component that orchestrates the study session. It will:
        - Fetch the next question.
        - Manage state (score, progress).
        - Render the appropriate question view.
    - `src/components/QuestionRenderer.tsx`:
        - Takes question data (`ViewData`) as a prop.
        - Uses the `BlanksCard` class from `@vue-skuilder/courseware` to parse the markdown and determine the question type (multiple choice vs. fill-in-the-blank).
    - `src/components/MarkdownRenderer.tsx`:
        - A component to render the question's text content using the `ink-markdown` library.
    - `src/components/MultipleChoiceInput.tsx`:
        - Renders a list of options.
        - The user can navigate with arrow keys and select with Enter. Use `ink-select-input`.
    - `src/components/FillInBlankInput.tsx`:
        - Renders a text input for the user's answer using `ink-text-input`.
        - On submission, it will use the imported `gradeSpellingAttempt` function to provide feedback.
4.  **Integrate `BlanksCard` Logic**:
    - Ensure the logic from the `BlanksCard` class is correctly used to parse `{{...}}` blocks from the markdown into the correct UI.

---

### Phase 4: Static Deployment Compatibility (Stretch Goal)

**Goal**: Enable studying from a static set of JSON files via a URL.

**Steps**:
1.  **Refactor Data Layer**:
    - Define a formal `IDataAdapter` interface in `src/adapters/IDataAdapter.ts`.
    - It should define methods like `login()`, `getCourseList()`, `getNextQuestion()`, `submitAnswer()`.
2.  **Create Adapters**:
    - `src/adapters/CouchDBAdapter.ts`: Implements `IDataAdapter` and wraps the existing logic from Phases 2 & 3.
    - `src/adapters/StaticJSONAdapter.ts`:
        - Takes a base URL as a constructor argument.
        - Implements `IDataAdapter` by fetching data from predefined JSON files (e.g., `{baseURL}/course.json`, `{baseURL}/questions/{id}.json`).
        - The `login` method can be a no-op.
3.  **Update CLI**:
    - Update `src/cli.ts` to check for a `--static <url>` flag.
    - If the flag is present, instantiate the `StaticJSONAdapter`.
    - Otherwise, default to the `CouchDBAdapter` and trigger the login flow.
4.  **Define Static Schema**:
    - Document the required JSON schema for a static course.
    - (Optional) Create a script in `packages/cli` to export a course from CouchDB into this static format.

---

### Phase 5: Packaging and Publishing

**Goal**: Prepare the `tuilder` package for distribution.

**Steps**:
1.  **Finalize Build Process**:
    - Ensure the `build` script compiles all TypeScript and TSX files correctly to the `dist` directory.
2.  **Add `prepublishOnly` Script**:
    - Add a `prepublishOnly` script to `package.json` to automatically run the `build` step before publishing.
3.  **Write Documentation**:
    - Create a `README.md` in `packages/tuilder` explaining how to install, login, and use the CLI.
4.  **Publish**:
    - Publish the package to the appropriate npm registry.
