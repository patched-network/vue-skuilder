import pouch from './pouchdb-setup';
import { getCourseDB } from '.';
import { logger } from '../../util/logger';
import type { CourseConfig } from '@vue-skuilder/common';

// ============================================================================
// COURSE SYNC SERVICE
// ============================================================================
//
// Manages client-side PouchDB replicas of course databases.
//
// Courses opt in to local sync via CourseConfig.localSync.enabled. When
// enabled, the service performs a one-shot replication from remote CouchDB
// to a local PouchDB on first visit, then incremental sync on subsequent
// visits. Pipeline scoring, tag hydration, and card lookup then run against
// the local replica — eliminating network round trips from the study-session
// hot path.
//
// Read/write split:
//   Local DB  = read-only snapshot (pipeline, filters, card lookup)
//   Remote DB = all writes (ELO updates, tag mutations, admin ops)
//
// This avoids propagating per-interaction ELO write noise to every syncing
// client. Each client's local snapshot refreshes on the next page load.
//
// Live replication is intentionally NOT supported. The remote course DB
// receives high-frequency ELO updates from all concurrent users — live
// sync would cause constant re-indexing of local PouchDB views.
//
// ============================================================================

/**
 * Sync state for a single course database.
 */
export type CourseSyncState =
  | 'not-started'
  | 'checking-config'
  | 'syncing'
  | 'warming-views'
  | 'ready'
  | 'disabled'
  | 'error';

/**
 * Detailed sync status for observability.
 */
export interface CourseSyncStatus {
  state: CourseSyncState;
  /** Number of documents replicated (set after sync completes) */
  docsReplicated?: number;
  /** Total replication time in ms */
  syncTimeMs?: number;
  /** View warming time in ms */
  viewWarmTimeMs?: number;
  /** Error message if state is 'error' */
  error?: string;
}

/**
 * Internal tracking entry per course.
 */
interface SyncEntry {
  localDB: PouchDB.Database | null;
  status: CourseSyncStatus;
  /** Promise that resolves when sync is complete (or rejects on failure) */
  readyPromise: Promise<void> | null;
}

/**
 * Service that manages local PouchDB replicas of course databases.
 *
 * Usage:
 * ```typescript
 * const syncService = CourseSyncService.getInstance();
 *
 * // Trigger sync (typically on app load / pre-session)
 * await syncService.ensureSynced(courseId);
 *
 * // Get local DB for reads (returns null if sync not ready/enabled)
 * const localDB = syncService.getLocalDB(courseId);
 * ```
 *
 * The service is a singleton — course sync state is shared across the app.
 */
export class CourseSyncService {
  private static instance: CourseSyncService | null = null;

  private entries: Map<string, SyncEntry> = new Map();

  private constructor() {}

  static getInstance(): CourseSyncService {
    if (!CourseSyncService.instance) {
      CourseSyncService.instance = new CourseSyncService();
    }
    return CourseSyncService.instance;
  }

  /**
   * Reset the singleton (for testing).
   */
  static resetInstance(): void {
    if (CourseSyncService.instance) {
      // Close all local DBs
      for (const [, entry] of CourseSyncService.instance.entries) {
        if (entry.localDB) {
          entry.localDB.close().catch(() => {});
        }
      }
      CourseSyncService.instance.entries.clear();
    }
    CourseSyncService.instance = null;
  }

  // --------------------------------------------------------------------------
  // Public API
  // --------------------------------------------------------------------------

  /**
   * Ensure a course's local replica is synced.
   *
   * On first call for a course:
   *   1. Fetches CourseConfig from remote to check localSync.enabled
   *   2. If enabled, performs one-shot replication remote → local
   *   3. Pre-warms PouchDB view indices (elo, getTags)
   *
   * On subsequent calls: returns immediately if already synced, or awaits
   * the in-flight sync if one is in progress.
   *
   * Safe to call multiple times — concurrent calls coalesce to one sync.
   *
   * @param courseId - The course to sync
   * @param forceEnabled - Skip the CourseConfig check and sync regardless.
   *   Useful when the caller already knows local sync is desired (e.g.,
   *   LettersPractice hardcodes this).
   */
  async ensureSynced(courseId: string, forceEnabled?: boolean): Promise<void> {
    const existing = this.entries.get(courseId);

    // Already synced
    if (existing?.status.state === 'ready') {
      return;
    }

    // Already disabled
    if (existing?.status.state === 'disabled') {
      return;
    }

    // Sync in flight — coalesce
    if (existing?.readyPromise) {
      return existing.readyPromise;
    }

    // Start a new sync
    const entry: SyncEntry = {
      localDB: null,
      status: { state: 'not-started' },
      readyPromise: null,
    };
    this.entries.set(courseId, entry);

    entry.readyPromise = this.performSync(courseId, entry, forceEnabled);
    return entry.readyPromise;
  }

