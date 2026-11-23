<!-- Mounted after every docs page (Layout 'doc-after' slot). Marks the page as read once the
     reader has stayed a while and scrolled most of the way down, or stayed long enough. -->
<template>
  <span class="docs-read-tracker" aria-hidden="true" />
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, watch } from 'vue';
import { useData } from 'vitepress';
import { markRead, pageKey } from './reading';

const MIN_DWELL_MS = 10_000; // ignore drive-by visits
const LONG_DWELL_MS = 60_000; // long enough to count without scrolling
const SCROLL_FRACTION = 0.7;

const { page } = useData();

let arrivedAt = 0;
let reachedDepth = false;
let timer: number | undefined;

function key(): string | null {
  const rel = page.value.relativePath;
  if (!rel || rel === 'index.md' || rel.startsWith('dbg/')) return null;
  return pageKey(rel);
}

function check() {
  const k = key();
  if (!k || document.visibilityState !== 'visible') return;
  const doc = document.documentElement;
  const depth = (window.scrollY + window.innerHeight) / Math.max(doc.scrollHeight, 1);
  if (depth >= SCROLL_FRACTION) reachedDepth = true;
  const dwell = Date.now() - arrivedAt;
  if ((reachedDepth && dwell >= MIN_DWELL_MS) || dwell >= LONG_DWELL_MS) markRead(k);
}

function arrive() {
  arrivedAt = Date.now();
  reachedDepth = false;
}

onMounted(() => {
  arrive();
  window.addEventListener('scroll', check, { passive: true });
  timer = window.setInterval(check, 5_000);
});

onUnmounted(() => {
  window.removeEventListener('scroll', check);
  window.clearInterval(timer);
});

watch(() => page.value.relativePath, arrive);
</script>
