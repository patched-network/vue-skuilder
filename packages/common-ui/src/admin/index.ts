/**
 * `@vue-skuilder/common-ui/admin`: admin and diagnostics components.
 *
 * A separate entry (built by vite.config.admin.js) so learner-facing bundles
 * don't carry it. Views here render a `LearnerDataset` from
 * `@vue-skuilder/db/diagnostics`, whether it came from couch or a dump file.
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
