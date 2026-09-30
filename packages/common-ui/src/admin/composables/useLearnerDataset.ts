import { ref, shallowRef } from 'vue';
import {
  dumpFileName,
  fetchLearnerDump,
  fromDump,
  parseLearnerDump,
  type LearnerDataset,
  type LearnerDump,
} from '@vue-skuilder/db/diagnostics';

/** Where to read a learner from live. Auth is the signed-in admin's couch session cookie. */
export interface LearnerCouchSource {
  /** Couch base URL, e.g. `https://example.com/couch`. */
  couchUrl: string;
  username: string;
  courseId: string;
  /** Course cards to include. Default `touched`. */
  cards?: 'touched' | 'all' | 'none';
}

/**
 * Load one learner's dataset for admin views, live from couch or from a dump
 * file (`skuilder dump-user`, or a file saved from here). Keeps the raw dump
 * so a view can hand exactly what it showed back out as a file.
 */
export function useLearnerDataset() {
  const dump = shallowRef<LearnerDump | null>(null);
  const dataset = shallowRef<LearnerDataset | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function load(read: () => Promise<LearnerDump>, courseId?: string): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      const d = await read();
      dataset.value = fromDump(d, courseId);
      dump.value = d;
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e);
    } finally {
      loading.value = false;
    }
  }

  function loadFromCouch(source: LearnerCouchSource): Promise<void> {
    return load(() => fetchLearnerDump({ ...source, auth: { kind: 'cookie' } }), source.courseId);
  }

  function loadFromFile(file: File, courseId?: string): Promise<void> {
    return load(async () => parseLearnerDump(await file.text()), courseId);
  }

  return { dump, dataset, loading, error, loadFromCouch, loadFromFile };
}

/** Save a dump under the same name `skuilder dump-user` would give it. */
export function downloadLearnerDump(dump: LearnerDump): void {
  const blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = dumpFileName(dump);
  a.click();
  URL.revokeObjectURL(url);
}
