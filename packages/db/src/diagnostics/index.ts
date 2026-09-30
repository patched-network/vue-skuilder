/**
 * Learner diagnostics: read one learner's records into a portable dataset,
 * and derive what the admin views, text exports, and detectors show.
 *
 * `fetchLearnerDump` reads from couch (admin rights; basic auth or the
 * browser's session cookie). `parseLearnerDump` reads the same shape from a
 * file. `fromDump` indexes either. The derivations are pure over the indexed
 * dataset. Nothing here imports Pouch or constructs a user, so this entry is
 * safe in the browser, node, and the CLI.
 *
 * Design notes: `agent/diagnostics/` in the framework repo.
 */
export * from './dataset';
export * from './loader';
export * from './derive';
export * from './text';
export type {
  SessionEloEvent,
  SessionStateSnapshot,
  StudySessionDoc,
  StudySessionRunCard,
  StudySessionRunCardTrail,
  StudySessionRunSummary,
} from '../core/types/studySession';
