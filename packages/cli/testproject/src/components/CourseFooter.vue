<template>
  <v-footer app padless>
    <v-container fluid>
      <v-row justify="center" align="center">
        <v-col cols="12" sm="8" class="text-center">
          <div v-if="links && links.length" class="d-flex justify-center mb-2">
            <v-btn
              v-for="link in links"
              :key="link.text"
              :href="link.url"
              text
              variant="plain"
              size="small"
              class="mx-1"
            >
              {{ link.text }}
            </v-btn>
          </div>
          <div class="text-body-2 text-medium-emphasis">
            {{ copyright }}
          </div>
        </v-col>
      </v-row>
    </v-container>
  </v-footer>
</template>

<script setup lang="ts">
defineProps<{
  links?: Array<{ text: string; url: string }>;
  copyright?: string;
}>();
</script>
