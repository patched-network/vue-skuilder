<template>
  <v-text-field
    ref="inputField"
    v-model="modelValue"
    variant="filled"
    type="text"
    :name="field.name"
    :label="field.name"
    :rules="vuetifyRules()"
    :hint="validationStatus.msg"
    :autofocus="autofocus"
  />
</template>

<script lang="ts">
import { defineComponent, computed } from 'vue';
import FieldInput from './OptionsFieldInput';
import { ValidatingFunction } from '../../../../base-course/Interfaces/ValidatingFunction';

export default defineComponent({
  name: 'StringInput',
  extends: FieldInput,

  setup(props, ctx) {
    // Get all the setup logic from parent
    const parentSetup = FieldInput.setup?.(props, ctx);

    // [ ] Test datashape-field-custom validators
    const validators = computed<ValidatingFunction[]>(() => {
      const baseValidators = FieldInput.validators.call(this);

      if (props.field.validator?.test) {
        baseValidators.push(props.field.validator.test);
      }

      if (baseValidators) {
        return baseValidators;
      } else {
        return [];
      }
    });

    return {
      ...parentSetup,
      validators,
    };
  },
});
</script>
