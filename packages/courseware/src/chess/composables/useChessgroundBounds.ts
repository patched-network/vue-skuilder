import { onUnmounted, Ref, watch } from 'vue';
import type { Api as CgAPI } from '../chessground/api';

/**
 * Keep Chessground's cached board bounds in sync with the actual DOM.
 *
 * Chessground caches `getBoundingClientRect()` on the board element at
 * mount/redraw and uses it to translate pointer coordinates to squares.
 * If the surrounding layout shifts the board after mount — for example,
 * a flex-centered transition container in StudySession, font-load
 * reflow, or a parent that toggles visibility — the cached rect goes
 * stale and clicks land on the wrong squares.
 *
 * This composable:
 *   1. Forces a `redrawAll()` on the next animation frame after the
 *      Chessground API becomes available, catching the initial mount
 *      race against parent layout settling.
 *   2. Observes the board element with a ResizeObserver and triggers
 *      `redrawAll()` on any subsequent size change.
 *
 * Pass a ref to the board element and a ref to the Chessground API.
 * Cleanup is handled via `onUnmounted`.
 */
export function useChessgroundBounds(
  boardEl: Ref<HTMLElement | null | undefined>,
  api: Ref<CgAPI | undefined>
): void {
  let ro: ResizeObserver | null = null;

  const stop = watch(
    () => api.value,
    (cg) => {
      if (!cg || !boardEl.value) return;

      // Initial post-mount sync: parent flex/transition layout may
      // settle one frame after Chessground reads its bounding rect.
      requestAnimationFrame(() => cg.redrawAll());

      ro = new ResizeObserver(() => cg.redrawAll());
      ro.observe(boardEl.value);

      stop();
    },
    { immediate: true }
  );

  onUnmounted(() => {
    ro?.disconnect();
    ro = null;
  });
}
