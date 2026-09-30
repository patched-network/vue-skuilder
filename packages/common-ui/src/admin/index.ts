/**
 * `@vue-skuilder/common-ui/admin`: admin and diagnostics components.
 *
 * A separate entry (built by vite.config.admin.js) so learner-facing bundles
 * don't carry it. Views here render a `LearnerDataset` from
 * `@vue-skuilder/db/diagnostics`, whether it came from couch or a dump file,
 * and take the course's `DiagnosticsInterpreters` for domain meaning.
 *
 * Built CSS: import '@vue-skuilder/common-ui/admin/style' where these render.
 *
 * Import shared common-ui pieces from '@vue-skuilder/common-ui', not
 * '@cui/...', so the admin bundle doesn't duplicate them.
 */

export {
  useLearnerDataset,
  downloadLearnerDump,
  type LearnerCouchSource,
} from './composables/useLearnerDataset';

export { default as LearnerDatasetSource } from './components/LearnerDatasetSource.vue';
export { default as LearnerDiagnostics } from './components/LearnerDiagnostics.vue';
export { default as LearnerSessionList } from './components/LearnerSessionList.vue';
export { default as LearnerSessionDetail } from './components/LearnerSessionDetail.vue';
export { default as LearnerCardHistory } from './components/LearnerCardHistory.vue';
export { default as CardDossierDetail } from './components/CardDossierDetail.vue';
export { default as RunDetail } from './components/RunDetail.vue';
