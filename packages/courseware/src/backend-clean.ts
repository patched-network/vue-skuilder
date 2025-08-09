// Inline imports to avoid code splitting issues
import { DataShape } from '@vue-skuilder/common';
import { SingleDigitAdditionDataShape, EqualityTestDataShape } from './math/shapes.js';
import { BlanksCardDataShapes } from './default/questions/fillIn/shapes.js';

// Inline ALL_DATA_SHAPES to create self-contained backend module
const ALL_DATA_SHAPES: DataShape[] = [
  SingleDigitAdditionDataShape,
  EqualityTestDataShape,
  ...BlanksCardDataShapes,
  // TODO: Add other course shapes as they are refactored
];

/**
 * Backend-only DataShape registry compatible with Node.js
 * Uses single-source-of-truth shapes co-located with their views (SFC-style)
 * Provides the same functionality as AllCourseWare.allDataShapesRaw() 
 * without importing Vue components or CSS dependencies
 */
export function getAllDataShapesRaw(): DataShape[] {
  return ALL_DATA_SHAPES;
}

/**
 * Find a specific DataShape by name
 * Equivalent to allCourseWare.allDataShapesRaw().find(ds => ds.name === name)
 */
export function getDataShapeByName(name: string): DataShape | undefined {
  return ALL_DATA_SHAPES.find(ds => ds.name === name);
}

/**
 * Get all DataShape names
 * Useful for validation and debugging
 */
export function getAllDataShapeNames(): string[] {
  return ALL_DATA_SHAPES.map(ds => ds.name);
}