  /**
   * Get the local PouchDB for a course, or null if not available.
   *
   * Returns null when:
   *   - Local sync is not enabled for this course
   *   - Sync has not been triggered yet
   *   - Sync is still in progress
   *   - Sync failed
   */
  getLocalDB(courseId: string): PouchDB.Database | null {
    const entry = this.entries.get(courseId);
    if (entry?.status.state === 'ready' && entry.localDB) {
      return entry.localDB;
    }
    return null;
  }

  /**
   * Check whether a course has a ready local replica.
   */
  isReady(courseId: string): boolean {
    return this.entries.get(courseId)?.status.state === 'ready';
  }

  /**
   * Get detailed sync status for a course.
   */
  getStatus(courseId: string): CourseSyncStatus {
    return (
      this.entries.get(courseId)?.status ?? { state: 'not-started' }
    );
  }

  // --------------------------------------------------------------------------
  // Internal
  // --------------------------------------------------------------------------

  private async performSync(
    courseId: string,
    entry: SyncEntry,
    forceEnabled?: boolean
  ): Promise<void> {
    try {
      // Step 1: Check if local sync is enabled for this course
      if (!forceEnabled) {
        entry.status = { state: 'checking-config' };
        const enabled = await this.checkLocalSyncEnabled(courseId);
        if (!enabled) {
          entry.status = { state: 'disabled' };
          entry.readyPromise = null;
          logger.debug(
            `[CourseSyncService] Local sync disabled for course ${courseId}`
          );
          return;
        }
      }

      // Step 2: Create local PouchDB and replicate
      entry.status = { state: 'syncing' };
      const localDBName = this.localDBName(courseId);
      const localDB = new pouch(localDBName);
      entry.localDB = localDB;

      const remoteDB = this.getRemoteDB(courseId);
      const syncStart = Date.now();

      logger.info(
        `[CourseSyncService] Starting one-shot replication for course ${courseId}`
      );

      const result = await this.replicate(remoteDB, localDB);
      const syncTimeMs = Date.now() - syncStart;

      logger.info(
        `[CourseSyncService] Replication complete for course ${courseId}: ` +
          `${result.docs_written} docs in ${syncTimeMs}ms`
      );

      // Step 3: Pre-warm view indices
      entry.status = { state: 'warming-views' };
      const warmStart = Date.now();
      await this.warmViewIndices(localDB);
      const viewWarmTimeMs = Date.now() - warmStart;

      logger.info(
        `[CourseSyncService] View indices warmed for course ${courseId} in ${viewWarmTimeMs}ms`
      );

      // Done
      entry.status = {
        state: 'ready',
        docsReplicated: result.docs_written,
        syncTimeMs,
        viewWarmTimeMs,
      };
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      logger.error(
        `[CourseSyncService] Sync failed for course ${courseId}: ${errorMsg}`
      );
      entry.status = { state: 'error', error: errorMsg };
      entry.readyPromise = null;

      // Clean up the local DB on failure — don't leave a partial replica
      if (entry.localDB) {
        try {
          await entry.localDB.destroy();
        } catch {
          // Ignore cleanup errors
        }
        entry.localDB = null;
      }
    }
  }

  /**
   * Check CourseConfig.localSync.enabled on the remote DB.
   */
  private async checkLocalSyncEnabled(courseId: string): Promise<boolean> {
    try {
      const remoteDB = this.getRemoteDB(courseId);
      const config = await remoteDB.get<CourseConfig>('CourseConfig');
      return config.localSync?.enabled === true;
    } catch (e) {
      logger.warn(
        `[CourseSyncService] Could not read CourseConfig for ${courseId}, ` +
          `assuming local sync disabled: ${e}`
      );
      return false;
    }
  }

  /**
   * One-shot replication from remote to local.
   */
  private replicate(
    source: PouchDB.Database,
    target: PouchDB.Database
  ): Promise<PouchDB.Replication.ReplicationResultComplete<{}>> {
    return new Promise((resolve, reject) => {
      pouch.replicate(source, target, {
        // One-shot, not live. Local is a read-only snapshot.
      })
        .on('complete', (info) => {
          resolve(info);
        })
        .on('error', (err) => {
          reject(err);
        });
    });
  }

  /**
   * Pre-warm PouchDB view indices by running a minimal query against each
   * design doc. This forces PouchDB to build the MapReduce index now
   * (during a loading phase) rather than on first pipeline query.
   */
  private async warmViewIndices(localDB: PouchDB.Database): Promise<void> {
    const viewsToWarm = ['elo', 'getTags'];

    for (const viewName of viewsToWarm) {
      try {
        await localDB.query(viewName, { limit: 1 });
        logger.debug(
          `[CourseSyncService] Warmed view index: ${viewName}`
        );
      } catch (e) {
        // View might not exist in this course DB — that's OK.
        // Not all courses have all design docs.
        logger.debug(
          `[CourseSyncService] Could not warm view ${viewName}: ${e}`
        );
      }
    }
  }

  /**
   * Get a remote PouchDB handle for a course.
   */
  private getRemoteDB(courseId: string): PouchDB.Database {
    return getCourseDB(courseId);
  }

  /**
   * Local DB naming convention.
   */
  private localDBName(courseId: string): string {
    return `coursedb-local-${courseId}`;
  }
}