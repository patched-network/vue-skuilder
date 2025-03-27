<template>
  <v-card v-if="!updatePending">
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
              v-model="c.isOpen"
              location="left center"
              transition="slide-x-transition"
              style="display: flex; flex-direction: row-reverse"
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
                :variant="editMode !== 'tags' ? 'outlined' : 'elevated'"
                :color="editMode === 'tags' ? 'teal' : 'teal-darken-3'"
                @click.stop="editMode = 'tags'"
              >
                <v-icon>mdi-bookmark</v-icon>
              </v-btn>

              <v-btn
                key="flag"
                icon
                size="small"
                :variant="editMode !== 'flag' ? 'outlined' : 'elevated'"
                :color="editMode === 'flag' ? 'error' : 'error-darken-3'"
                @click.stop="editMode = 'flag'"
              >
                <v-icon>mdi-flag</v-icon>
              </v-btn>
            </v-speed-dial>
          </template>
        </v-list-item>

        <div v-if="c.isOpen" class="px-4 py-2 bg-blue-grey-lighten-5">
          <card-loader :qualified_id="c.id" :view-lookup="viewLookup" class="elevation-1" />

          <tags-input v-show="editMode === 'tags'" :course-i-d="_id" :card-i-d="c.id.split('-')[1]" class="mt-4" />

          <div v-show="editMode === 'flag'" class="mt-4">
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
  </v-card>
</template>

<script lang="ts">
import { displayableDataToViewData } from '@vue-skuilder/common';
import TagsInput from '@/components/Edit/TagsInput.vue';
import { PaginatingToolbar, ViewComponent, CardLoader } from '@vue-skuilder/common-ui';
import Courses from '@vue-skuilder/courses';
import {
  getCourseDB,
  getCourseDoc,
  getCourseDocs,
  CourseDB,
  getTag,
  removeTagFromCard,
  CardData,
  DisplayableData,
  DocType,
  Tag,
} from '@vue-skuilder/db';
import { defineComponent } from 'vue';
import { alertUser } from '@vue-skuilder/common-ui';
import { Status } from '@vue-skuilder/common';
import { getCurrentUser } from '@/stores/useAuthStore';

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
    _id: {
      type: String,
      required: true,
    },
    _tag: {
      type: String,
      required: false,
      default: '',
    },
  },

  data() {
    return {
      courseDB: null as CourseDB | null,
      page: 1,
      pages: [] as number[],
      cards: [] as { id: string; isOpen: boolean; delBtn: boolean }[],
      cardData: {} as { [card: string]: string[] },
      cardPreview: {} as { [card: string]: string },
      editMode: 'none' as 'tags' | 'flag' | 'none',
      delBtn: false,
      updatePending: true,
      userIsRegistered: false,
      questionCount: 0,
      tags: [] as Tag[],
      viewLookup: Courses.getView,
    };
  },

  async created() {
    this.courseDB = new CourseDB(this._id, getCurrentUser);

    if (this._tag) {
      this.questionCount = (await getTag(this._id, this._tag)).taggedCards.length;
    } else {
      this.questionCount = (
        await getCourseDB(this._id).find({
          selector: {
            docType: DocType.CARD,
          },
          limit: 1000,
        })
      ).docs.length;
    }

    for (let i = 1; (i - 1) * 25 < this.questionCount; i++) {
      this.pages.push(i);
    }

    await this.populateTableData();
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
      this.editMode = 'none';
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
      if (this._tag) {
        const tag = await getTag(this._id, this._tag);
        this.cards = tag.taggedCards.map((c) => {
          return { id: `${this._id}-${c}`, isOpen: false, delBtn: false };
        });
      } else {
        this.cards = (
          await this.courseDB!.getCardsByEloLimits({
            low: 0,
            high: Number.MAX_SAFE_INTEGER,
            limit: 25,
            page: this.page - 1,
          })
        ).map((c) => {
          return {
            id: c,
            isOpen: false,
            delBtn: false,
          };
        });
      }

      const toRemove: string[] = [];
      const hydratedCardData = (
        await getCourseDocs<CardData>(
          this._id,
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
            console.error(`Card ${r.id} not found`);
            toRemove.push(r.id);
            if (this._tag) {
              removeTagFromCard(this._id, r.id, this._tag);
            }
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

      this.cards.forEach(async (c) => {
        const _courseID: string = c.id.split('-')[0];
        const _cardID: string = c.id.split('-')[1];

        const tmpCardData = hydratedCardData.find((c) => c._id == _cardID);
        if (!tmpCardData || !tmpCardData.id_displayable_data) {
          console.error(`No valid data found for card ${_cardID}`);
          return;
        }
        const tmpView: ViewComponent = Courses.getView(tmpCardData.id_view || 'default.question.BlanksCard.FillInView');

        const tmpDataDocs = tmpCardData.id_displayable_data.map((id) => {
          return getCourseDoc<DisplayableData>(_courseID, id, {
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
              (view as any).data = tmpData;

              this.cardPreview[c.id] = view.toString();
            } else {
              this.cardPreview[c.id] = tmpView.name ? tmpView.name : 'Unknown';
            }
          })
        );

        this.updatePending = false;
        this.$forceUpdate();
      });
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
  transition: transform 0.3s ease, max-height 0.3s ease;
}
.component-scale-enter,
.component-fade-leave-to {
  max-height: 0px;
  transform: scale(1, 0);
  overflow: hidden;
}
</style>
