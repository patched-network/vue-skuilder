# ESLint Standardization Roadmap

## Overview
This document outlines a comprehensive plan to standardize ESLint configuration across the Vue Skuilder monorepo, migrating from mixed legacy configurations to a unified modern flat config approach. The goal is to establish consistent code quality standards while respecting package-specific needs.

## Current State Analysis

### Existing ESLint Configurations

#### Legacy Root Configuration
**File**: `master/.eslintrc`
```json
{
  "extends": [
    "plugin:prettier/recommended",
    "plugin:@typescript-eslint/recommended", 
    "eslint:recommended"
  ],
  "plugins": ["prettier", "@typescript-eslint"],
  "rules": {
    "prettier/prettier": "error"
  }
}
```
**Status**: 🔴 Legacy format, minimal rules, unused by most packages

#### Modern Flat Configs (Existing)
**express** (`eslint.config.js`):
- ✅ TypeScript strict rules
- ✅ Project-aware type checking
- ✅ Prettier integration
- ✅ Comprehensive rule set

**platform-ui** (`eslint.config.mjs`):
- ✅ Vue 3 + Vuetify support
- ✅ TypeScript integration
- ✅ Browser globals
- ✅ Prettier integration

#### Package-Level Linting (Script-Only)
**Packages with lint scripts but no configs**:
- `common-ui`: Uses root .eslintrc (legacy)
- `client`: Uses ESLint v8 with legacy config
- All other packages: No linting configured

### Dependency Version Analysis

| Package | ESLint Version | TypeScript ESLint | Status |
|---------|---------------|-------------------|---------|
| **client** | ^8.57.0 | ^7.4.0 | 🔴 Outdated |
| **common-ui** | ^9.21.0 | ^8.25.0 | ✅ Current |
| **express** | ^9.21.0 | ^8.25.0 | ✅ Current |
| **platform-ui** | ^9.21.0 | ^8.25.0 | ✅ Current |

### Current Problems

1. **Inconsistent Standards**: Different rule sets across packages
2. **Legacy Configuration**: Root .eslintrc not used by modern packages
3. **Missing Coverage**: Backend packages (common, db, e2e-db) have no linting
4. **Version Fragmentation**: Client package uses outdated ESLint v8
5. **Rule Conflicts**: No shared baseline for code quality standards

## Standardization Strategy

### Phase 1: Shared Base Configuration
Create a foundational ESLint configuration that can be extended by all packages while allowing package-specific customization.

### Phase 2: Package-Specific Extensions
Implement specialized configurations for different package types:
- **Backend packages**: Node.js + TypeScript rules
- **Frontend apps**: Vue + browser environment rules  
- **Component libraries**: Library-specific rules
- **Testing packages**: Jest + testing rules

### Phase 3: Migration and Cleanup
Migrate existing packages to the new system and remove legacy configurations.

## Implementation Plan

### Week 1: Foundation Setup

#### 1.1 Create Shared Base Configuration
**File**: `master/eslint.config.base.js`

```javascript
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
    rules: {
      // Shared rules across all packages
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/prefer-const': 'error',
      '@typescript-eslint/no-var-requires': 'error',
      'prefer-const': 'error',
      'no-var': 'error',
      'no-console': 'warn',
    },
  },
  prettierConfig
);
```

#### 1.2 Create Backend Configuration
**File**: `master/eslint.config.backend.js`

```javascript
import tseslint from 'typescript-eslint';
import baseConfig from './eslint.config.base.js';

export default tseslint.config(
  ...baseConfig,
  {
    languageOptions: {
      parserOptions: {
        project: true,
      },
    },
    rules: {
      '@typescript-eslint/explicit-function-return-type': 'warn',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
    },
  }
);
```

#### 1.3 Create Frontend Configuration  
**File**: `master/eslint.config.frontend.js`

