// Display-only helpers shared by the admin views: colours, icons, and
// locale-formatted times. Anything a text export also needs lives in
// @vue-skuilder/db/diagnostics instead.
import { ref, type Ref } from 'vue';
import type { SessionFlag } from '@vue-skuilder/db/diagnostics';

export const FLAG_UI: Record<SessionFlag, { icon: string; color: string }> = {
  churned: { icon: 'mdi-autorenew', color: 'warning' },
  'out-of-content': { icon: 'mdi-cup-off-outline', color: 'error' },
  walked: { icon: 'mdi-exit-run', color: 'error' },
  stalled: { icon: 'mdi-arrow-collapse-horizontal', color: 'grey' },
  grinding: { icon: 'mdi-alert-octagon-outline', color: 'warning' },
};

export function statusColor(status: string): string {
  if (status === 'closed') return 'success';
  if (status === 'abandoned') return 'warning';
  return 'error'; // 'open': the tab went away before close
}

export function accuracyClass(a: number | null): string {
  if (a === null) return 'text-disabled';
  if (a >= 0.8) return 'text-success';
  if (a < 0.5) return 'text-error';
  return '';
}

export function deltaClass(d: number | null): string {
  if (d === null || d === 0) return 'text-disabled';
  return d > 0 ? 'text-success' : 'text-error';
}

export function deltaColor(d: number): string {
  if (d > 0) return 'success';
  if (d < 0) return 'error';
  return 'grey';
}

export function fmtTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

/** Time of day only: a session timeline reads as a within-sitting sequence. */
export function fmtClock(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleTimeString(undefined, { hour12: false });
}

export function shortId(id: string, max = 28): string {
  return id.length > max ? `…${id.slice(-(max - 2))}` : id;
}

/** Copy text, and remember which control asked, briefly, for a tick. */
export function useCopy(): {
  copied: Ref<string | null>;
  copy: (text: string, key: string) => Promise<void>;
} {
  const copied = ref<string | null>(null);
  let timer: ReturnType<typeof setTimeout> | null = null;
  async function copy(text: string, key: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      copied.value = key;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => (copied.value = null), 1400);
    } catch (e) {
      console.warn('[admin] clipboard write failed', e);
    }
  }
  return { copied, copy };
}
