<template>
  <v-btn size="large" icon :color="playing ? 'primary lighten-3' : 'primary'" :class="{ playing }" @click="play">
    <v-icon>mdi-volume-high</v-icon>
  </v-btn>
</template>

<script setup lang="ts">
import { ref, onBeforeUnmount, onMounted, getCurrentInstance } from 'vue';
import { SkldrMouseTrap } from '../../utils/SkldrMouseTrap';

const props = defineProps<{
  src: string | string[];
}>();

const audioElems = ref<HTMLAudioElement[]>([]);
const playTimeouts = ref<NodeJS.Timer[]>([]);
const playing = ref(false);

let staticLOCK: any = null;
const playbackGap = 500;

const stop = () => {
  playing.value = false;
  setTimeout(() => {
    staticLOCK = null;
  }, playbackGap);

  playTimeouts.value.forEach(clearTimeout);

  console.log(`Audio stopping...`);
  audioElems.value.forEach((audio) => {
    if (!audio.paused) {
      audio.pause();
      audio.currentTime = 0;
    }
  });
};

const downloadFinished = (i: number): boolean => {
  try {
    return !isNaN(audioElems.value[i].duration);
  } catch (e) {
    throw new Error('AudioPlayer does not have an element at this index:', e);
  }
};

const playByIndex = (n: number) => {
  if (downloadFinished(n)) {
    audioElems.value[n].play();

    if (n + 1 < audioElems.value.length) {
      const delay = (audioElems.value[n].duration + 0.7) * 1000;
      playTimeouts.value.push(
        setTimeout(() => {
          if (playing.value) {
            playByIndex(n + 1);
          }
        }, delay)
      );
    } else {
      setTimeout(() => {
        playing.value = false;
      }, audioElems.value[n].duration * 1000);
      setTimeout(() => {
        staticLOCK = null;
      }, audioElems.value[n].duration * 1000 + playbackGap);
    }
  } else {
    setTimeout(playByIndex, 100, n);
  }
};

const play = () => {
  if (staticLOCK === null || staticLOCK === getCurrentInstance()) {
    staticLOCK = getCurrentInstance();
    playing.value = true;
    playByIndex(0);
  } else {
    setTimeout(play, 100);
  }
};

onMounted(() => {
  staticLOCK = null;

  if (typeof props.src === 'string') {
    audioElems.value.push(new Audio(props.src));
  } else {
    props.src.forEach((url) => {
      audioElems.value.push(new Audio(url));
    });
  }

  // Define hotkeys
  const hotkeys = [
    {
      hotkey: 'up',
      callback: play,
      command: 'Replay Audio',
    },
  ];
  
  // Add bindings
  SkldrMouseTrap.addBinding(hotkeys);

  play();
});

onBeforeUnmount(() => {
  // Clean up hotkey bindings
  SkldrMouseTrap.removeBinding('up');
  stop();
});
</script>

<style scoped>
.playing {
  /* transform: rotate(3deg) scale(1.15); */
  animation: 0.85s ease-in-out infinite alternate pulse;
  z-index: 1;
}

@keyframes pulse {
  0% {
    transform: scale(1);
  }
  100% {
    transform: scale(1.15);
  }
}
</style>