```javascript
import tseslint from 'typescript-eslint';
import baseConfig from './eslint.config.base.js';

export default tseslint.config(
  ...baseConfig,
  {
    languageOptions: {
      globals: {
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
      },
    },
    rules: {
      '@typescript-eslint/explicit-function-return-type': 'off',
      'no-console': 'off', // Allow console in frontend for debugging
    },
  }
);
```

#### 1.4 Create Package-Specific Templates

**Backend Template** (`eslint.backend.template.js`):
```javascript
import backendConfig from '../../eslint.config.backend.js';

export default [
  ...backendConfig,
  {
    ignores: ['node_modules/**', 'dist/**', 'coverage/**'],
  },
  {
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
];
```

**Frontend Template** (`eslint.frontend.template.js`):
```javascript
import frontendConfig from '../../eslint.config.frontend.js';
import eslintPluginVue from 'eslint-plugin-vue';

export default [
  ...frontendConfig,
  ...eslintPluginVue.configs['flat/recommended'],
  {
    ignores: ['node_modules/**', 'dist/**', 'coverage/**'],
  },
  {
    files: ['**/*.vue'],
    languageOptions: {
      parserOptions: {
        parser: '@typescript-eslint/parser',
      },
    },
  },
];
```

#### 1.5 Update Root Package Dependencies
**File**: `master/package.json`
```json
{
  "devDependencies": {
    "@eslint/js": "^9.21.0",
    "eslint": "^9.21.0",
    "eslint-config-prettier": "^10.0.2",
    "@typescript-eslint/eslint-plugin": "^8.25.0",
    "@typescript-eslint/parser": "^8.25.0",
    "typescript-eslint": "^8.25.0",
    "eslint-plugin-vue": "^9.32.0",
    "eslint-plugin-vuetify": "^2.5.1",
    "globals": "^15.14.0"
  }
}
```

### Week 2: Backend Package Migration

#### 2.1 Migrate Common Package
**Create**: `master/packages/common/eslint.config.js`
```javascript
import backendConfig from '../../eslint.config.backend.js';

export default [
  ...backendConfig,
  {
    ignores: ['node_modules/**', 'dist/**', 'dist-esm/**'],
  },
  {
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
];
```

**Update**: `master/packages/common/package.json`
```json
{
  "scripts": {
    "lint": "eslint .",
    "lint:fix": "eslint . --fix",
    "lint:check": "eslint . --max-warnings 0"
  }
}
```

#### 2.2 Migrate DB Package
**Create**: `master/packages/db/eslint.config.js`
```javascript
import backendConfig from '../../eslint.config.backend.js';

export default [
  ...backendConfig,
  {
    ignores: ['node_modules/**', 'dist/**'],
  },
  {
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Database-specific rules
      '@typescript-eslint/no-explicit-any': 'off', // PouchDB types often use any
    },
  },
];
```

#### 2.3 Update Express Package
**Migrate**: `master/packages/express/eslint.config.js`
```javascript
import backendConfig from '../../eslint.config.backend.js';

export default [
  ...backendConfig,
  {
    ignores: ['node_modules/**', 'dist/**', 'coverage/**'],
  },
  {
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Express-specific rules (already included in backend config)
    },
  },
];
```

#### 2.4 Migrate E2E-DB Package
**Create**: `master/packages/e2e-db/eslint.config.js`
```javascript
import backendConfig from '../../eslint.config.backend.js';

export default [
  ...backendConfig,
  {
    ignores: ['node_modules/**', 'userdb-*/**'],
  },
  {
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
      globals: {
        // Jest globals
        describe: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
      },
    },
    rules: {
      // Testing-specific rules
      '@typescript-eslint/no-explicit-any': 'off', // Tests often need any for mocking
    },
  },
];
```

### Week 3: Frontend Package Migration

