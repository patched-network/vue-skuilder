import { ref, computed } from 'vue';
import { getUserStatus } from '../services/authAPI';
import type { Entitlement, UserEntitlements } from '../services/authAPI';

export interface TrialStatus {
  isActive: boolean;
  isPaid: boolean;
  daysRemaining: number | null;
  expiresDate: string | null;
}

/**
 * Composable for managing user entitlements and trial status
 *
 * @param courseId - The course identifier to check entitlements for
 * @returns Object with entitlements data and helper methods
 *
 * @example
 * ```typescript
 * const { trialStatus, hasPremiumAccess, fetchEntitlements, loading } = useEntitlements('letterspractice-basic');
 *
 * onMounted(async () => {
 *   await fetchEntitlements();
 *   console.log('Days remaining:', trialStatus.value.daysRemaining);
 * });
 * ```
 */
export function useEntitlements(courseId: string) {
  const entitlements = ref<UserEntitlements>({});
  const loading = ref(false);
  const error = ref<string | null>(null);

  /**
   * Get trial status for the specified course
   */
  const trialStatus = computed<TrialStatus>(() => {
    const entitlement: Entitlement | undefined = entitlements.value[courseId];

    if (!entitlement) {
      return {
        isActive: false,
        isPaid: false,
        daysRemaining: null,
        expiresDate: null,
      };
    }

    if (entitlement.status === 'paid') {
      return {
        isActive: true,
        isPaid: true,
        daysRemaining: null,
        expiresDate: null,
      };
    }

    // Trial status
    const expiresDate = entitlement.expires;
    if (!expiresDate) {
      return {
        isActive: true,
        isPaid: false,
        daysRemaining: null,
        expiresDate: null,
      };
    }

    const expires = new Date(expiresDate);
    const now = new Date();
    const daysLeft = Math.ceil((expires.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    return {
      isActive: daysLeft > 0,
      isPaid: false,
      daysRemaining: Math.max(0, daysLeft),
      expiresDate,
    };
  });

  /**
   * Whether the user has premium (paid) access to the course
   */
  const hasPremiumAccess = computed<boolean>(() => {
    return trialStatus.value.isPaid;
  });

  /**
   * Fetch entitlements from the backend
   */
  async function fetchEntitlements(): Promise<void> {
    loading.value = true;
    error.value = null;

    try {
      const result = await getUserStatus();
      if (result.ok) {
        entitlements.value = result.entitlements || {};
      } else {
        error.value = result.error || 'Failed to fetch entitlements';
        console.error('[useEntitlements] Error:', error.value);
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Unknown error';
      console.error('[useEntitlements] Exception:', e);
    } finally {
      loading.value = false;
    }
  }

  return {
    entitlements,
    trialStatus,
    hasPremiumAccess,
    loading,
    error,
    fetchEntitlements,
  };
}
