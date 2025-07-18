<template>
  <v-container v-if="!updatePending">
    <v-row>
      <v-col cols="12">
        <h1>Which seems <em>harder</em>?</h1>
      </v-col>
    </v-row>

    <v-row>
      <v-col>
        <v-btn color="success" class="ma-5" @click="vote('a')">
          <v-icon>mdi-check</v-icon>
        </v-btn>
        <card-loader class="ma-2" :qualified_id="id1" :view-lookup="viewLookup" />
      </v-col>
    </v-row>

    <v-row>
      <v-col>
        <v-btn color="success" class="ma-5" @click="vote('b')">
          <v-icon>mdi-check</v-icon>
        </v-btn>
        <card-loader class="ma-2" :qualified_id="id2" :view-lookup="viewLookup" />
      </v-col>
    </v-row>
  </v-container>
</template>

<script lang="ts">
import { CardLoader } from '@vue-skuilder/common-ui';
import { allCourses } from '@vue-skuilder/courseware';
import { CourseElo, adjustCourseScores, CourseConfig } from '@vue-skuilder/common';
import { CourseDBInterface, getDataLayer } from '@vue-skuilder/db';
import { defineComponent } from 'vue';

export default defineComponent({
  name: 'ELOModerator',

  components: {
    CardLoader,
  },

  props: {
    courseId: {
      type: String,
      required: true,
    },
  },

  data() {
    return {
      courseDB: null as CourseDBInterface | null,
      updatePending: true,
      courseConfig: null as CourseConfig | null,
      cards: [] as {
        courseId: string;
        cardId: string;
        elo: CourseElo;
        count: number;
      }[],
      id1: '',
      id2: '',
      elo1: null as CourseElo | null,
      elo2: null as CourseElo | null,
      viewLookup: allCourses.getView,
    };
  },

  async created() {
    this.courseDB = getDataLayer().getCourseDB(this.courseId);

    this.courseConfig = (await this.courseDB!.getCourseConfig())!;
    await this.getNewCards();
  },

  methods: {
    vote(x: 'a' | 'b') {
      if (!this.elo1 || !this.elo2) return;

      const scores = adjustCourseScores(this.elo1, this.elo2, x === 'a' ? 1 : 0, {
        globalOnly: true,
      });

      this.courseDB!.updateCardElo(this.cards[0].cardId, scores.userElo);
      this.courseDB!.updateCardElo(this.cards[1].cardId, scores.cardElo);

      this.getNewCards();
    },

    async getNewCards() {
      if (!this.courseDB) return;

      this.updatePending = true;
      this.cards = await this.courseDB!.getInexperiencedCards();

      // console.log('Comparing:\n\t' + JSON.stringify(this.cards));

      this.id1 = '';
      this.id2 = '';

      this.id1 = `${this.courseId}-${this.cards[0].cardId}`;
      this.id2 = `${this.courseId}-${this.cards[1].cardId}`;

      this.elo1 = this.cards[0].elo;
      this.elo2 = this.cards[1].elo;

      this.updatePending = false;
    },
  },
});
</script>

<style scoped>
.component-fade-enter-active,
.component-fade-leave-active {
  transition: opacity 0.5s ease;
}
.component-fade-enter, .component-fade-leave-to
/* .component-fade-leave-active below version 2.1.8 */ {
  opacity: 0;
}
</style>
