/**
 * Misc. config for a study StudySessionConfig
 */
export type StudySessionConfig = {
  likesConfetti: boolean;
};

/**
 * Built-in card transition presets provided by StudySession.
 * Consumers can also pass any custom string to use their own CSS transition classes.
 */
export type CardTransitionPreset = 'component-fade' | 'card-slide' | 'card-scale';

export type CardTransitionMode = 'out-in' | 'in-out' | 'default';