#### 3.1 Update Platform-UI Configuration
**Enhance**: `master/packages/platform-ui/eslint.config.mjs`
```javascript
import frontendConfig from '../../eslint.config.frontend.js';
import eslintPluginVue from 'eslint-plugin-vue';
import eslintPluginVuetify from 'eslint-plugin-vuetify';
import globals from 'globals';

export default [
  ...frontendConfig,
  ...eslintPluginVue.configs['flat/recommended'],
  ...eslintPluginVuetify.configs['flat/recommended'],
  {
    ignores: ['*.d.ts', '**/coverage', '**/dist', '**/src/courses/chess/chessground'],
  },
  {
    files: ['**/*.{ts,vue}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: globals.browser,
      parserOptions: {
        parser: '@typescript-eslint/parser',
      },
    },
    rules: {
      // Vue/UI specific rules
      'vue/multi-word-component-names': 'off',
      'vue/no-unused-vars': 'error',
    },
  },
];
```

#### 3.2 Migrate Common-UI Package
**Create**: `master/packages/common-ui/eslint.config.js`
```javascript
import frontendConfig from '../../eslint.config.frontend.js';
import eslintPluginVue from 'eslint-plugin-vue';

export default [
  ...frontendConfig,
  ...eslintPluginVue.configs['flat/recommended'],
  {
    ignores: ['node_modules/**', 'dist/**', 'coverage/**'],
  },
  {
    files: ['**/*.{ts,vue}'],
    languageOptions: {
      parserOptions: {
        parser: '@typescript-eslint/parser',
      },
    },
    rules: {
      // Component library specific rules
      'vue/require-default-prop': 'error',
      'vue/require-prop-types': 'error',
    },
  },
];
```

#### 3.3 Migrate Courses Package
**Create**: `master/packages/courses/eslint.config.js`
```javascript
import frontendConfig from '../../eslint.config.frontend.js';
import eslintPluginVue from 'eslint-plugin-vue';

export default [
  ...frontendConfig,
  ...eslintPluginVue.configs['flat/recommended'],
  {
    ignores: ['node_modules/**', 'dist/**'],
  },
  {
    files: ['**/*.{ts,vue}'],
    languageOptions: {
      parserOptions: {
        parser: '@typescript-eslint/parser',
      },
    },
  },
];
```

#### 3.4 Migrate Standalone-UI Package
**Create**: `master/packages/standalone-ui/eslint.config.js`
```javascript
import frontendConfig from '../../eslint.config.frontend.js';
import eslintPluginVue from 'eslint-plugin-vue';
import globals from 'globals';

export default [
  ...frontendConfig,
  ...eslintPluginVue.configs['flat/recommended'],
  {
    ignores: ['node_modules/**', 'dist/**'],
  },
  {
    files: ['**/*.{ts,vue}'],
    languageOptions: {
      globals: globals.browser,
      parserOptions: {
        parser: '@typescript-eslint/parser',
      },
    },
  },
];
```

### Week 4: Legacy Migration and Root Scripts

#### 4.1 Update Client Package
**Upgrade**: `master/packages/client/package.json`
```json
{
  "devDependencies": {
    "eslint": "^9.21.0",
    "@typescript-eslint/eslint-plugin": "^8.25.0",
    "@typescript-eslint/parser": "^8.25.0"
  }
}
```

**Create**: `master/packages/client/eslint.config.js`
```javascript
import backendConfig from '../../eslint.config.backend.js';

export default [
  ...backendConfig,
  {
    ignores: ['node_modules/**', 'dist/**'],
  },
  {
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
];
```

#### 4.2 Create Root ESLint Configuration
**Create**: `master/eslint.config.js`
```javascript
import baseConfig from './eslint.config.base.js';

export default [
  ...baseConfig,
  {
    ignores: [
      'node_modules/**',
      'packages/*/dist/**',
      'packages/*/coverage/**',
      'packages/e2e-db/userdb-*/**',
      'test-couch/**',
    ],
  },
  {
    files: ['scripts/**/*.js'],
    languageOptions: {
      globals: {
        process: 'readonly',
        console: 'readonly',
      },
    },
  },
];
```

