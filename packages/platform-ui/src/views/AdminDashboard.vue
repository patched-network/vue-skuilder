<template>
  <div class="admin-dashboard">
    <h1>Admin Dashboard</h1>

    <!-- User Selection Section -->
    <v-card class="mb-4">
      <v-card-title>User Selection</v-card-title>
      <v-card-text>
        <v-select
          v-model="selectedUserId"
          :items="userOptions"
          item-title="label"
          item-value="value"
          label="Select User"
          @update:model-value="onUserSelected"
        ></v-select>
        <v-chip v-if="selectedUserId" color="primary" class="mt-2"> Viewing data for: {{ selectedUserId }} </v-chip>
      </v-card-text>
    </v-card>

    <!-- Course Filter Section -->
    <v-card class="mb-4">
      <v-card-title>Search Filters</v-card-title>
      <v-card-text>
        <v-select
          v-model="selectedCourseId"
          :items="courseOptions"
          item-title="label"
          item-value="value"
          label="Filter by Course (optional)"
          clearable
          @update:model-value="onCourseFilterChanged"
        ></v-select>
        <div v-if="selectedCourseId" class="mt-2">
          <v-chip color="info" class="mb-1"> 🎯 {{ getCourseNameById(selectedCourseId) }} </v-chip>
          <div v-if="getSelectedCourseDetails()" class="text-caption text-grey-darken-1">
            {{ getSelectedCourseDetails() }}
          </div>
        </div>
        <v-chip v-else color="warning" class="mt-2">
          ⚠️ Searching ALL {{ courseOptions.length }} courses (may be slow)
        </v-chip>
      </v-card-text>
    </v-card>

    <!-- Card Search Section -->
    <card-search @search="onSearch" />
    <v-row>
      <v-col cols="6">
        <card-search-results
          v-if="query"
          :query="query"
          :data-layer="dataLayer"
          :course-filter="selectedCourseId"
          @card-selected="onCardSelected"
        />
      </v-col>
      <v-col cols="6">
        <card-loader
          v-if="selectedCard"
          :qualified_id="{ courseID: selectedCard.courseId, cardID: selectedCard.cardId }"
          :view-lookup="viewLookup"
        />
      </v-col>
    </v-row>

    <!-- Card History Section -->
    <card-history-viewer
      v-if="selectedCard && selectedUserReader"
      :card-id="selectedCard.cardId"
      :course-id="selectedCard.courseId"
      :user-id="selectedUserId"
      :user-d-b="selectedUserReader"
    />
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import { CardSearch, CardSearchResults, CardHistoryViewer, CardLoader, getCurrentUser } from '@vue-skuilder/common-ui';
import { getDataLayer, CourseLookup } from '@vue-skuilder/db';
import { allCourseWare } from '@vue-skuilder/courseware';
import { UserDBInterface, UserDBReader, DataLayerProvider, AdminDBInterface } from '@vue-skuilder/db';

interface UserOption {
  label: string;
  value: string;
}

