<template>
  <v-dialog v-if="display" max-width="500px" transition="dialog-transition">
    <template #activator="{ props }">
      <v-btn icon color="primary" v-bind="props"> ? </v-btn>
    </template>

    <v-card>
      <v-toolbar color="teal" dark>
        <v-toolbar-title>Shortcut keys for this card:</v-toolbar-title>
        <v-spacer></v-spacer>
      </v-toolbar>
      <v-list>
        <v-list-item v-for="hk in commands" :key="Array.isArray(hk.hotkey) ? hk.hotkey.join(',') : hk.hotkey">
          <v-btn variant="outlined" color="black">
            {{ Array.isArray(hk.hotkey) ? hk.hotkey[0] : hk.hotkey }}
          </v-btn>
          <v-spacer></v-spacer>
          <span class="text-right">
            {{ hk.command }}
          </span>
        </v-list-item>
      </v-list>
    </v-card>
  </v-dialog>
</template>

<script lang="ts">
import { defineComponent, PropType } from 'vue';
import SkldrMouseTrap, { HotKeyMetaData } from '../utils/SkldrMouseTrap';
import { SkMouseTrapProps } from './SkMouseTrap.types';

export default defineComponent({
  name: 'SkMouseTrap',

  props: {
    refreshInterval: {
      type: Number as PropType<SkMouseTrapProps['refreshInterval']>,
      default: 500,
    },
  },

  data() {
    return {
      commands: [] as HotKeyMetaData[],
      display: false,
      intervalId: null as number | null,
    };
  },

  created() {
    this.intervalId = window.setInterval(this.refreshState, this.refreshInterval);
  },

  beforeUnmount() {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
    }
  },

  methods: {
    refreshState() {
      this.commands = SkldrMouseTrap.commands;
      this.display = this.commands.length > 0;
    },
  },
});
</script>
