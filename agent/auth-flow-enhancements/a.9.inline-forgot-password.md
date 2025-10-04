# Inline "Forgot Password" Link

## Problem Statement

The "Forgot password?" link was only visible when `UserLogin` was rendered on the `/login` route. When the same component was rendered in a modal dialog via `UserLoginAndRegistrationContainer`, the link was not displayed due to conditional rendering (`v-if="loginRoute"`).

**Issue:** Users in modal login couldn't access password recovery, making it impossible to render the login form without a recovery path.

## Solution

Made the "Forgot password?" link always visible and context-aware:
- On `/login` route → navigates directly to `/request-reset`
- In modal context → emits event to open password reset dialog

## Implementation Details

### 1. UserLogin Component Changes

**File**: `packages/common-ui/src/components/auth/UserLogin.vue`

#### Template Changes (lines 45-54)
```vue
<!-- BEFORE: Conditional rendering -->
<slot name="forgot-password">
  <router-link v-if="loginRoute" to="/request-reset" class="text-caption">
    Forgot password?
  </router-link>
</slot>

<!-- AFTER: Always visible, context-aware -->
<slot name="forgot-password">
  <a
    href="#"
    class="text-caption text-decoration-none"
    @click.prevent="handleForgotPassword"
  >
    Forgot password?
  </a>
</slot>
```

#### Script Changes

**New emit** (line 84):
```typescript
const emit = defineEmits<{
  toggle: [];
  loginSuccess: [redirectPath: string];
  forgotPassword: [];  // NEW
}>();
```

**New handler** (lines 170-179):
```typescript
const handleForgotPassword = () => {
  log('Forgot password clicked');
  // If on login route, navigate directly
  if (loginRoute.value) {
    router.push('/request-reset');
  } else {
    // Otherwise, emit event for parent to handle (e.g., modal context)
    emit('forgotPassword');
  }
};
```

### 2. UserLoginAndRegistrationContainer Changes

**File**: `packages/common-ui/src/components/auth/UserLoginAndRegistrationContainer.vue`

#### Import Addition (line 38)
```typescript
import RequestPasswordReset from './RequestPasswordReset.vue';
```

#### Template Addition (lines 18, 22-24)
```vue
<!-- Listen to forgotPassword event -->
<UserLogin @toggle="toggle" @forgot-password="openResetDialog" />

<!-- New password reset dialog -->
<v-dialog v-model="resetDialog" width="500px">
  <RequestPasswordReset @cancel="closeResetDialog" @success="closeResetDialog" />
</v-dialog>
```

#### Script Additions
```typescript
// Password reset dialog state (local, not in auth store)
const resetDialog = ref(false);

const openResetDialog = () => {
  loginDialog.value = false; // Close login dialog
  resetDialog.value = true; // Open reset dialog
};

const closeResetDialog = () => {
  resetDialog.value = false;
};
```

## User Experience Flow

### Scenario 1: Login Route (`/login`)
1. User clicks "Forgot password?"
2. `handleForgotPassword()` detects `loginRoute.value === true`
3. Router navigates to `/request-reset` page
4. User sees full-page password reset form

### Scenario 2: Modal Dialog (UserLoginAndRegistrationContainer)
1. User opens login modal via "Log In" button
2. User clicks "Forgot password?"
3. `handleForgotPassword()` detects `loginRoute.value === false`
4. Emits `forgotPassword` event
5. Parent component (`UserLoginAndRegistrationContainer`) receives event
6. Closes login dialog, opens password reset dialog
7. User sees password reset form in modal
8. On success/cancel, closes reset dialog

## Benefits

✅ **Always accessible**: Password recovery path available in all login contexts
✅ **Context-aware**: Adapts behavior based on route vs. modal rendering
✅ **Consistent UX**: Same link appearance and position in all contexts
✅ **Flexible**: Slot still available for parent components to override
✅ **Type-safe**: TypeScript enforces correct event handling

## Testing Checklist

- [ ] Verify "Forgot password?" link visible on `/login` route
- [ ] Click link on `/login` → should navigate to `/request-reset`
- [ ] Verify "Forgot password?" link visible in login modal
- [ ] Click link in modal → should close login modal and open reset modal
- [ ] Submit reset request in modal → should close reset modal
- [ ] Cancel reset in modal → should close reset modal
- [ ] Verify link styling consistent in both contexts

## Backward Compatibility

✅ **Fully backward compatible**:
- Slot still available for custom implementations
- Event-based design allows parent components to handle as needed
- Route-based detection maintains existing behavior on `/login`
