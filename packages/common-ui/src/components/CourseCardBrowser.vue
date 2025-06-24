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
                  {{ c.id.split('-').length === 3 ? c.id.split('-')[2] : '' }}
                </v-list-item-subtitle>
              </div>
            </template>

            <template #append>
              <v-speed-dial
                v-if="editMode === 'full'"
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
              v-show="internalEditMode === 'tags'"
              :course-i-d="courseId"
              :card-i-d="c.id.split('-')[1]"
              class="mt-4"
            />

            <div v-show="internalEditMode === 'flag'" class="mt-4">
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
import { displayableDataToViewData, Status } from '@vue-skuilder/common';
import { getDataLayer, CourseDBInterface, CardData, DisplayableData, Tag } from '@vue-skuilder/db';
// local imports
import TagsInput from './TagsInput.vue';
import PaginatingToolbar from './PaginatingToolbar.vue';
import { ViewComponent } from '../composables/Displayable';
import CardLoader from './cardRendering/CardLoader.vue';
import { alertUser } from './SnackbarService';

function isConstructor(obj: unknown) {
  try {
    // @ts-expect-error - we are specifically probing an unknown object
    new obj();
    return true;
  } catch (e) {
    console.warn(`not a constructor: ${obj}, err: ${e}`);
    return false;
  }
}

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
      default: (x: unknown) => {
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
    async deleteCard(c: string) {
      console.log(`Deleting card ${c}`);
      const res = await this.courseDB!.removeCard(c.split('-')[1]);
      if (res.ok) {
        this.cards = this.cards.filter((card) => card.id != c);
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
          this.cards.map((c) => c.id.split('-')[1]),
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

      this.cards = this.cards.filter((c) => !toRemove.includes(c.id.split('-')[1]));

      hydratedCardData.forEach((c) => {
        if (c && c.id_displayable_data) {
          this.cardData[c._id] = c.id_displayable_data;
        }
      });

      try {
        await Promise.all(
          this.cards.map(async (c) => {
            const _cardID: string = c.id.split('-')[1];

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

                // [ ] remove/replace this after the vue 3 migration is complete
                // see PR #510
                if (isConstructor(tmpView)) {
                  const view = new tmpView();
                  view.data = tmpData;

                  this.cardPreview[c.id] = view.toString();
                } else {
                  this.cardPreview[c.id] = tmpView.name ? tmpView.name : 'Unknown';
                }
              })
            );
          })
        );
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
