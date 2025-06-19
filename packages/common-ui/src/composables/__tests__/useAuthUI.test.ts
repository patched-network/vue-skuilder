import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAuthUI } from '../useAuthUI';
import type { UserDBInterface } from '@vue-skuilder/db';

// Mock getCurrentUser
vi.mock('../../stores/useAuthStore', () => ({
  getCurrentUser: vi.fn(),
}));

// Get reference to the mocked function
import { getCurrentUser } from '../../stores/useAuthStore';
const mockGetCurrentUser = vi.mocked(getCurrentUser);

describe('useAuthUI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should detect local-only mode when user cannot create account', async () => {
    // Mock user that cannot create account (NoOpSyncStrategy)
    const mockUser = {
      syncStrategy: {
        canCreateAccount: vi.fn().mockReturnValue(false),
      },
      getUsername: vi.fn().mockReturnValue('TestUser'),
    } as unknown as UserDBInterface;
    mockGetCurrentUser.mockResolvedValue(mockUser);

    const { config, detectSyncStrategy, isLocalOnlyMode } = useAuthUI();

    await detectSyncStrategy();

    expect(isLocalOnlyMode.value).toBe(true);
    expect(config.value).toEqual({
      showLoginRegistration: false,
      showLogout: false,
      showResetData: true,
      logoutLabel: '',
      resetLabel: 'Reset User Data',
    });
  });

  it('should detect remote sync mode when user can create account', async () => {
    // Mock user that can create account (CouchDBSyncStrategy)
    const mockUser = {
      syncStrategy: {
        canCreateAccount: vi.fn().mockReturnValue(true),
      },
      getUsername: vi.fn().mockReturnValue('TestUser'),
    } as unknown as UserDBInterface;
    mockGetCurrentUser.mockResolvedValue(mockUser);

    const { config, detectSyncStrategy, isLocalOnlyMode } = useAuthUI();

    await detectSyncStrategy();

    expect(isLocalOnlyMode.value).toBe(false);
    expect(config.value).toEqual({
      showLoginRegistration: true,
      showLogout: true,
      showResetData: false,
      logoutLabel: 'Log out',
      resetLabel: '',
    });
  });

  it('should handle errors gracefully and default to remote sync mode', async () => {
    mockGetCurrentUser.mockRejectedValue(new Error('User not available'));

    const { config, detectSyncStrategy, isLocalOnlyMode } = useAuthUI();

    await detectSyncStrategy();

    expect(isLocalOnlyMode.value).toBe(false);
    expect(config.value).toEqual({
      showLoginRegistration: true,
      showLogout: true,
      showResetData: false,
      logoutLabel: 'Log out',
      resetLabel: '',
    });
  });

  it('should manage loading state correctly', async () => {
    const mockUser = {
      syncStrategy: {
        canCreateAccount: vi.fn().mockReturnValue(true),
      },
      getUsername: vi.fn().mockReturnValue('TestUser'),
    } as unknown as UserDBInterface;
    mockGetCurrentUser.mockResolvedValue(mockUser);

    const { isLoading, detectSyncStrategy } = useAuthUI();

    expect(isLoading.value).toBe(true);

    const promise = detectSyncStrategy();
    expect(isLoading.value).toBe(true);

    await promise;
    expect(isLoading.value).toBe(false);
  });
});