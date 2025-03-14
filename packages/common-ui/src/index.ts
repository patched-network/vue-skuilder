// // Import and re-export components
// import './styles/index.scss';

export { default as HeatMap } from './components/HeatMap.vue';
export type { DayData, Color, ActivityRecord } from './components/HeatMap.types';

// global keybinding controller
export { default as SkMouseTrap } from './components/SkMouseTrap.vue';
export * from './components/SkMouseTrap.types';
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
  studentInputs

  These components
  - embed into cards
  - accept inputs (answers) from students
  - emit / pass answers to other components in the system
*/
export * from './components/studentInputs/BaseUserInput';
export * from './components/studentInputs/MultipleChoiceOption.vue';
export * from './components/studentInputs/RadioMultipleChoice.vue';
export * from './components/studentInputs/TrueFalse.vue';
export * from './components/studentInputs/UserInputNumber.vue';
export * from './components/studentInputs/UserInputString.vue';
export * from './components/studentInputs/fillInInput.vue';

/*
  cardRendering

  These components are used to render course content
*/
export * from './components/cardRendering/AudioAutoPlayer.vue';
export * from './components/cardRendering/CodeBlockRenderer.vue';
export * from './components/cardRendering/MdTokenRenderer.vue';
export * from './components/cardRendering/MarkdownRenderer.vue';