#### 4.3 Add Root Package Scripts
**Update**: `master/package.json`
```json
{
  "scripts": {
    "lint": "yarn workspaces foreach -pt run lint",
    "lint:fix": "yarn workspaces foreach -pt run lint:fix", 
    "lint:check": "yarn workspaces foreach -pt run lint:check",
    "lint:root": "eslint .",
    "lint:root:fix": "eslint . --fix"
  }
}
```

#### 4.4 Remove Legacy Configuration
**Delete**: `master/.eslintrc`

## Package-Specific Script Standardization

### Standardized Scripts for All Packages
```json
{
  "scripts": {
    "lint": "eslint .",
    "lint:fix": "eslint . --fix",
    "lint:check": "eslint . --max-warnings 0"
  }
}
```

### Package Dependencies Strategy

#### Root Dependencies (Shared)
- Core ESLint packages and configs
- TypeScript ESLint support
- Prettier integration
- Common plugins (Vue, etc.)

#### Package-Level Dependencies
- Package-specific plugins only
- Specialized rule sets
- Framework-specific extensions

## Implementation Checklist

### ✅ Week 1: Foundation - COMPLETED
- [x] Create `eslint.config.base.js` with shared configurations
- [x] Create `eslint.config.backend.js` with backend-specific rules
- [x] Create `eslint.config.frontend.js` with frontend-specific rules
- [x] Add ESLint dependencies to root package.json
- [x] Resolve peer dependency warnings (TypeScript, Vue, Vuetify, Prettier)
- [x] Install and verify all dependencies working
- [ ] Create package-specific templates (skipped - going directly to implementation)
- [ ] Test base configuration with simple TypeScript file (skipped - applying to full codebase)

### ✅ Week 2: Backend Migration - COMPLETED
- [x] Create ESLint config for `common` package
- [x] Create ESLint config for `db` package  
- [x] Update ESLint config for `express` package
- [x] Create ESLint config for `e2e-db` package
- [x] Add lint scripts to all backend package.json files
- [x] Test: `yarn workspace @vue-skuilder/common lint:check` (11 warnings found)
- [x] Test: `yarn workspace @vue-skuilder/db lint:check` (extensive issues found)
- [x] Test: `yarn workspace @vue-skuilder/express lint:check` (53 problems found)
- [x] Test: `yarn workspace @vue-skuilder/e2e-db lint:check` (28 problems found)
- [x] Fix ESLint config file extensions (.js → .mjs for non-module packages)
- [x] Add appropriate ignore patterns for each package

### ✅ Week 3: Frontend Migration
- [ ] Update `platform-ui` ESLint config to use shared base
- [ ] Create ESLint config for `common-ui` package
- [ ] Create ESLint config for `courses` package
- [ ] Create ESLint config for `standalone-ui` package
- [ ] Test all frontend package lint scripts
- [ ] Verify Vue component linting works correctly

### ✅ Week 4: Finalization
- [ ] Update `client` package to ESLint v9
- [ ] Create root ESLint configuration
- [ ] Add root-level lint scripts
- [ ] Remove legacy `.eslintrc` file
- [ ] Update CLAUDE.md with new lint commands
- [ ] Full monorepo lint test: `yarn lint`

## Testing Strategy

### 1. Package-Level Testing
```bash
# Test each package individually
yarn workspace @vue-skuilder/common lint:check
yarn workspace @vue-skuilder/db lint:check
yarn workspace @vue-skuilder/express lint:check
yarn workspace @vue-skuilder/e2e-db lint:check
yarn workspace @vue-skuilder/platform-ui lint:check
yarn workspace @vue-skuilder/common-ui lint:check
yarn workspace @vue-skuilder/courses lint:check
yarn workspace @vue-skuilder/standalone-ui lint:check
yarn workspace @vue-skuilder/client lint:check
```

### 2. Root-Level Testing
```bash
# Test entire monorepo
yarn lint:check

# Test with fixes
yarn lint:fix
```

