<template>
  <v-card>
    <div v-if="updatePending" class="d-flex justify-center align-center pa-6">
      <v-progress-circular indeterminate color="primary" />
    </div>
    <div v-else>
      <paginating-toolbar
        title="Exercises"
        :page="page"
        :pages="pages"
        :subtitle="`(${questionCount})`"
        @first="first"
        @prev="prev"
        @next="next"
        @last="last"
        @set-page="(n) => setPage(n)"
      />

      <v-list>
        <template v-for="c in cards" :key="c.id">
          <v-list-item
            :class="{
              'bg-blue-grey-lighten-5': c.isOpen,
              'elevation-4': c.isOpen,
            }"
            density="compact"
            data-cy="course-card"
          >
            <template #prepend>
              <div>
                <v-list-item-title :class="{ 'text-blue-grey-darken-1': c.isOpen }" class="font-weight-medium">
                  {{ cardPreview[c.id] }}
                </v-list-item-title>
                <v-list-item-subtitle>
                  ELO: {{ cardElos[idParse(c.id)]?.global.score || '(unknown)' }}
                </v-list-item-subtitle>
              </div>
            </template>

            <template #append>
              <v-speed-dial
                v-model="c.isOpen"
                location="left center"
                transition="slide-x-transition"
                style="display: flex; flex-direction: row-reverse"
                persistent
              >
                <template #activator="{ props }">
                  <v-btn
                    v-bind="props"
                    :icon="c.isOpen ? 'mdi-close' : 'mdi-plus'"
                    size="small"
                    variant="text"
                    @click="clearSelections(c.id)"
                  />
                </template>

                <v-btn
                  v-if="editMode === 'full'"
                  key="tags"
                  icon
                  size="small"
                  :variant="internalEditMode !== 'tags' ? 'outlined' : 'elevated'"
                  :color="internalEditMode === 'tags' ? 'teal' : 'teal-darken-3'"
                  @click.stop="internalEditMode = 'tags'"
                >
                  <v-icon>mdi-bookmark</v-icon>
                </v-btn>

                <v-btn
                  v-if="editMode === 'full'"
                  key="flag"
                  icon
                  size="small"
                  :variant="internalEditMode !== 'flag' ? 'outlined' : 'elevated'"
                  :color="internalEditMode === 'flag' ? 'error' : 'error-darken-3'"
                  @click.stop="internalEditMode = 'flag'"
                >
                  <v-icon>mdi-flag</v-icon>
                </v-btn>
              </v-speed-dial>
            </template>
          </v-list-item>

          <div v-if="c.isOpen" class="px-4 py-2 bg-blue-grey-lighten-5">
            <card-loader :qualified_id="c.id" :view-lookup="viewLookup" class="elevation-1" />

            <tags-input
              v-show="internalEditMode === 'tags' && editMode === 'full'"
              :course-i-d="courseId"
              :card-i-d="c.id.includes('-') ? c.id.split('-')[1] : c.id"
              class="mt-4"
            />

            <div v-show="internalEditMode === 'flag' && editMode === 'full'" class="mt-4">
              <v-btn color="error" variant="outlined" @click="c.delBtn = true"> Delete this card </v-btn>
              <span v-if="c.delBtn" class="ml-4">
                <span class="mr-2">Are you sure?</span>
                <v-btn color="error" variant="elevated" @click="deleteCard(c.id)"> Confirm </v-btn>
              </span>
            </div>
          </div>
        </template>
      </v-list>

      <paginating-toolbar
        class="elevation-0"
        :page="page"
        :pages="pages"
        @first="first"
        @prev="prev"
        @next="next"
        @last="last"
        @set-page="(n) => setPage(n)"
      />
    </div>
  </v-card>
</template>

<script lang="ts">
import { defineComponent, PropType } from 'vue';
import { displayableDataToViewData, Status, CourseElo } from '@vue-skuilder/common';
import { getDataLayer, CourseDBInterface, CardData, DisplayableData, Tag } from '@vue-skuilder/db';
// local imports
import TagsInput from './TagsInput.vue';
import PaginatingToolbar from './PaginatingToolbar.vue';
import { ViewComponent } from '../composables/Displayable';
import CardLoader from './cardRendering/CardLoader.vue';
import { alertUser } from './SnackbarService';

// Legacy isConstructor function removed - no longer needed for Vue 3 components

