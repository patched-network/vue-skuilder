<template>
  <card-viewer
    v-if="!loading"
    class="ma-2"
    :class="loading ? 'muted' : ''"
    :view="view"
    :data="data"
    :card_id="cardID"
    :course_id="courseID"
    :session-order="sessionOrder"
    @emit-response="processResponse($event)"
  />
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import Courses from '@/courses';
import { displayableDataToViewData, ViewData } from '@/base-course/Interfaces/ViewData';
import { CardData, CardRecord, DisplayableData } from '@vue-skuilder/db';
import { log } from '@vue-skuilder/common';
import CardViewer from './CardViewer.vue';
import { getCourseDoc } from '@vue-skuilder/db';
import { ViewComponent } from '@/base-course/Displayable';

export default defineComponent({
  name: 'CardLoader',

  components: {
    CardViewer,
  },

  props: {
    sessionOrder: {
      type: Number,
      required: false,
      default: 0,
    },
    qualified_id: {
      type: String,
      required: true,
    },
  },

  data() {
    return {
      loading: true,
      view: null as ViewComponent | null,
      data: [] as ViewData[],
      courseID: '',
      cardID: '',
    };
  },

  created() {
    this.loadCard();
  },

  methods: {
    processResponse(r: CardRecord) {
      log(`
        Card was displayed at ${r.timeStamp}
        User spent ${r.timeSpent} milliseconds with the card.
      `);
      this.$emit('emitResponse', r);
    },

    async loadCard() {
      const qualified_id = this.qualified_id;
      console.log(`Card Loader displaying: ${qualified_id}`);

      this.loading = true;
      const _courseID = qualified_id.split('-')[0];
      const _cardID = qualified_id.split('-')[1];

      try {
        const tmpCardData = await getCourseDoc<CardData>(_courseID, _cardID);
        const tmpView = Courses.getView(tmpCardData.id_view);
        const tmpDataDocs = tmpCardData.id_displayable_data.map((id) => {
          return getCourseDoc<DisplayableData>(_courseID, id, {
            attachments: true,
            binary: true,
          });
        });

        const tmpData = [];

        for (const docPromise of tmpDataDocs) {
          const doc = await docPromise;
          tmpData.unshift(displayableDataToViewData(doc));
        }

        this.data = tmpData;
        this.view = tmpView as ViewComponent;
        this.cardID = _cardID;
        this.courseID = _courseID;
      } catch (e) {
        throw new Error(`[CardLoader] Error loading card: ${JSON.stringify(e)}, ${e}`);
      } finally {
        this.loading = false;
        this.$emit('card-loaded');
      }
    },
  },
});
</script>

<style scoped>
.cardView {
  padding: 15px;
  border-radius: 8px;
}

.component-fade-enter-active,
.component-fade-leave-active {
  transition: opacity 0.3s ease;
}
.component-fade-enter, .component-fade-leave-to
/* .component-fade-leave-active below version 2.1.8 */ {
  opacity: 0;
}
</style>
