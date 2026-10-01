import type { ContentNavigationStrategyData } from './types/contentNavigationStrategy';

// ============================================================================
// VERSION STAMPS
// ============================================================================
//
// What a study session ran on, written into its records so a change shows up
// in them: framework and app releases on the session doc, the strategy docs
// and the content version on each pipeline run (either can change mid-session).
//
// ============================================================================

declare const __SKUILDER_DB_VERSION__: string | undefined;

/** This build's @vue-skuilder/db version, set at build time; `'dev'` when run from source. */
export const FRAMEWORK_VERSION: string =
  typeof __SKUILDER_DB_VERSION__ === 'string' ? __SKUILDER_DB_VERSION__ : 'dev';

let hostAppVersion: string | undefined;

/** Record the host app's version (the data layer's `appVersion` option). */
export function setAppVersion(version: string): void {
  hostAppVersion = version;
}

/** What a session stamps: the framework's version, and the app's if it reported one. */
export function sessionVersions(): { framework: string; app?: string } {
  return { framework: FRAMEWORK_VERSION, ...(hostAppVersion ? { app: hostAppVersion } : {}) };
}

/** Stamp for a pipeline built without strategy docs (the built-in default). */
export const DEFAULT_STRATEGY_HASH = 'default';

/** JSON with object keys sorted, so equal docs stringify equally. */
function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

/**
 * A short hash of a course's strategy docs: 8 hex chars, FNV-1a over their
 * content (not `_rev`, which a redeploy of the same content also changes).
 * Equal for equal strategy sets, whatever order they load in.
 */
export function strategyHash(strategies: readonly ContentNavigationStrategyData[]): string {
  if (strategies.length === 0) return DEFAULT_STRATEGY_HASH;
  const text = strategies
    .map((s) => {
      const { _rev: _ignored, ...rest } = s as ContentNavigationStrategyData & { _rev?: string };
      return stableStringify(rest);
    })
    .sort()
    .join('\n');
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}
