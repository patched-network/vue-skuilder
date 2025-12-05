# TODO: Enable `verbatimModuleSyntax`

## Background

TypeScript's `verbatimModuleSyntax` option enforces explicit `import type` / `export type` syntax for type-only imports and exports. This catches at compile time issues that otherwise manifest as runtime errors in Vite's dev server.

## The Problem

Without this option, code like:

```typescript
export { CardFilter } from './types';  // CardFilter is an interface
```

...compiles to a runtime re-export that fails because interfaces are erased. The browser's module loader throws:

```
SyntaxError: The requested module '...' doesn't provide an export named: 'CardFilter'
```

## Current State

- Fixed the immediate runtime errors in `packages/db/src/core/navigators/` by manually adding `import type` and `export type` where needed
- Attempted to enable `verbatimModuleSyntax` in `tsconfig.base.json` but it flagged ~260 errors in `packages/db` alone
- Most errors are harmless (esbuild elides unused type imports), but re-exports of types (TS1205) are dangerous

## Migration Plan

1. Enable `verbatimModuleSyntax: true` in `tsconfig.base.json`
2. Fix errors package by package, prioritizing:
   - **TS1205** (re-exports of types) — these cause runtime errors
   - **TS1484** (imports of types) — mostly harmless but good hygiene
3. Run `npx tsc --noEmit` in each package to verify

## Reference

- [TypeScript 5.0 Release Notes - verbatimModuleSyntax](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-0.html#--verbatimmodulesyntax)