<template>
  <div class="navigation-strategy-form">
    <v-form ref="form" v-model="valid">
      <v-text-field
        v-model="form.name"
        label="Strategy Name"
        :rules="[(v) => !!v || 'Name is required']"
        required
      ></v-text-field>

      <v-textarea
        v-model="form.description"
        label="Description"
        :rules="[(v) => !!v || 'Description is required']"
        required
      ></v-textarea>

      <v-select
        v-model="form.implementingClass"
        :items="availableNavigators"
        label="Navigation Algorithm"
        :rules="[(v) => !!v || 'Algorithm is required']"
        required
      ></v-select>

      <!-- Dynamic form fields based on selected algorithm -->
      <div v-if="form.implementingClass === 'elo'" class="mt-4">
        <div class="text-subtitle-1">ELO Navigation Parameters</div>
        <p class="text-caption">
          The ELO navigator uses existing metadata from the course and user to determine content order. No additional
          configuration is required.
        </p>
      </div>

      <!-- Additional configuration options will be added here for other navigator types -->

      <div class="form-actions mt-4">
        <v-btn color="primary" :disabled="!valid" @click="validate"> Save Strategy </v-btn>
        <v-btn class="ml-2" @click="$emit('cancel')"> Cancel </v-btn>
      </div>
    </v-form>
  </div>
</template>

<script lang="ts">
import { defineComponent, PropType, ref } from 'vue';
import type { ContentNavigationStrategyData } from '@vue-skuilder/db/src/core/types/contentNavigationStrategy';
import { Navigators, DocType } from '@vue-skuilder/db';

export default defineComponent({
  name: 'NavigationStrategyForm',

  props: {
    strategy: {
      type: Object as PropType<ContentNavigationStrategyData | null>,
      required: true,
    },
    courseId: {
      type: String,
      required: true,
    },
  },

  emits: ['save', 'cancel'],

  setup(props, { emit }) {
    const form = ref({
      id: '',
      name: '',
      description: '',
      implementingClass: '',
      serializedData: '',
    });

    const valid = ref(false);
    const formRef = ref(null);

    // List of available navigation algorithms
    const availableNavigators = [
      {
        text: 'ELO Rating-based Navigation',
        value: Navigators.ELO,
      },
      // Add more navigation algorithms here as they become available
    ];

    // Update form when strategy prop changes
    const updateForm = () => {
      if (props.strategy) {
        form.value = {
          id: props.strategy.id || '',
          name: props.strategy.name || '',
          description: props.strategy.description || '',
          implementingClass: props.strategy.implementingClass || Navigators.ELO,
          serializedData: props.strategy.serializedData || '',
        };
      }
    };

    // Initial form setup
    updateForm();

    // Validate and save the form
    const validate = () => {
      if (formRef.value && (formRef.value as { validate: () => boolean }).validate()) {
        const strategyData: ContentNavigationStrategyData = {
          ...props.strategy,
          id: form.value.id,
          name: form.value.name,
          description: form.value.description,
          implementingClass: form.value.implementingClass,
          course: props.courseId,
          serializedData: form.value.serializedData,
          docType: DocType.NAVIGATION_STRATEGY,
        };

        emit('save', strategyData);
      }
    };

    return {
      form,
      valid,
      formRef,
      availableNavigators,
      validate,
    };
  },

  watch: {
    strategy: {
      handler() {
        // When strategy prop changes, update form
        if (this.strategy) {
          this.form.id = this.strategy.id || '';
          this.form.name = this.strategy.name || '';
          this.form.description = this.strategy.description || '';
          this.form.implementingClass = this.strategy.implementingClass || Navigators.ELO;
          this.form.serializedData = this.strategy.serializedData || '';
        }
      },
      immediate: true,
    },
  },
});
</script>

<style scoped>
.navigation-strategy-form {
  padding: 16px;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
}
</style>
