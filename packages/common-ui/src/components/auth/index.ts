// Existing auth components
export { default as UserChip } from './UserChip.vue';
export { default as UserLogin } from './UserLogin.vue';
export { default as UserRegistration } from './UserRegistration.vue';
export { default as UserLoginAndRegistrationContainer } from './UserLoginAndRegistrationContainer.vue';

// New email verification and password reset components
export { default as VerifyEmail } from './VerifyEmail.vue';
export { default as RequestPasswordReset } from './RequestPasswordReset.vue';
export { default as ResetPassword } from './ResetPassword.vue';

// Auth API services - router-agnostic for external use
export {
  sendVerificationEmail,
  verifyEmail,
  requestPasswordReset,
  resetPassword,
  type AuthResponse,
  type VerifyEmailResponse,
} from '../../services/authAPI';