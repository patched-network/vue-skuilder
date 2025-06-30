import {
  computed,
  ComputedRef,
  defineComponent,
  PropType,
  Ref,
  ref,
  watch,
  WritableComputedRef,
} from 'vue';
import {
  ValidatingFunction,
  FieldDefinition,
  ValidationResult,
  validationFunctionToVuetifyRule,
  VuetifyRule,
  Status,
  CourseElo,
} from '@vue-skuilder/common';
import { useFieldInputStore } from '@pui/stores/useFieldInputStore';

export interface FieldInputSetupReturn {
  inputField: Ref<HTMLInputElement | null>;
  fieldStore: ReturnType<typeof useFieldInputStore>;
  modelValue: WritableComputedRef<unknown>;
  validators: ComputedRef<ValidatingFunction[]>;
  focus: () => void;
  userInput: () => unknown;
  clearData: () => void;
  setData: (data: unknown) => void;
  vuetifyRules: () => VuetifyRule[];
  generateTags: () => string[];
  generateELO: () => CourseElo | undefined;
}

export default defineComponent({
  name: 'FieldInput',

  props: {
    autofocus: Boolean,
    field: {
      type: Object as PropType<FieldDefinition>,
      required: true,
    },
  },
  setup(props): FieldInputSetupReturn {
    const fieldStore = useFieldInputStore();
    const inputField = ref<HTMLInputElement | null>(null);
    // [ ] TODO: Implement hint - need richer validation result
    //     on the fieldStore to do this.
    //
    //     Exose / Retrieve it as a computed property
    //
    // const hint = ref('');

    // Computed property for v-model binding in child components
    const modelValue = computed({
      get: () => fieldStore.inputs[props.field.name],
      set: (value) => fieldStore.setFieldValue(props.field.name, value),
    });

    watch(modelValue, (newValue: unknown, oldValue: unknown) => {
      console.log('[FieldInput] modelValue changed:', {
        new: newValue,
        old: oldValue,
        currentStoreValue: fieldStore.inputs[props.field.name],
      });
      // Trigger validation when value changes
      // props.uiValidationFunction();
      //
      // validate();
      // fieldStore.setFieldValue(props.field.name, newValue);
    });

    const validators = computed(() => {
      const ret = [];
      if (props.field?.validator) {
        ret.push(props.field.validator.test);
      }
      return ret;
    });

    const focus = () => {
      if (inputField.value) {
        inputField.value.focus();
      }
    };

    const userInput = () => {
      if (!props.field?.name) {
        throw new Error('Field name is required for FieldInput component');
      }
      return fieldStore.inputs[props.field.name];
    };

    const setData = (data: unknown) => {
      if (!props.field?.name) {
        throw new Error('Field name is required for FieldInput component');
      }
      fieldStore.setFieldValue(props.field.name, data);
    };

    const clearData = () => {
      console.log(
        `[FieldInput] Running generic clearData() for ${props.field?.name} in FieldInput.ts`
      );
      if (inputField.value) {
        // if (inputField.value.type === 'file') {
        inputField.value.value = '';
        // } else if (inputField.value.type === 'text') {
        //   inputField.value.value = '';
        // } else if (inputField.value.type === '')
        if (!props.field?.name) return;

        fieldStore.clearField(props.field.name);
      }
    };

    const vuetifyRules = () => {
      if (props.field?.validator) {
        return validators.value.map((f) => {
          return validationFunctionToVuetifyRule(f);
        });
      }
      return [];
    };

    const generateTags = () => {
      console.log('[FieldInput] Running generic generateTags() in FieldInput.ts');
      return props.field?.tagger ? props.field.tagger(userInput()) : [];
    };

    const generateELO = () => {
      console.log('[FieldInput] Running generic generateELO() in FieldInput.ts');
      return props.field?.generateELO ? props.field.generateELO(userInput()) : undefined;
    };

    return {
      inputField,
      fieldStore,
      modelValue,
      validators,
      focus,
      userInput,
      clearData,
      setData,
      vuetifyRules,
      generateTags,
      generateELO,
    };
  },

  data() {
    return {
      validationStatus: {
        status: Status.ok,
        msg: '',
      } as ValidationResult,
    };
  },
});
