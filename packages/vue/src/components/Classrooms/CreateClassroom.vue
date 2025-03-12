<template>
  <v-card>
    <v-toolbar color="primary">
      <v-card-title class="text-h6 font-weight-regular">Start a New Class</v-card-title>
      <v-spacer></v-spacer>
      <v-btn icon @click="clearFormAndDismiss">
        <v-icon>mdi-close</v-icon>
      </v-btn>
    </v-toolbar>
    <v-form>
      <v-container>
        <v-row>
          <v-col cols="12" sm="6" md="4">
            <v-text-field
              v-model="name"
              counter="30"
              :rules="nameRules"
              label="Class Name"
              required
              hint="Eg: Smith, Chemistry, Period 3"
            ></v-text-field>
          </v-col>
          <v-col cols="12" sm="6" md="4">
            <v-checkbox v-model="peerAssist" label="Allow peer instruction"></v-checkbox>
          </v-col>
          <v-col cols="12" sm="6" md="4">
            <v-select
              v-model="birthYear"
              :items="birthYears"
              label="Approximate Birth Year of Students"
              item-title="text"
              item-value="value"
            ></v-select>
          </v-col>
          <v-col cols="12" sm="6" md="4">
            <v-btn :loading="updatePending" color="primary" @click="submit">Create This Class</v-btn>
          </v-col>
        </v-row>
      </v-container>
    </v-form>
  </v-card>
</template>

<script lang="ts">
import moment from 'moment';
import Mousetrap from 'mousetrap';
import { log } from '@vue-skuilder/common';
import { registerUserForClassroom } from '@vue-skuilder/db';
import { Status, ClassroomConfig, CreateClassroom, ServerRequestType } from '@vue-skuilder/common';
import serverRequest from '../../server';
import { alertUser } from '@vue-skuilder/common-ui';
import { defineComponent } from 'vue';
import { getCurrentUser } from '@/stores/useAuthStore';

export default defineComponent({
  data() {
    return {
      mousetrap: new Mousetrap(this.$el),
      peerAssist: true,
      name: '',
      birthYear: undefined as number | undefined,
      id: '',
      nameRules: [
        (value: string): string | boolean => {
          const max = 30;
          if (value.length > max) {
            return `Course name must be ${max} characters or less`;
          } else {
            return true;
          }
        },
      ],
      description: '',
      banner: undefined as Blob | undefined,
      thumb: undefined as Blob | undefined,
      updatePending: false,
      birthYears: [] as Array<{
        text: string;
        value: number;
      }>,
    };
  },

  created() {
    this.mousetrap.bind('esc', this.clearFormAndDismiss);

    const year: number = moment().year();

    this.birthYears.push({
      text: `< ${year - 17} (Adult Students)`,
      value: 0,
    });

    for (let age = 17; age >= 6; age--) {
      this.birthYears.push({
        text: `${year - age} (Grade ${age - 5})`,
        value: year - age,
      });
    }

    this.birthYears.push({
      text: `>${year - 6} (K or younger)`,
      value: year - 5,
    });
  },

  methods: {
    async submit() {
      this.updatePending = true;
      const u = await getCurrentUser();

      const config: ClassroomConfig = {
        name: this.name,
        teachers: [u.username],
        students: [],
        birthYear: this.birthYear,
        classMeetingSchedule: '',
        peerAssist: this.peerAssist,
        joinCode: '',
      };

      log(`Class Config:
      ${JSON.stringify(config)}`);

      const result = await serverRequest<CreateClassroom>({
        data: config,
        type: ServerRequestType.CREATE_CLASSROOM,
        response: null,
        user: u.username,
      });

      if (result.response && result.response.ok) {
        alertUser({
          text: `Class created successfully. Join code: ${result.response.joincode}`,
          status: Status.ok,
        });

        registerUserForClassroom(u.username, result.response.uuid, 'teacher');
      } else {
        alertUser({
          text: `Failed to create class. Please try again.`,
          status: Status.error,
        });
      }

      this.clearFormAndDismiss();
      this.updatePending = false;
    },

    clearFormAndDismiss() {
      this.name = '';
      this.description = '';

      this.$emit('ClassroomEditingComplete');
    },
  },
});
</script>
