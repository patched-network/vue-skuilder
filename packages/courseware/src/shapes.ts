// Master DataShape barrel - aggregates all course shapes for backend use
import { DataShape } from '@vue-skuilder/common';

// Math course shapes
import { 
  SingleDigitAdditionDataShape,
  EqualityTestDataShape,
} from './math/shapes.js';

// Default course shapes  
import { BlanksCardDataShapes } from './default/questions/fillIn/shapes.js';

// Re-export individual shapes
export { 
  SingleDigitAdditionDataShape,
  EqualityTestDataShape,
} from './math/shapes.js';

export { BlanksCardDataShapes } from './default/questions/fillIn/shapes.js';

// TODO: Add other course barrel exports as they are created:
// export * from './french/shapes.js';
// export * from './chess/shapes.js';
// export * from './piano/shapes.js';
// export * from './pitch/shapes.js';
// export * from './typing/shapes.js';
// export * from './word-work/shapes.js';
// export * from './sightsing/shapes.js';

// Collect all shapes into a single array for backend consumption
const MATH_SHAPES = [
  SingleDigitAdditionDataShape,
  EqualityTestDataShape,
];

const DEFAULT_SHAPES = BlanksCardDataShapes; // Already an array

export const ALL_DATA_SHAPES: DataShape[] = [
  ...MATH_SHAPES,
  ...DEFAULT_SHAPES,
  // TODO: Add other course shapes as they are refactored
];