export default defineComponent({
  name: 'CourseCardBrowser',

  components: {
    CardLoader,
    TagsInput,
    PaginatingToolbar,
  },

  props: {
    courseId: {
      type: String,
      required: true,
    },
    tagId: {
      type: String,
      required: false,
      default: '',
    },
    viewLookupFunction: {
      type: Function,
      required: true,
      default: () => {
        console.warn('No viewLookupFunction provided to CourseCardBrowser');
        return null;
      },
    },
    editMode: {
      type: String as PropType<'none' | 'readonly' | 'full'>,
      required: false,
      default: 'full',
    },
  },

  data() {
    return {
      courseDB: null as CourseDBInterface | null,
      page: 1,
      pages: [] as number[],
      cards: [] as { id: string; isOpen: boolean; delBtn: boolean }[],
      cardData: {} as { [card: string]: string[] },
      cardPreview: {} as { [card: string]: string },
      cardElos: {} as Record<string, CourseElo>,
      internalEditMode: 'none' as 'tags' | 'flag' | 'none',
      delBtn: false,
      updatePending: true,
      userIsRegistered: false,
      questionCount: 0,
      tags: [] as Tag[],
      viewLookup: this.viewLookupFunction,
    };
  },

  async created() {
    try {
      this.courseDB = getDataLayer().getCourseDB(this.courseId);

      if (this.tagId) {
        this.questionCount = (await this.courseDB.getTag(this.tagId)).taggedCards.length;
      } else {
        this.questionCount = (await this.courseDB!.getCourseInfo()).cardCount;
      }

      for (let i = 1; (i - 1) * 25 < this.questionCount; i++) {
        this.pages.push(i);
      }

      await this.populateTableData();
    } catch (error) {
      console.error('Error initializing CourseCardBrowser:', error);
    } finally {
      this.updatePending = false;
    }
  },

  methods: {
    idParse(id: string): string {
      const delimiters = id.includes('-');
      if (delimiters) {
        return id.split('-')[1];
      } else {
        return id;
      }
    },

    first() {
      this.page = 1;
      this.populateTableData();
    },
    prev() {
      this.page--;
      this.populateTableData();
    },
    next() {
      this.page++;
      this.populateTableData();
    },
    last() {
      this.page = this.pages.length;
      this.populateTableData();
    },
    setPage(n: number) {
      this.page = n;
      this.populateTableData();
    },
    clearSelections(exception: string = '') {
      this.cards.forEach((card) => {
        if (card.id !== exception) {
          card.isOpen = false;
        }
      });
      this.internalEditMode = 'none';
      this.delBtn = false;
    },
    async deleteCard(cID: string) {
      console.log(`Deleting card ${cID}`);
      const res = await this.courseDB!.removeCard(this.idParse(cID));
      if (res.ok) {
        this.cards = this.cards.filter((card) => card.id != cID);
        this.clearSelections();
      } else {
        console.error(`Failed to delete card:\n\n${JSON.stringify(res)}`);
        alertUser({
          text: 'Failed to delete card',
          status: Status.error,
        });
      }
    },
    async populateTableData() {
      this.updatePending = true;
      if (this.tagId) {
        const tag = await this.courseDB!.getTag(this.tagId);
        this.cards = tag.taggedCards.map((c) => {
          return { id: `${this.courseId}-${c}`, isOpen: false, delBtn: false };
        });
      } else {
        this.cards = (await this.courseDB!.getCardsByELO(0, 25)).map((c) => {
          return {
            id: c,
            isOpen: false,
            delBtn: false,
          };
        });
      }

      const toRemove: string[] = [];
      const hydratedCardData = (
        await this.courseDB!.getCourseDocs<CardData>(
          this.cards.map((c) => this.idParse(c.id)),
          {
            include_docs: true,
          }
        )
      ).rows
        .filter((r) => {
          if (r.doc) {
            return true;
          } else {
            console.error(`Card ${r.id}.doc not found.\ncard: ${JSON.stringify(r)}`);
            // toRemove.push(r.id);
            // if (this.tagId) {
            //   this.courseDB!.removeTagFromCard(r.id, this.tagId);
            // }
            return false;
          }
        })
        .map((r) => r.doc!);

      this.cards = this.cards.filter((c) => !toRemove.includes(this.idParse(c.id)));

      hydratedCardData.forEach((c) => {
        if (c && c.id_displayable_data) {
          this.cardData[c._id] = c.id_displayable_data;
        }
      });

      try {
        await Promise.all(
          this.cards.map(async (c) => {
            const _cardID: string = this.idParse(c.id);

            const tmpCardData = hydratedCardData.find((c) => c._id == _cardID);
            if (!tmpCardData || !tmpCardData.id_displayable_data) {
              console.error(`No valid data found for card ${_cardID}`);
              return;
            }
            const tmpView: ViewComponent = this.viewLookupFunction(
              tmpCardData.id_view || 'default.question.BlanksCard.FillInView'
            );

            const tmpDataDocs = tmpCardData.id_displayable_data.map((id) => {
              return this.courseDB!.getCourseDoc<DisplayableData>(id, {
                attachments: false,
                binary: true,
              });
            });

            const allDocs = await Promise.all(tmpDataDocs);
            await Promise.all(
              allDocs.map((doc) => {
                const tmpData = [];
                tmpData.unshift(displayableDataToViewData(doc));

                // Vue 3: Use component name for preview (legacy constructor code removed)
                this.cardPreview[c.id] = tmpView.name ? tmpView.name : 'Unknown';
              })
            );
          })
        );

        // Load ELO data for all cards
        const cardIds = this.cards.map((c) => this.idParse(c.id));
        const eloData =
          this.cards[0].id.split('-').length === 3
            ? this.cards.map((c) => c.id.split('-')[2]) // for platform-ui crs-card-elo IDs
            : await this.courseDB!.getCardEloData(cardIds); // general case lookup

        // Store ELO data indexed by card ID
        cardIds.forEach((cardId, index) => {
          this.cardElos[cardId] = eloData[index];
        });
      } catch (error) {
        console.error('Error populating table data:', error);
      } finally {
        this.updatePending = false;
        this.$forceUpdate();
      }
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

.component-scale-enter-active,
.component-scale-leave-active {
  max-height: auto;
  transform: scale(1, 1);
  transform-origin: top;
  transition:
    transform 0.3s ease,
    max-height 0.3s ease;
}
.component-scale-enter,
.component-fade-leave-to {
  max-height: 0px;
  transform: scale(1, 0);
  overflow: hidden;
}
</style>
