// // Import and re-export components
// import './styles/index.scss';

export { default as HeatMap } from './components/HeatMap.vue';
export type { DayData, Color, ActivityRecord } from './components/HeatMap.types';

// global keybinding controller
export { default as SkMouseTrap } from './components/SkMouseTrap.vue';
export { default as SkMouseTrapToolTip } from './components/SkMouseTrapToolTip.vue';
export * from './components/SkMouseTrap.types';
export * from './components/SkMouseTrapToolTip.types';
export { SkldrMouseTrap } from './utils/SkldrMouseTrap';
export type { HotKey, HotKeyMetaData } from './utils/SkldrMouseTrap';

// snackbar service - user notifications
export { default as SnackbarService } from './components/SnackbarService.vue';
export { alertUser, type SnackbarOptions } from './components/SnackbarService';

export { default as PaginatingToolbar } from './components/PaginatingToolbar.vue';
export * from './components/PaginatingToolbar.types';

// Composables
export * from './composables/CompositionViewable';
export * from './composables/Displayable';

/*
  Study Session Components
*/

export { default as StudySession } from './components/StudySession.vue';
export { default as StudySessionTimer } from './components/StudySessionTimer.vue';
export type { StudySessionConfig } from './components/StudySession.types';

/*
  studentInputs

  These components
  - embed into cards
  - accept inputs (answers) from students
  - emit / pass answers to other components in the system
*/
export * from './components/studentInputs/BaseUserInput';
export { default as RadioMultipleChoice } from './components/studentInputs/RadioMultipleChoice.vue';
export { default as MultipleChoiceOption } from './components/studentInputs/MultipleChoiceOption.vue';
export { default as TFSelect } from './components/studentInputs/TrueFalse.vue';
export { default as UserInputNumber } from './components/studentInputs/UserInputNumber.vue';
export { default as UserInputString } from './components/studentInputs/UserInputString.vue';
export { default as FillInInput } from './components/studentInputs/fillInInput.vue';

/*
  cardRendering

  These components are used to render course content
*/
export { default as CardViewer } from './components/cardRendering/CardViewer.vue';
export { default as CardLoader } from './components/cardRendering/CardLoader.vue';

export * from './components/cardRendering/MarkdownRendererHelpers';
export { default as AudioAutoPlayer } from './components/cardRendering/AudioAutoPlayer.vue';
export { default as CodeBlockRenderer } from './components/cardRendering/CodeBlockRenderer.vue';
export { default as MdTokenRenderer } from './components/cardRendering/MdTokenRenderer.vue';
export { default as MarkdownRenderer } from './components/cardRendering/MarkdownRenderer.vue';

/*
  Authentication Components
*/
export * from './components/auth';

/*
  stores
*/
export * from './stores/useCardPreviewModeStore';
export * from './stores/useAuthStore';
export * from './stores/useConfigStore';

/*
  plugins
*/
export { piniaPlugin } from './plugins/pinia';