export default defineComponent({
  name: 'AdminDashboard',
  components: {
    CardSearch,
    CardSearchResults,
    CardHistoryViewer,
    CardLoader,
  },
  data() {
    return {
      query: '',
      selectedCard: null as { cardId: string; courseId: string } | null,
      userId: '',
      userDB: null as UserDBInterface | null,
      dataLayer: null as DataLayerProvider | null,
      adminDB: null as AdminDBInterface | null,
      selectedUserId: '',
      selectedUserReader: null as UserDBReader | null,
      selectedCourseId: null as string | null,
      userOptions: [] as UserOption[],
      courseOptions: [] as UserOption[],
    };
  },
  async created() {
    this.userDB = await getCurrentUser();
    this.userId = this.userDB.getUsername();
    this.dataLayer = await getDataLayer();
    this.adminDB = this.dataLayer.getAdminDB();

    // Load user list for selection
    await this.loadUsers();

    // Load available courses
    await this.loadCourses();
  },
  methods: {
    async loadUsers() {
      try {
        const users = await this.adminDB!.getUsers();
        this.userOptions = users
          .filter((user) => user.name && !user.name.startsWith('Guest_'))
          .map((user) => ({
            label: user.name || 'Unknown User',
            value: user.name || '',
          }))
          .filter((option) => option.value !== '');
      } catch (error) {
        console.error('Failed to load users:', error);
      }
    },

    async onUserSelected(userId: string) {
      if (!userId) {
        this.selectedUserReader = null;
        return;
      }

      try {
        this.selectedUserReader = await this.dataLayer!.createUserReaderForUser(userId);
      } catch (error) {
        console.error('Failed to create user reader:', error);
        this.selectedUserReader = null;
      }
    },

    onSearch(query: string) {
      this.query = query;
    },

    onCardSelected(card: { cardId: string; courseId: string }) {
      this.selectedCard = card;
    },

    async loadCourses() {
      try {
        // Try efficient lookup-only approach first
        // const coursesDB = this.dataLayer!.getCoursesDB();

        // Get basic course list from lookup DB (lightweight, just IDs and basic names)
        const lookupCourses = await CourseLookup.allCourseWare();

        this.courseOptions = lookupCourses
          .filter((course) => course._id)
          .map((course) => {
            const courseName = course.name && course.name.trim();
            let displayName: string;
            let sortKey: string;

            if (courseName && courseName !== course._id && courseName !== '') {
              // Has a real name different from ID
              displayName = courseName;
              sortKey = courseName.toLowerCase();
            } else {
              // No name or name is same as ID - use ID
              displayName = course._id;
              sortKey = course._id.toLowerCase();
            }

            // Simple display without expensive metadata lookups
            return {
              label: `📚 ${displayName}`,
              value: course._id,
              sortKey,
            };
          })
          .sort((a, b) => a.sortKey.localeCompare(b.sortKey));

        console.log(`Loaded ${this.courseOptions.length} courses for filtering (lightweight mode)`);
      } catch (error) {
        console.error('Failed to load courses (lightweight):', error);
        // Fallback to expensive approach
        await this.loadCoursesExpensive();
      }
    },

    async loadCoursesExpensive() {
      try {
        console.log('Using expensive course loading (full configs)...');
        const adminDB = this.dataLayer!.getAdminDB();
        const basicCourseList = await adminDB.getCourses(); // This fetches full configs

        this.courseOptions = basicCourseList
          .filter((course) => course.courseID)
          .map((course) => {
            const courseName = course.name && course.name.trim();
            const creator = course.creator ? ` (${course.creator})` : '';

            let displayName: string;
            let sortKey: string;

            if (courseName && courseName !== course.courseID) {
              // Has a real name different from ID
              displayName = courseName;
              sortKey = courseName.toLowerCase();
            } else {
              // No name or name is same as ID - use ID
              displayName = course.courseID!;
              sortKey = course.courseID!.toLowerCase();
            }

            const visibility = course.public ? '🌐' : '🔒';

            return {
              label: `${visibility} ${displayName}${creator}`,
              value: course.courseID!,
              sortKey,
            };
          })
          .sort((a, b) => a.sortKey.localeCompare(b.sortKey));

        console.log(`Loaded ${this.courseOptions.length} courses for filtering (expensive mode)`);
      } catch (error) {
        console.error('Failed to load courses (expensive):', error);
        // Final fallback
        this.loadCoursesBasic();
      }
    },

    async loadCoursesBasic() {
      try {
        // Fallback: just get course IDs from lookup DB (fast)
        console.log('Using fallback course loading (IDs only)');
        // This would need a new method that just gets the lookup docs without full configs
        // For now, we'll show a basic message
        this.courseOptions = [{ label: '⚠️ Course names not available - using IDs only', value: '' }];
      } catch (error) {
        console.error('Failed to load basic courses:', error);
      }
    },

    onCourseFilterChanged() {
      // If there's an active search, re-run it with the new filter
      if (this.query) {
        // The CardSearchResults component will automatically re-search with the new filter
      }
    },

    getCourseNameById(courseId: string): string {
      const course = this.courseOptions.find((c) => c.value === courseId);
      return course ? course.label : courseId;
    },

    getSelectedCourseDetails(): string {
      if (!this.selectedCourseId) return '';

      // For now, just return the ID as additional context
      return `ID: ${this.selectedCourseId}`;
    },

    viewLookup(viewDescriptor: unknown) {
      return allCourseWare.getView(viewDescriptor);
    },
  },
});
</script>

<style scoped>
.admin-dashboard {
  padding: 2rem;
}
</style>
