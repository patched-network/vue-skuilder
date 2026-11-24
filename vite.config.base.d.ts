// Types for vite.config.base.js, so the packages' vite configs type-check.
import type { ResolveOptions } from 'vite';

export function createBaseAliases(rootDir?: string): Record<string, string>;

export function createBaseResolve(
  rootDir?: string,
  localAliases?: Record<string, string>
): ResolveOptions & { alias: Record<string, string> };
