<template>
  <v-text-field
    ref="inputField"
    v-model="modelValue"
    variant="filled"
    type="number"
    :name="field.name"
    :label="field.name"
    :rules="vuetifyRules()"
    :hint="validationStatus.msg"
    :autofocus="autofocus"
  />
</template>

<script lang="ts">
import { defineComponent, computed } from 'vue';
import { numberValidator } from './typeValidators';
import FieldInput from '../OptionsFieldInput';
import { ValidatingFunction } from '@pui/base-course/Interfaces/ValidatingFunction';

export default defineComponent({
  name: 'NumberInput',
  extends: FieldInput,

  setup(props, ctx) {
    // Get all the setup logic from parent
    const parentSetup = FieldInput.setup?.(props, ctx);

    const validators = computed<ValidatingFunction[]>(() => {
      const baseValidators = FieldInput.validators.call(this);

      if (props.field.validator?.test) {
        baseValidators.push(props.field.validator.test);
      }

      if (baseValidators) {
        return [numberValidator, ...baseValidators];
      } else {
        return [numberValidator];
      }
    });

    return {
      ...parentSetup,
      validators,
    };
  },
});
</script>
