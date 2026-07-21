/**
 * User database hydration.
 *
 * A logged-in user's data lives in a remote CouchDB `userdb-<hex>` and is
 * mirrored into a browser-local PouchDB. On a device that has never synced
 * that account, the local mirror starts EMPTY — and every local read
 * (`getStrategyState`, `getConfig`, `getCourseRegistrationsDoc`, ...) answers
 * "no such document", which is indistinguishable from "brand new user".
 *
 * Consumers acting on that answer render a new-user experience to an existing
 * user, and — worse — compute writes from empty state that then lose to the
 * real remote document at replication time. Hydration closes that window by
 * pulling the account's documents down BEFORE the user object is handed out.
 */

/**
 * Where a user's local database stands relative to its remote counterpart.
 *
 * Only `failed` is a blocking condition. `stale` explicitly is not: it means a
 * full pull completed on this device previously, so local data is real and
 * merely possibly-behind — live sync closes the gap in the background. That is
 * the ordinary offline case and it must keep working.
 */
export type UserHydrationState =
  /** Guest, or a data layer with no remote. There is nothing to hydrate from. */
  | 'not-required'
  /** Initial pull in flight. */
  | 'hydrating'
  /** Initial pull completed this session. Local is a faithful mirror. */
  | 'hydrated'
  /**
   * A previous session completed a full pull on this device (recorded by the
   * `_local/hydration` marker). Local data is real; live sync is catching up.
   */
  | 'stale'
  /**
   * No pull has ever completed on this device and one could not be completed
   * now. Local reads CANNOT be trusted to mean "no data" — callers must not
   * present a new-user experience or compute writes from what they read.
   */
  | 'failed';

/**
 * Hydration state plus observability detail.
 *
 * Shaped to mirror `CourseSyncStatus` in CourseSyncService, which solves the
 * same problem for course databases.
 */
export interface UserHydrationStatus {
  state: UserHydrationState;
  /** Documents pulled by the initial replication (set when state is `hydrated`). */
  docsWritten?: number;
  /** Wall-clock duration of the initial pull attempt, successful or not. */
  durationMs?: number;
  /** Failure detail, set when state is `failed`. */
  error?: string;
}

/**
 * ID of the per-device marker recording that a full pull once completed.
 *
 * `_local/*` documents are deliberately excluded from replication by CouchDB
 * and PouchDB alike, which is exactly the semantics wanted here: the marker
 * describes THIS device's mirror, and must never travel to another one.
 */
export const HYDRATION_MARKER_ID = '_local/hydration';

/**
 * Payload of {@link HYDRATION_MARKER_ID}.
 */
export interface HydrationMarker {
  _id: typeof HYDRATION_MARKER_ID;
  _rev?: string;
  /** Account the mirror was hydrated for — guards against a stale marker after an account switch. */
  username: string;
  /** ISO timestamp of the most recent successful full pull. */
  hydratedAt: string;
}
