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
};

/**
 * Built-in card transition presets provided by StudySession.
 * Consumers can also pass any custom string to use their own CSS transition classes.
 */
export type CardTransitionPreset = 'component-fade' | 'card-slide' | 'card-scale';

export type CardTransitionMode = 'out-in' | 'in-out' | 'default';
