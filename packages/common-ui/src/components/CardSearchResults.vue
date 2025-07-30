<template>
  <div class="card-search-results">
    <div v-if="loading">Loading...</div>
    <div v-else-if="error">{{ error }}</div>
    <div v-else>
      <v-list>
        <v-list-item 
          v-for="card in cards" 
          :key="card._id"
          @click="selectCard(card)"
          class="cursor-pointer"
        >
          <v-list-item-title>{{ card._id }}</v-list-item-title>
          <v-list-item-subtitle>Course: {{ card.courseId }}</v-list-item-subtitle>
        </v-list-item>
      </v-list>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, PropType } from 'vue';
import { DataLayerProvider, CardData } from '@vue-skuilder/db';

interface CardWithCourse extends CardData {
  courseId: string;
}

export default defineComponent({
  name: 'CardSearchResults',
  emits: {
    'card-selected': (cardId: string, courseId: string) => 
      typeof cardId === 'string' && typeof courseId === 'string'
  },
  props: {
    query: {
      type: String,
      required: true,
    },
    dataLayer: {
      type: Object as PropType<DataLayerProvider>,
      required: true,
    },
  },
  data() {
    return {
      cards: [] as CardWithCourse[],
      loading: false,
      error: null as string | null,
    };
  },
  watch: {
    query: {
      immediate: true,
      handler(newQuery) {
        if (newQuery) {
          this.fetchResults(newQuery);
        }
      },
    },
  },
  methods: {
    async fetchResults(query: string) {
      this.loading = true;
      this.error = null;
      try {
        const coursesDB = this.dataLayer.getCoursesDB();
        const courses = await coursesDB.getCourseList();
        const allCards: CardWithCourse[] = [];

        for (const course of courses) {
          if (!course.courseID) continue;
          
          const courseDB = this.dataLayer.getCourseDB(course.courseID);
          const displayableData = await courseDB.find({
            selector: {
              docType: 'DISPLAYABLE_DATA',
              'data.data': { $regex: query },
            },
          });

          for (const dd of displayableData.docs) {
            const cards = await courseDB.find({
              selector: {
                docType: 'CARD',
                id_displayable_data: { $elemMatch: { $eq: dd._id } },
              },
            });
            
            for (const card of cards.docs) {
              allCards.push({
                ...card,
                courseId: course.courseID,
              });
            }
          }
        }
        this.cards = allCards;
      } catch (e) {
        this.error = 'Error fetching search results.';
        console.error(e);
      } finally {
        this.loading = false;
      }
    },
    
    selectCard(card: CardWithCourse) {
      this.$emit('card-selected', card._id, card.courseId);
    },
  },
});
</script>
