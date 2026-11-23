// The docs site's half of the docs course: noticing which pages a reader has read.
//
// Page reads are captured cheaply in localStorage on every docs page, without loading the data
// layer. Before a docs-course session starts, they are merged into the learner's strategy state
// for the course, which is what DocsReadingGate reads. The pipeline therefore depends only on
// framework state, and any app could report reading the same way.

import type { DataLayerProvider } from '@vue-skuilder/db';
import { DOCS_READING_KEY, type DocsReadingState } from './DocsReadingGate';

const LS_KEY = 'skuilder-docs:reading';
export const READING_EVENT = 'skuilder-docs:reading';

/** `learn/pedagogy.md` → `learn/pedagogy`; the form section configs use. */
export function pageKey(relativePath: string): string {
  return relativePath.replace(/\.md$/, '').replace(/\/index$/, '');
}

function empty(): DocsReadingState {
  return { pages: {}, updatedAt: new Date(0).toISOString() };
}

export function localReading(): DocsReadingState {
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    return raw ? { ...empty(), ...JSON.parse(raw) } : empty();
  } catch {
    return empty();
  }
}

export function markRead(page: string): void {
  const state = localReading();
  if (state.pages[page]) return;
  const now = new Date().toISOString();
  state.pages[page] = { readAt: now };
  state.updatedAt = now;
  try {
    window.localStorage.setItem(LS_KEY, JSON.stringify(state));
  } catch {
    return;
  }
  window.dispatchEvent(new CustomEvent(READING_EVENT, { detail: page }));
}

/**
 * Merge locally captured reads into the learner's strategy state for the course. Returns the
 * resolved course ID.
 */
export async function syncReading(dataLayer: DataLayerProvider, courseRef: string): Promise<string> {
  const courseId = dataLayer.getCourseDB(courseRef).getCourseID();
  const user = dataLayer.getUserDB();
  const stored = (await user.getStrategyState<DocsReadingState>(courseId, DOCS_READING_KEY)) ?? empty();
  const local = localReading();
  const merged: DocsReadingState = {
    pages: { ...local.pages, ...stored.pages },
    updatedAt: new Date().toISOString(),
  };
  if (Object.keys(merged.pages).length !== Object.keys(stored.pages).length) {
    await user.putStrategyState(courseId, DOCS_READING_KEY, merged);
  }
  return courseId;
}

/** Forget reading progress, locally and in strategy state. Learner history is kept. */
export async function resetReading(dataLayer: DataLayerProvider | null, courseRef: string): Promise<void> {
  try {
    window.localStorage.removeItem(LS_KEY);
  } catch {
    // ignore
  }
  if (dataLayer) {
    const courseId = dataLayer.getCourseDB(courseRef).getCourseID();
    await dataLayer.getUserDB().deleteStrategyState(courseId, DOCS_READING_KEY);
  }
  window.dispatchEvent(new CustomEvent(READING_EVENT));
}
