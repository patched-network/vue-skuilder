// Edit UI Components - Core editing components migrated from platform-ui

export { default as CourseEditor } from './CourseEditor.vue';
export { default as DataInputForm } from './ViewableDataInputForm/DataInputForm.vue';
export { default as BulkImportView } from './BulkImportView.vue';

// Field Input Components
export { default as StringInput } from './ViewableDataInputForm/FieldInputs/StringInput.vue';
export { default as MarkdownInput } from './ViewableDataInputForm/FieldInputs/MarkdownInput.vue';
export { default as NumberInput } from './ViewableDataInputForm/FieldInputs/NumberInput.vue';
export { default as IntegerInput } from './ViewableDataInputForm/FieldInputs/IntegerInput.vue';
export { default as MediaDragDropUploader } from './ViewableDataInputForm/FieldInputs/MediaDragDropUploader.vue';
export { default as ChessPuzzleInput } from './ViewableDataInputForm/FieldInputs/ChessPuzzleInput.vue';
export { default as MidiInput } from './ViewableDataInputForm/FieldInputs/MidiInput.vue';
// export { default as AudioInput } from './ViewableDataInputForm/FieldInputs/AudioInput.vue'; // Commented out - file is deprecated
// export { default as ImageInput } from './ViewableDataInputForm/FieldInputs/ImageInput.vue'; // Commented out - file is deprecated

// Field Input Base and Utilities
export { default as OptionsFieldInput } from './ViewableDataInputForm/FieldInputs/OptionsFieldInput';
export * from './ViewableDataInputForm/FieldInputs/typeValidators';
export * from './ViewableDataInputForm/FieldInput.types';