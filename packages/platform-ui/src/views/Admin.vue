<template>
  <v-container>
    <v-row>
      <v-col>
        <h1 class="text-h3 mb-6">{{ title }}</h1>

        <!-- Users Section -->
        <v-card class="mb-6">
          <v-card-title>
            <h3>Users - {{ registeredUsers.length }}</h3>
          </v-card-title>
          <v-card-text>
            <v-list>
              <v-list-item v-for="u in registeredUsers" :key="u._id">
                <v-list-item-title>User: {{ u.name }}</v-list-item-title>
              </v-list-item>
            </v-list>
          </v-card-text>
        </v-card>

        <!-- Quilts Section -->
        <v-card class="mb-6">
          <v-card-title>
            <h3>
              <router-link to="/courses" class="text-decoration-none">Quilts</router-link>
              - {{ courses.length }}
            </h3>
          </v-card-title>
          <v-card-text>
            <v-list>
              <v-list-item v-for="c in courses" :key="c._id">
                <v-list-item-title>
                  <router-link :to="`/q/${c._id}`" class="text-decoration-none">{{ c.name }}</router-link>
                  - {{ c._id }}
                  <v-btn density="compact" icon="mdi-close" variant="text" size="small" @click="removeCourse(c._id)" />
                </v-list-item-title>
              </v-list-item>
            </v-list>
          </v-card-text>
        </v-card>

        <!-- Classrooms Section -->
        <v-card>
          <v-card-title>
            <h3>Classrooms - {{ classrooms.length }}</h3>
          </v-card-title>
          <v-card-text>
            <v-list>
              <v-list-item v-for="c in classrooms" :key="c._id">
                <v-list-item-title>
                  <router-link :to="`/c/${c._id}`" class="text-decoration-none">{{ c.name }}</router-link>
                  {{ c.name }} - {{ c.teachers }} - {{ c.students.length }} students
                </v-list-item-title>
              </v-list-item>
            </v-list>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import { AdminDB } from '@vue-skuilder/db';
import { GuestUsername } from '@vue-skuilder/db';
interface User {
  _id: string;
  name: string;
}

interface Course {
  _id: string;
  name: string;
}

interface Classroom {
  _id: string;
  name: string;
  teachers: string[];
  students: string[];
}

export default defineComponent({
  name: 'AdminView',

  data() {
    return {
      title: 'Admin Panel',
      db: null as AdminDB | null,
      users: [] as User[],
      courses: [] as Course[],
      classrooms: [] as Classroom[],
    };
  },

  computed: {
    registeredUsers(): User[] {
      return this.users.filter((u) => {
        return !(u.name as string).startsWith(GuestUsername);
      });
    },
  },

  async created() {
    try {
      this.db = await AdminDB.factory();
      this.users = (await this.db.getUsers()) as unknown as User[];
      this.courses = (await this.db.getCourses()) as unknown as Course[];
      this.classrooms = await this.db.getClassrooms();
    } catch (e) {
      this.title = 'This page is for database admins only.';
      throw `${JSON.stringify(e)} - ${e}\n\nNot an admin!`;
    }
  },

  methods: {
    removeCourse(id: string): void {
      console.log(`Removing ${id}`);
      if (this.db) {
        this.db.removeCourse(id);
      }
    },
  },
});
</script>

<style scoped></style>
