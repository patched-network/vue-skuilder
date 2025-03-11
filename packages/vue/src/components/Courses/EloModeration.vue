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
        <card-loader class="ma-2" :qualified_id="id1" />
      </v-col>
    </v-row>

    <v-row>
      <v-col>
        <v-btn color="success" class="ma-5" @click="vote('b')">
          <v-icon>mdi-check</v-icon>
        </v-btn>
        <card-loader class="ma-2" :qualified_id="id2" />
      </v-col>
    </v-row>
  </v-container>
</template>

<script lang="ts">
import CardLoader from '@/components/Study/CardLoader.vue';
import { CourseElo, adjustCourseScores, CourseConfig } from '@vue-skuilder/common';
import { CourseDB, getCourseConfig, updateCardElo } from '@vue-skuilder/db';
import { defineComponent } from 'vue';

export default defineComponent({
  name: 'ELOModerator',

  components: {
    CardLoader,
  },

  props: {
    _id: {
      type: String,
      required: true,
    },
  },

  data() {
    return {
      courseDB: null as CourseDB | null,
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
    };
  },

  async created() {
    this.courseDB = new CourseDB(this._id);

    this.courseConfig = (await getCourseConfig(this._id))!;
    await this.getNewCards();
  },

  methods: {
    vote(x: 'a' | 'b') {
      if (!this.elo1 || !this.elo2) return;

      const scores = adjustCourseScores(this.elo1, this.elo2, x === 'a' ? 1 : 0, {
        globalOnly: true,
      });

      updateCardElo(this._id, this.cards[0].cardId, scores.userElo);
      updateCardElo(this._id, this.cards[1].cardId, scores.cardElo);

      this.getNewCards();
    },

    async getNewCards() {
      if (!this.courseDB) return;

      this.updatePending = true;
      this.cards = await this.courseDB.getInexperiencedCards();

      // console.log('Comparing:\n\t' + JSON.stringify(this.cards));

      this.id1 = '';
      this.id2 = '';

      this.id1 = `${this._id}-${this.cards[0].cardId}`;
      this.id2 = `${this._id}-${this.cards[1].cardId}`;

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
