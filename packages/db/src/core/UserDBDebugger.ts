import { logger } from '../util/logger';
import { getDataLayer } from '../factory';
import { DocType, DocTypePrefixes } from './types/types-legacy';
import { filterAllDocsByPrefix } from '../impl/common/userDBHelpers';
import type { UserDBInterface } from './interfaces/userDB';
import type { ScheduledCard, CourseRegistration } from './types/user';

// ============================================================================
// USER DATABASE DEBUGGER
// ============================================================================
//
// Console-accessible debug API for inspecting user database (PouchDB/CouchDB).
//
// Exposed as `window.skuilder.userdb` for interactive exploration.
//
// Usage:
//   window.skuilder.userdb.showUser()
//   window.skuilder.userdb.showScheduledReviews()
//   window.skuilder.userdb.showCourseRegistrations()
//   window.skuilder.userdb.showCardHistory('cardId')
//   window.skuilder.userdb.queryByType('SCHEDULED_CARD')
//   window.skuilder.userdb.dbInfo()
//   window.skuilder.userdb.export()
//
// ============================================================================

/**
 * Get the user database instance safely
 */
function getUserDB(): UserDBInterface | null {
  try {
    const provider = getDataLayer();
    return provider.getUserDB();
  } catch (e) {
    logger.info('[UserDB Debug] Data layer not initialized yet.');
    return null;
  }
}

/**
 * Get raw PouchDB instance for advanced queries
 * This accesses the internal localDB property
 */
function getRawDB(): PouchDB.Database | null {
  const userDB = getUserDB();
  if (!userDB) return null;

  // Access the internal localDB property
  // This is a bit of a hack but necessary for raw queries
  const rawDB = (userDB as any).localDB;
  if (!rawDB) {
    logger.info('[UserDB Debug] Unable to access raw database instance.');
    return null;
  }

  return rawDB;
}

/**
 * Format a timestamp for display
 */
function formatTimestamp(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString();
}

/**
 * Console API object exposed on window.skuilder.userdb
 */
