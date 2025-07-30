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
        <v-chip v-if="selectedUserId" color="primary" class="mt-2">
          Viewing data for: {{ selectedUserId }}
        </v-chip>
      </v-card-text>
    </v-card>

    <!-- Card Search Section -->
    <card-search @search="onSearch" />
    <card-search-results v-if="query" :query="query" :data-layer="dataLayer" @card-selected="onCardSelected" />
    
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
import { CardSearch, CardSearchResults, CardHistoryViewer, getCurrentUser } from '@vue-skuilder/common-ui';
import { getDataLayer } from '@vue-skuilder/db';
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
      userOptions: [] as UserOption[],
    };
  },
  async created() {
    this.userDB = await getCurrentUser();
    this.userId = this.userDB.getUsername();
    this.dataLayer = await getDataLayer();
    this.adminDB = this.dataLayer.getAdminDB();
    
    // Load user list for selection
    await this.loadUsers();
  },
  methods: {
    async loadUsers() {
      try {
        const users = await this.adminDB!.getUsers();
        this.userOptions = users
          .filter(user => user.name && !user.name.startsWith('Guest_'))
          .map(user => ({
            label: user.name || 'Unknown User',
            value: user.name || '',
          }))
          .filter(option => option.value !== '');
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
  },
});
</script>

<style scoped>
.admin-dashboard {
  padding: 2rem;
}
</style>