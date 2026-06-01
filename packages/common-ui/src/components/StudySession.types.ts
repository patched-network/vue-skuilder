import type { ReplanHints } from '@vue-skuilder/db';

/**
 * Misc. config for a study StudySessionConfig
 */
export type StudySessionConfig = {
  likesConfetti: boolean;

  /**
   * Default pipeline batch size for new-card planning.
   *
   * Controls how many cards the pipeline returns per run (both initial
   * session setup and auto-replans). Smaller values cause more frequent
   * replans, keeping plans aligned with rapidly-changing user state —
   * ideal for newer users who unlock content quickly.
   *
   * Explicit `ReplanOptions.limit` on individual replan requests always
   * takes precedence over this default.
   *
   * Default (when omitted): 20
   */
  defaultBatchLimit?: number;

  /**
   * Maximum number of reviews enqueued at session start.
   *
   * Reviews live outside the replan flow — they're loaded once at session
   * setup and drain via consumption (no mid-session refill). The session
   * timer caps total exposure, so overfilling is intentional.
   *
   * Default (when omitted): 200, generous enough for Anki-style power
   * users. Apps targeting short, nimble sessions should set this lower.
   */
  initialReviewCap?: number;

  /**
   * Optional session-durable hints applied from session init onward.
   * Uses the same format as `ReplanOptions.hints` — boost/exclude/require tags.
   *
   * Routed to `SessionController.setSessionHints()` before `prepareSession()`,
   * so they are re-merged into every pipeline run for the rest of the session
   * (initial plan + every replan), not consumed by the first run alone. This
   * is what a post-lesson concept boost wants: emphasis that outlives the
   * first queue rebuild rather than being clobbered by the first auto-replan.
   */
  initHints?: ReplanHints;
};

/**
 * Built-in card transition presets provided by StudySession.
 * Consumers can also pass any custom string to use their own CSS transition classes.
 */
export type CardTransitionPreset = 'component-fade' | 'card-slide' | 'card-scale';

export type CardTransitionMode = 'out-in' | 'in-out' | 'default';