export const userDBDebugAPI = {
  /**
   * Show current user information
   */
  showUser(): void {
    const userDB = getUserDB();
    if (!userDB) return;

    // eslint-disable-next-line no-console
    console.group('👤 User Information');
    logger.info(`Username: ${userDB.getUsername()}`);
    logger.info(`Logged in: ${userDB.isLoggedIn() ? 'Yes ✅' : 'No (Guest) ❌'}`);

    userDB.getConfig()
      .then((config) => {
        logger.info('Configuration:');
        logger.info(JSON.stringify(config, null, 2));
      })
      .catch((err) => {
        logger.info(`Error loading config: ${err.message}`);
      })
      .finally(() => {
        // eslint-disable-next-line no-console
        console.groupEnd();
      });
  },

  /**
   * Show scheduled reviews
   */
  async showScheduledReviews(courseId?: string): Promise<void> {
    const userDB = getUserDB();
    if (!userDB) return;

    try {
      const reviews = await userDB.getPendingReviews(courseId);

      // eslint-disable-next-line no-console
      console.group(`📅 Scheduled Reviews${courseId ? ` (${courseId})` : ''}`);
      logger.info(`Total: ${reviews.length}`);

      if (reviews.length > 0) {
        // Group by course
        const byCourse = new Map<string, ScheduledCard[]>();
        for (const review of reviews) {
          if (!byCourse.has(review.courseId)) {
            byCourse.set(review.courseId, []);
          }
          byCourse.get(review.courseId)!.push(review);
        }

        for (const [course, courseReviews] of byCourse) {
          // eslint-disable-next-line no-console
          console.group(`Course: ${course} (${courseReviews.length} reviews)`);

          // Sort by review time
          const sorted = courseReviews.sort((a, b) => {
            const timeA = typeof a.reviewTime === 'string' ? a.reviewTime : a.reviewTime.toISOString();
            const timeB = typeof b.reviewTime === 'string' ? b.reviewTime : b.reviewTime.toISOString();
            return new Date(timeA).getTime() - new Date(timeB).getTime();
          });

          // Show first 10
          for (const review of sorted.slice(0, 10)) {
            const reviewTimeStr = typeof review.reviewTime === 'string'
              ? review.reviewTime
              : review.reviewTime.toISOString();
            logger.info(
              `  ${review.cardId.slice(0, 12)}... @ ${formatTimestamp(reviewTimeStr)} ` +
              `[${review.scheduledFor}/${review.schedulingAgentId}]`
            );
          }

          if (sorted.length > 10) {
            logger.info(`  ... and ${sorted.length - 10} more`);
          }

          // eslint-disable-next-line no-console
          console.groupEnd();
        }
      }

      // eslint-disable-next-line no-console
      console.groupEnd();
    } catch (err: any) {
      logger.info(`Error loading scheduled reviews: ${err.message}`);
    }
  },

  /**
   * Show course registrations
   */
  async showCourseRegistrations(): Promise<void> {
    const userDB = getUserDB();
    if (!userDB) return;

    try {
      const registrations = await userDB.getActiveCourses();

      // eslint-disable-next-line no-console
      console.group('📚 Course Registrations');
      logger.info(`Total: ${registrations.length}`);

      if (registrations.length > 0) {
        // eslint-disable-next-line no-console
        console.table(
          registrations.map((reg: CourseRegistration) => ({
            courseId: reg.courseID,
            status: reg.status || 'active',
            elo: typeof reg.elo === 'number'
              ? reg.elo.toFixed(0)
              : reg.elo?.global?.score?.toFixed(0) || 'N/A',
          }))
        );
      }

      // eslint-disable-next-line no-console
      console.groupEnd();
    } catch (err: any) {
      logger.info(`Error loading course registrations: ${err.message}`);
    }
  },

  /**
   * Show card history for a specific card
   */
  async showCardHistory(cardId: string): Promise<void> {
    const rawDB = getRawDB();
    if (!rawDB) return;

    try {
      // Card history docs use prefix 'cardH'
      const result = await filterAllDocsByPrefix(rawDB, DocTypePrefixes[DocType.CARDRECORD]);

      // Filter for this specific card
      const cardHistories = result.rows
        .filter((row: any) => row.doc && row.doc.cardID === cardId)
        .map((row: any) => row.doc);

      // eslint-disable-next-line no-console
      console.group(`🎴 Card History: ${cardId}`);
      logger.info(`Total interactions: ${cardHistories.length}`);

      if (cardHistories.length > 0) {
        // Sort by timestamp
        const sorted = cardHistories.sort((a: any, b: any) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );

        // Show recent history
        // eslint-disable-next-line no-console
        console.table(
          sorted.slice(0, 20).map((doc: any) => ({
            time: formatTimestamp(doc.timestamp),
            outcome: doc.outcome || 'N/A',
            duration: doc.duration ? `${(doc.duration / 1000).toFixed(1)}s` : 'N/A',
            courseId: doc.courseId,
          }))
        );

        if (sorted.length > 20) {
          logger.info(`... and ${sorted.length - 20} more interactions`);
        }
      }

      // eslint-disable-next-line no-console
      console.groupEnd();
    } catch (err: any) {
      logger.info(`Error loading card history: ${err.message}`);
    }
  },

  /**
   * Query documents by type
   */
  async queryByType(docType: keyof typeof DocType, limit: number = 50): Promise<void> {
    const rawDB = getRawDB();
    if (!rawDB) return;

    try {
      const prefix = DocTypePrefixes[DocType[docType]];
      if (!prefix) {
        logger.info(`Unknown document type: ${docType}`);
        return;
      }

      const result = await filterAllDocsByPrefix(rawDB, prefix);

      // eslint-disable-next-line no-console
      console.group(`📄 Documents: ${docType}`);
      logger.info(`Total: ${result.rows.length}`);
      logger.info(`Prefix: ${prefix}`);

      if (result.rows.length > 0) {
        logger.info('Sample documents:');
        const samples = result.rows.slice(0, Math.min(limit, result.rows.length));

        for (const row of samples) {
          logger.info(`\n${row.id}:`);
          logger.info(JSON.stringify(row.doc, null, 2));
        }

        if (result.rows.length > limit) {
          logger.info(`\n... and ${result.rows.length - limit} more documents`);
        }
      }

      // eslint-disable-next-line no-console
      console.groupEnd();
    } catch (err: any) {
      logger.info(`Error querying documents: ${err.message}`);
    }
  },

  /**
   * Show database info and statistics
   */
  async dbInfo(): Promise<void> {
    const rawDB = getRawDB();
    if (!rawDB) return;

    try {
      const info = await rawDB.info();

      // eslint-disable-next-line no-console
      console.group('ℹ️ Database Information');
      logger.info(`Database name: ${info.db_name}`);
      logger.info(`Total documents: ${info.doc_count}`);
      logger.info(`Update sequence: ${info.update_seq}`);
      // disk_size may not be available in all PouchDB implementations
      if ('disk_size' in info) {
        logger.info(`Disk size: ${((info as any).disk_size || 0) / 1024 / 1024} MB`);
      }

      // Count documents by type
      logger.info('\nDocument counts by type:');
      const allDocs = await rawDB.allDocs({ include_docs: false });
      const typeCounts = new Map<string, number>();

      for (const row of allDocs.rows) {
        // Extract prefix from document ID
        let prefix = 'other';
        for (const [type, typePrefix] of Object.entries(DocTypePrefixes)) {
          if (row.id.startsWith(typePrefix)) {
            prefix = type;
            break;
          }
        }
        typeCounts.set(prefix, (typeCounts.get(prefix) || 0) + 1);
      }

      // eslint-disable-next-line no-console
      console.table(
        Array.from(typeCounts.entries())
          .sort((a, b) => b[1] - a[1])
          .map(([type, count]) => ({ type, count }))
      );

      // eslint-disable-next-line no-console
      console.groupEnd();
    } catch (err: any) {
      logger.info(`Error getting database info: ${err.message}`);
    }
  },

  /**
   * List all document types
   */
  listDocTypes(): void {
    // eslint-disable-next-line no-console
    console.group('📋 Available Document Types');
    logger.info('Use with queryByType(type):');

    for (const [type, prefix] of Object.entries(DocTypePrefixes)) {
      logger.info(`  ${type.padEnd(30)} → prefix: "${prefix}"`);
    }

    // eslint-disable-next-line no-console
    console.groupEnd();
  },

  /**
   * Export database contents (limited, for debugging)
   */
  async export(includeContent: boolean = false): Promise<string> {
    const rawDB = getRawDB();
    const userDB = getUserDB();
    if (!rawDB || !userDB) return '{}';

    try {
      const data: any = {
        username: userDB.getUsername(),
        loggedIn: userDB.isLoggedIn(),
        timestamp: new Date().toISOString(),
      };

      if (includeContent) {
        // Get all documents
        const allDocs = await rawDB.allDocs({ include_docs: true });
        data.documents = allDocs.rows.map((row: any) => ({
          id: row.id,
          doc: row.doc,
        }));
        data.totalDocs = allDocs.rows.length;
      } else {
        // Just get counts
        const allDocs = await rawDB.allDocs({ include_docs: false });
        data.totalDocs = allDocs.rows.length;

        const typeCounts = new Map<string, number>();
        for (const row of allDocs.rows) {
          let prefix = 'other';
          for (const [type, typePrefix] of Object.entries(DocTypePrefixes)) {
            if (row.id.startsWith(typePrefix)) {
              prefix = type;
              break;
            }
          }
          typeCounts.set(prefix, (typeCounts.get(prefix) || 0) + 1);
        }
        data.docCounts = Object.fromEntries(typeCounts);
      }

      const json = JSON.stringify(data, null, 2);
      logger.info('[UserDB Debug] Database info exported. Copy the returned string or use:');
      logger.info('  copy(window.skuilder.userdb.export())');
      if (!includeContent) {
        logger.info('  For full content export: window.skuilder.userdb.export(true)');
      }
      return json;
    } catch (err: any) {
      logger.info(`Error exporting database: ${err.message}`);
      return '{}';
    }
  },

  /**
   * Execute raw PouchDB query
   */
  async raw(queryFn: (db: PouchDB.Database) => Promise<any>): Promise<void> {
    const rawDB = getRawDB();
    if (!rawDB) return;

    try {
      const result = await queryFn(rawDB);
      logger.info('[UserDB Debug] Query result:');
      logger.info(result);
    } catch (err: any) {
      logger.info(`[UserDB Debug] Query error: ${err.message}`);
    }
  },

  /**
   * Show help
   */
  help(): void {
    logger.info(`
🔧 UserDB Debug API

Commands:
  .showUser()                           Show current user info and config
  .showScheduledReviews(courseId?)      Show scheduled reviews (optionally filter by course)
  .showCourseRegistrations()            Show all course registrations
  .showCardHistory(cardId)              Show interaction history for a card
  .queryByType(docType, limit?)         Query documents by type (e.g., 'SCHEDULED_CARD')
  .listDocTypes()                       List all available document types
  .dbInfo()                             Show database info and statistics
  .export(includeContent?)              Export database info (true = include all docs)
  .raw(queryFn)                         Execute raw PouchDB query
  .help()                               Show this help message

Examples:
  window.skuilder.userdb.showUser()
  window.skuilder.userdb.showScheduledReviews('course123')
  window.skuilder.userdb.queryByType('SCHEDULED_CARD', 10)
  window.skuilder.userdb.raw(db => db.allDocs({ limit: 5 }))
`);
  },
};

// ============================================================================
// WINDOW MOUNT
// ============================================================================

/**
 * Mount the debug API on window.skuilder.userdb
 */
export function mountUserDBDebugger(): void {
  if (typeof window === 'undefined') return;

  const win = window as any;
  win.skuilder = win.skuilder || {};
  win.skuilder.userdb = userDBDebugAPI;
}

// Auto-mount when module is loaded
mountUserDBDebugger();
