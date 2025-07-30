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
    courseFilter: {
      type: String as PropType<string | null>,
      default: null,
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
        let courseIds: string[] = [];
        
        // Get course IDs efficiently
        if (this.courseFilter) {
          // Single course search - no need to fetch all courses
          courseIds = [this.courseFilter];
          console.log(`Filtering search to course: ${this.courseFilter}`);
        } else {
          // Get all course IDs without expensive config lookups
          const { CourseLookup } = await import('@vue-skuilder/db');
          const lookupCourses = await CourseLookup.allCourseWare();
          courseIds = lookupCourses.map(c => c._id).filter(Boolean);
          console.log(`Searching across all ${courseIds.length} courses`);
        }
        
        const allCards: CardWithCourse[] = [];

        for (const courseId of courseIds) {
          const courseDB = this.dataLayer.getCourseDB(courseId);
          const cards = await courseDB.searchCards(query);
          
          for (const card of cards) {
            allCards.push({
              ...card,
              courseId: courseId,
            });
          }
        }
        this.cards = allCards;
        console.log(`Search completed: found ${allCards.length} cards across ${courseIds.length} courses`);
      } catch (e) {
        this.error = 'Error fetching search results.';
        console.error('Search error:', e);
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
