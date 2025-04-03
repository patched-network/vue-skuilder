<template>
  <v-container fluid class="fill-height pa-0">
    <!-- Close button in top-right corner -->
    <v-btn icon="mdi-close" color="red" variant="elevated" class="close-btn" @click="close"> </v-btn>

    <!-- Main content -->
    <v-row align="center" justify="center" class="fill-height">
      <v-col cols="12" class="text-center">
        <div v-if="!updatePending" class="join-code">
          {{ classroomCfg?.joinCode }}
        </div>
        <v-progress-circular v-else indeterminate size="64"></v-progress-circular>
      </v-col>
    </v-row>
  </v-container>
</template>

<script lang="ts">
import { log } from '@vue-skuilder/common';
import { TeacherClassroomDBInterface, getDataLayer } from '@vue-skuilder/db';
import { ClassroomConfig } from '@vue-skuilder/common';
import { defineComponent } from 'vue';

export default defineComponent({
  name: 'JoinCode',

  props: {
    classroomId: {
      type: String,
      required: true,
    },
  },

  data() {
    return {
      classroomCfg: null as ClassroomConfig | null,
      classroomDB: null as TeacherClassroomDBInterface | null,
      updatePending: true,
    };
  },

  async created() {
    const dl = getDataLayer();

    this.classroomDB = await dl.getClassroomDB(this.classroomId, 'teacher');
    this.classroomCfg = this.classroomDB.getConfig();
    await Promise.all([]);
    log(`Route loaded w/ (prop) _id: ${this.classroomId}`);
    log(`Config:
    ${JSON.stringify(this.classroomCfg)}`);
    this.updatePending = false;
  },

  methods: {
    close() {
      this.$router.back();
    },
  },
});
</script>

<style>
.close-btn {
  position: fixed;
  top: 80px;
  right: 16px;
  z-index: 100;
}

.join-code {
  font-size: 8rem;
  font-weight: bold;
  line-height: 1.2;
  letter-spacing: 0.1em;
}

/* Responsive adjustments */
@media (max-width: 600px) {
  .join-code {
    font-size: 4rem;
  }
}
</style>
