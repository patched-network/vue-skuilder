<template>
  <v-app v-if="ready">
    <v-navigation-drawer v-model="drawer" :elevation="2" :rail="rail" @click="rail = false">
      <v-list>
        <v-list-item to="/home" value="home">
          <template #prepend>
            <v-icon icon="mdi-home"></v-icon>
          </template>
          <SkMouseTrapToolTip hotkey="g h" command="Go to Home" highlight-effect="none" position="right">
            <v-list-item-title>Home</v-list-item-title>
          </SkMouseTrapToolTip>
        </v-list-item>

        <v-list-item to="/study" value="study">
          <template #prepend>
            <v-icon icon="mdi-school"></v-icon>
          </template>
          <SkMouseTrapToolTip hotkey="g s" command="Go to Study" highlight-effect="none" position="right">
            <v-list-item-title>Study</v-list-item-title>
          </SkMouseTrapToolTip>
        </v-list-item>

        <v-list-item to="/classrooms" value="classrooms">
          <template #prepend>
            <v-icon icon="mdi-account-group"></v-icon>
          </template>
          <SkMouseTrapToolTip hotkey="g c" command="Go to Classrooms" highlight-effect="none" position="right">
            <v-list-item-title>Classrooms</v-list-item-title>
          </SkMouseTrapToolTip>
        </v-list-item>

        <v-list-item to="/quilts" value="quilts">
          <template #prepend>
            <v-icon icon="mdi-bookmark-multiple"></v-icon>
          </template>
          <SkMouseTrapToolTip hotkey="g q" command="Go to Quilts" highlight-effect="none" position="right">
            <v-list-item-title>Quilts</v-list-item-title>
          </SkMouseTrapToolTip>
        </v-list-item>
      </v-list>
    </v-navigation-drawer>

    <v-app-bar density="compact">
      <SkMouseTrapToolTip hotkey="m" command="Toggle Menu" highlight-effect="none" position="right">
        <v-app-bar-nav-icon @click.stop="toggleDrawer"></v-app-bar-nav-icon>
      </SkMouseTrapToolTip>
      <v-spacer></v-spacer>
      <user-login-and-registration-container :show-registration="false" />
    </v-app-bar>

    <v-main>
      <v-container>
        <router-view v-slot="{ Component }">
          <v-fade-transition mode="out-in">
            <component :is="Component" />
          </v-fade-transition>
        </router-view>
      </v-container>
    </v-main>

    <!-- <v-footer fixed app>
      <span>
       v: <router-link to='/notes'>{{build}}</router-link>
      </span>
    </v-footer> -->
    <snackbar-service id="SnackbarService" />
    <SkMouseTrap />

    <!-- <v-footer app class="pa-0" color="transparent">
      <v-card flat width="100%" class="text-center">
        <v-card-text class="text-body-2 text-medium-emphasis">
          <v-icon small class="me-1">mdi-keyboard</v-icon>
          Tip: Hold <kbd>Ctrl</kbd> to see keyboard shortcuts or press <kbd>?</kbd> to view all shortcuts
        </v-card-text>
      </v-card>
    </v-footer> -->
  </v-app>
</template>

<script lang="ts" setup>
import { ref, computed, onBeforeMount, onMounted, watch } from 'vue';
import { useTheme } from 'vuetify';
import {
  UserLoginAndRegistrationContainer,
  SnackbarService,
  SkMouseTrapToolTip,
  SkMouseTrap,
  SkldrMouseTrap,
  useConfigStore,
  useAuthStore,
} from '@vue-skuilder/common-ui';

defineOptions({
  name: 'App',
});

// const build = ref('0.0.2');
const latestBuild = ref('');
const drawer = ref(true);
const authStore = useAuthStore();
const configStore = useConfigStore();
const theme = useTheme();
const rail = ref(false);

const ready = ref(false);

const toggleDrawer = () => {
  drawer.value = !drawer.value;
  // Optional: reset rail when drawer is toggled
  if (!drawer.value) {
    rail.value = false;
  }
};

const dark = computed(() => {
  return configStore.config.darkMode;
});

watch(
  dark,
  (newVal) => {
    theme.global.name.value = newVal ? 'dark' : 'light';
  },
  { immediate: true }
);

onBeforeMount(async () => {
  await authStore.init();
  await configStore.init();

  ready.value = true;
});

onMounted(async () => {
  latestBuild.value = 'buildValue not implemented';

  // Add a global shortcut to show the keyboard shortcuts dialog
  SkldrMouseTrap.addBinding({
    hotkey: '?',
    command: 'Show keyboard shortcuts',
    callback: () => {
      const keyboardButton = document.querySelector('.mdi-keyboard');
      if (keyboardButton) {
        (keyboardButton as HTMLElement).click();
      }
    },
  });
});
</script>

<style>
code:before,
code:after {
  content: none !important;
}
</style>