### 3. Integration Testing
```bash
# Test that build still works after linting fixes
yarn build

# Test that dev environment starts
yarn dev
```

## Configuration Details

### Rule Standardization

#### Shared Rules (All Packages)
- `@typescript-eslint/no-unused-vars`: Warn with underscore prefix ignore
- `@typescript-eslint/no-explicit-any`: Warn (can be overridden per package)
- `@typescript-eslint/prefer-const`: Error
- `prefer-const`: Error
- `no-var`: Error
- `no-console`: Warn (frontend can override)

#### Backend-Specific Rules
- `@typescript-eslint/explicit-function-return-type`: Warn
- `@typescript-eslint/no-floating-promises`: Error
- `@typescript-eslint/await-thenable`: Error
- `@typescript-eslint/no-misused-promises`: Error

#### Frontend-Specific Rules
- `vue/multi-word-component-names`: Off (common in apps)
- `vue/no-unused-vars`: Error
- `vue/require-default-prop`: Error (libraries only)
- `@typescript-eslint/explicit-function-return-type`: Off

#### Testing-Specific Rules  
- `@typescript-eslint/no-explicit-any`: Off (for mocking)
- Jest globals automatically configured

### Ignore Patterns

#### Standard Ignores (All Packages)
- `node_modules/**`
- `dist/**`
- `coverage/**`

#### Package-Specific Ignores
- **common**: `dist-esm/**`
- **platform-ui**: `src/courses/chess/chessground/**`
- **e2e-db**: `userdb-*/**`

## Migration Benefits

### Code Quality Improvements
- **Consistent Standards**: Same rule set across similar package types
- **Type Safety**: Enhanced TypeScript linting with project-aware checking
- **Best Practices**: Modern ESLint flat config with better performance
- **Maintainability**: Centralized rule management with package-specific overrides

### Developer Experience
- **IDE Integration**: Better IntelliSense and error highlighting
- **Faster Linting**: Flat config performance improvements
- **Clear Feedback**: Consistent error messages across packages
- **Automated Fixes**: Standardized `lint:fix` command across all packages

### CI/CD Integration
- **Build Quality Gates**: `lint:check` prevents builds with warnings
- **Automated Formatting**: Integration with Prettier for consistent style
- **Performance**: Faster linting in CI with modern ESLint configuration

## Risk Mitigation

### High Risk: Breaking Changes
- **Mitigation**: Migrate one package at a time
- **Testing**: Verify builds after each package migration
- **Rollback**: Maintain package.json backups

### Medium Risk: Rule Conflicts
- **Mitigation**: Start with warnings, escalate to errors gradually
- **Package Overrides**: Allow package-specific rule modifications
- **Team Feedback**: Adjust rules based on developer feedback

### Low Risk: Performance Impact
- **Mitigation**: Use flat config for better performance
- **Optimization**: Shared dependencies reduce install time
- **Monitoring**: Track lint execution time

## Success Metrics

### Code Quality
- **Zero lint errors** across all packages (warnings acceptable initially)
- **Consistent style** across similar code patterns
- **Type safety improvements** from enhanced TypeScript rules

### Developer Experience  
- **Unified commands**: Same `lint`, `lint:fix`, `lint:check` across packages
- **Fast feedback**: <5 second lint time per package
- **Clear documentation**: Updated CLAUDE.md with new workflows

### Maintenance
- **Single source of truth**: Base configuration for shared rules
- **Easy updates**: ESLint upgrades only require base config changes
- **Package flexibility**: Easy per-package rule customization

## Timeline Summary

- **Week 1**: Foundation setup and shared configurations
- **Week 2**: Backend package migration (common, db, express, e2e-db)
- **Week 3**: Frontend package migration (platform-ui, common-ui, courses, standalone-ui)
- **Week 4**: Legacy cleanup and root-level integration

**Total Effort**: 4 weeks
**Primary Goal**: Unified ESLint configuration with modern flat config
**Secondary Benefits**: Improved code quality, developer experience, maintainability