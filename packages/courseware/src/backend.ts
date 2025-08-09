import { DataShape, FieldType, DataShapeName } from '@vue-skuilder/common';

// Backend-only DataShape registry for Node.js compatibility
// Extracted from Question classes to avoid Vue/CSS dependencies

const MATH_DATA_SHAPES: DataShape[] = [
  {
    name: DataShapeName.MATH_SingleDigitAddition,
    fields: [
      { name: 'a', type: FieldType.INT },
      { name: 'b', type: FieldType.INT },
    ],
  },
  {
    name: DataShapeName.MATH_SingleDigitMultiplication,
    fields: [
      { name: 'a', type: FieldType.INT },
      { name: 'b', type: FieldType.INT },
    ],
  },
  {
    name: DataShapeName.MATH_SingleDigitDivision,
    fields: [
      { name: 'a', type: FieldType.INT },
      { name: 'b', type: FieldType.INT },
    ],
  },
  {
    name: DataShapeName.MATH_EqualityTest,
    fields: [
      { name: 'a', type: FieldType.STRING },
      { name: 'b', type: FieldType.STRING },
    ],
  },
  {
    name: DataShapeName.MATH_OneStepEquation,
    fields: [
      { name: 'a', type: FieldType.INT },
      { name: 'b', type: FieldType.INT },
      { name: 'operation', type: FieldType.STRING },
    ],
  },
  {
    name: DataShapeName.MATH_AngleCategorize,
    fields: [
      { name: 'Category', type: FieldType.STRING },
    ],
  },
  {
    name: DataShapeName.MATH_SupplimentaryAngles,
    fields: [
      { name: 'AngleCount', type: FieldType.INT },
    ],
  },
  {
    name: DataShapeName.MATH_CountBy,
    fields: [
      { name: 'n', type: FieldType.INT },
      { name: 'hand', type: FieldType.STRING },
    ],
  },
];

const DEFAULT_DATA_SHAPES: DataShape[] = [
  {
    name: DataShapeName.Blanks,
    fields: [
      { name: 'Input', type: FieldType.MARKDOWN },
      { name: 'Uploads', type: FieldType.MEDIA_UPLOADS },
    ],
  },
];

const FRENCH_DATA_SHAPES: DataShape[] = [
  {
    name: DataShapeName.FRENCH_Vocab,
    fields: [
      { name: 'word', type: FieldType.STRING },
      { name: 'image', type: FieldType.IMAGE },
      { name: 'audio', type: FieldType.AUDIO },
    ],
  },
  {
    name: DataShapeName.FRENCH_AudioParse,
    fields: [
      { name: 'audio', type: FieldType.MEDIA_UPLOADS },
      { name: 'transcript', type: FieldType.STRING },
    ],
  },
];

const CHESS_DATA_SHAPES: DataShape[] = [
  {
    name: DataShapeName.CHESS_puzzle,
    fields: [
      { name: 'puzzleData', type: FieldType.CHESS_PUZZLE },
    ],
  },
  {
    name: DataShapeName.CHESS_forks,
    fields: [
      { name: 'Piece', type: FieldType.STRING },
    ],
  },
];

const PIANO_DATA_SHAPES: DataShape[] = [
  {
    name: DataShapeName.PIANO_PlayNote,
    fields: [
      { name: 'Note', type: FieldType.STRING },
    ],
  },
  {
    name: DataShapeName.PIANO_Echo,
    fields: [
      { name: 'Melody', type: FieldType.MIDI },
    ],
  },
];

const PITCH_DATA_SHAPES: DataShape[] = [
  {
    name: DataShapeName.PITCH_chroma,
    fields: [
      { name: 'Chroma', type: FieldType.STRING },
    ],
  },
];

const TYPING_DATA_SHAPES: DataShape[] = [
  {
    name: DataShapeName.TYPING_singleLetter,
    fields: [
      { name: 'letter', type: FieldType.STRING },
    ],
  },
  {
    name: DataShapeName.TYPING_fallingLetters,
    fields: [
      { name: 'gameLength', type: FieldType.NUMBER },
      { name: 'initialSpeed', type: FieldType.NUMBER },
      { name: 'acceleration', type: FieldType.NUMBER },
      { name: 'spawnInterval', type: FieldType.NUMBER },
    ],
  },
];

const WORDWORK_DATA_SHAPES: DataShape[] = [
  {
    name: DataShapeName.WORDWORK_Spelling,
    fields: [
      { name: 'Word', type: FieldType.STRING },
      { name: 'ExampleSentence', type: FieldType.STRING },
      { name: 'WordAudio', type: FieldType.AUDIO },
      { name: 'SentenceAudio', type: FieldType.AUDIO },
    ],
  },
];

const SIGHTSING_DATA_SHAPES: DataShape[] = [
  {
    name: DataShapeName.SIGHTSING_IdentifyKey,
    fields: [
      { name: 'key', type: FieldType.NUMBER },
    ],
  },
];

// Aggregate all data shapes into a single registry
const ALL_DATA_SHAPES: DataShape[] = [
  ...MATH_DATA_SHAPES,
  ...DEFAULT_DATA_SHAPES,
  ...FRENCH_DATA_SHAPES,
  ...CHESS_DATA_SHAPES,
  ...PIANO_DATA_SHAPES,
  ...PITCH_DATA_SHAPES,
  ...TYPING_DATA_SHAPES,
  ...WORDWORK_DATA_SHAPES,
  ...SIGHTSING_DATA_SHAPES,
];

/**
 * Backend-only DataShape registry compatible with Node.js
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