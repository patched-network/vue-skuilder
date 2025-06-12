<template>
  <v-container fluid class="fill-height">
    <v-row align="center">
      <v-col cols="12" class="text-left">
        <h1 :class="{ 'text-h3': display.xs, 'text-h2': display.smAndUp }">
          <span class="font-weight-thin">edu</span>
          <span class="font-weight-bold">Quilt</span>
        </h1>
        <p class="text-h5">
          <em>quilt</em>: (n) a <text-swap ref="swap1" :text="label" /> of
          <text-swap ref="swap2" :text="adjective" /> courseware that <text-swap ref="swap3" :text="subject" /> can
          <text-swap ref="swap4" :text="verb" />
        </p>
        <v-spacer class="my-12"></v-spacer>
        <div class="text-subtitle-1">(get cozy)</div>
      </v-col>
    </v-row>
  </v-container>
</template>

<script lang="ts">
import TextSwap from '@pui/components/TextSwap.vue';
import { defineComponent } from 'vue';
import { useDisplay } from 'vuetify';
import { ITextSwap } from '@pui/components/TextSwap.vue';

interface Data {
  swapIntervalID: number | null;
  label: string[];
  adjective: string[];
  subject: string[];
  verb: string[];
  swapsReady: boolean;
}

export default defineComponent({
  name: 'HomeView',

  components: {
    TextSwap,
  },

  setup() {
    const display = useDisplay();
    return { display };
  },

  data(): Data {
    return {
      swapIntervalID: null,
      label: ['collection', 'patchwork', 'network', 'jumble'],
      adjective: ['interactive', 'adaptive', 'interlinked', 'intelligent'],
      subject: ['anyone', 'everyone', 'you'],
      verb: ['edit', 'start', 'study', 'improve'],
      swapsReady: false,
    };
  },

  computed: {
    swaps(): ITextSwap[] {
      return [
        this.$refs.swap1 as ITextSwap,
        this.$refs.swap2 as ITextSwap,
        this.$refs.swap3 as ITextSwap,
        this.$refs.swap4 as ITextSwap,
      ];
    },
  },

  mounted() {
    this.$nextTick(() => {
      this.swapsReady = true;
      this.swapIntervalID = window.setInterval(this.randomSwap, 7000);
    });
  },

  beforeUnmount() {
    if (this.swapIntervalID !== null) {
      clearInterval(this.swapIntervalID);
      this.swapIntervalID = null;
    }
  },

  methods: {
    randomSwap(): void {
      if (!this.swapsReady) return;

      this.swaps.forEach((s) => {
        if (Math.random() < 0.33) s.next();
      });
    },
  },
});
</script>

<style scoped>
.section:first {
  padding: 0px 0px 0px 0px;
}
.pitch {
  padding: 50px 0px 0px 0px;
}
.section {
  width: 100%;
  transform: skewY(-4deg) !important;
  padding: 200px 0px;
  margin: 0px 0px;
  background-color: transparent;
}
.section > * {
  transform: skewY(4deg);
}

.step1 {
  background-color: skyblue;
}

.step2 {
  background-color: red;
}

.eduFade {
  animation: fadein 2s;
}

.quiltedFade {
  /* margin-top: 25px; */
  /* font-size: 21px; */
  /* text-align: center; */

  animation: delayfadein 2s ease-in-out;
}

@keyframes delayfadein {
  0% {
    opacity: 0;
  }
  33% {
    opacity: 0;
  }
  100% {
    opacity: 1;
  }
}

@keyframes fadein {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
</style>
