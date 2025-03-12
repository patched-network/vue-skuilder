// // Import and re-export components
// import './styles/index.scss';

// component exports
export { default as HeatMap } from './components/HeatMap.vue';
export type { DayData, Color, ActivityRecord } from './components/HeatMap.types';

export { default as SkMouseTrap } from './components/SkMouseTrap.vue';
export * from './components/SkMouseTrap.types';
export { SkldrMouseTrap } from './utils/SkldrMouseTrap';
export type { HotKey, HotKeyMetaData } from './utils/SkldrMouseTrap';

// // Export any composables
// export * from './composables';

// // Export utility functions
// export * from './utils';

// // Export types
// export * from './types';
