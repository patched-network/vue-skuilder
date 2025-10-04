# Plan: Enhanced Authentication and Permissions

This document outlines the plan to implement an enhanced authentication flow using magic links and a metadata-driven permissions system, based on the approved assessments `a.1.assessment.md` and `a.2.assessment-amendment.md`.

## 1. Overview

The goal is to evolve the authentication system to support commercial, multi-site applications. This will be achieved by implementing:
1.  **Magic Link Authentication**: For new user email verification and password resets.
2.  **Structured User Metadata**: To store entitlements and user status in the `_users` database.
3.  **Automated Permissions**: A new backend service to synchronize user entitlements with CouchDB database permissions.

Crucially, these features will be configurable to ensure existing deployment strategies remain viable.

## 2. Configuration Strategy

To maintain backward compatibility, a new environment variable will be introduced:

-   `SKUILDER_AUTH_MODE`: Defines the authentication and permission model.
    -   `open` (Default): The current behavior. No email verification is required. The new permissions system is disabled. This ensures existing deployments function without modification.
    -   `secure`: Enables the new magic link verification, password reset flows, and the Permissions Orchestrator service.

All new features described below will be gated by this `secure` mode flag.

## 3. Phase 1: Database Layer Modifications (`packages/db`)

**Objective**: Update core data structures and interfaces.

### 3.1. User Schema Update

The document schema within CouchDB's `_users` database will be extended to include:
-   `email`: `string` (Required for verification)
-   `status`: `'pending_verification' | 'verified' | 'suspended'`
-   `verificationToken`: `string | null`
-   `verificationTokenExpiresAt`: `string | null` (ISO 8601 Date)
-   `entitlements`: An object mapping `courseId` to entitlement status, e.g.:
    ```json
    "entitlements": {
      "course_abc": { "status": "paid", "registrationDate": "..." }
    }
    ```

### 3.2. Data Layer Interface (`UserDBAuthenticator`)

The interface in `packages/db/src/core/interfaces/userDB.ts` will be updated with new methods:

-   `createAccount(email, username)`: Will be modified to create a user in a `pending_verification` state without an initial password.
-   `generateVerificationToken(username)`: Creates and stores a verification token.
-   `completeVerification(token)`: Validates a token and updates the user's status to `verified`.
-   `setPassword(username, password)`: Sets the password for a user, typically after verification.
-   `generatePasswordResetToken(email)`: Creates and stores a password reset token.
-   `resetPassword(token, newPassword)`: Validates a reset token and updates the user's password.
-   `updateUserEntitlements(username, entitlements)`: A privileged method for updating a user's entitlements.

### 3.3. Data Layer Implementation (`BaseUserDB`)

The `BaseUser` class in `packages/db/src/impl/common/BaseUserDB.ts` will be updated to implement the new `UserDBAuthenticator` interface methods.

## 4. Phase 2: Backend Services (`packages/express`)

**Objective**: Implement the required API endpoints and background services.

### 4.1. New Express Endpoints

A new set of routes, likely in `packages/express/src/routes/auth.ts`, will be created. These routes will only be active if `SKUILDER_AUTH_MODE=secure`.

-   `POST /auth/register`: Initiates the registration process, creates the pending user, and triggers the verification email.
-   `GET /auth/verify?token=<token>`: Handles the magic link click, verifies the user, and redirects to a page where they can set their password.
-   `POST /auth/set-password`: Allows a newly verified user to set their password for the first time.
-   `POST /auth/initiate-password-reset`: Allows an existing user to request a password reset link.
-   `POST /auth/complete-password-reset`: Handles the form submission from the password reset link, updating the user's password.

### 4.2. New Module: Email Service

A new module, e.g., `packages/express/src/services/email.ts`, will be created to abstract email sending.

-   **Interface**: It will expose methods like `sendVerificationEmail(to, magicLink)` and `sendPasswordResetEmail(to, magicLink)`.
-   **Implementation**: It will use a third-party email service (e.g., AWS SES, SendGrid) configured via environment variables.
-   **Development Fallback**: If no email service is configured, it will log the email content and magic link to the console for testing purposes.

### 4.3. New Module: Permissions Orchestrator

This is a new, critical background service.

-   **Location**: A new script, e.g., `packages/express/src/permissions-orchestrator.ts`.
-   **Execution**: It will be a long-running process, started alongside the main Express server.
-   **Functionality**:
    1.  **Gated Execution**: Runs only if `SKUILDER_AUTH_MODE=secure`.
    2.  **Admin Privileges**: Connects to CouchDB with administrative credentials (provided via environment variables).
    3.  **Listen for Changes**: Subscribes to the `_changes` feed of the global `_users` database.
    4.  **Act on Changes**: When a user's `entitlements` field is modified, it will:
        a.  Connect to the specified course database (e.g., `coursedb-course_abc`).
        b.  Read that database's `_security` document.
        c.  Add or remove the user's name from the `members` array to grant or revoke read access based on their new entitlement status.
        d.  Write the updated `_security` document back to the database.

## 5. Phase 3: Frontend (High-Level Specification)

While not part of the backend implementation, the following frontend components will be necessary:

-   A new registration form accepting `email` and `username`.
-   A confirmation page instructing the user to "Check your email".
-   A password creation form, accessible from the magic link, for newly verified users.
-   A "Forgot Password?" flow.
-   A user profile section for changing an existing password.

## 6. Summary of New/Modified Modules

-   **Modified**:
    -   `packages/db/src/core/interfaces/userDB.ts`
    -   `packages/db/src/impl/common/BaseUserDB.ts`
    -   `packages/express/src/couchdb/authentication.ts` (to respect `SKUILDER_AUTH_MODE`)

-   **New**:
    -   `packages/express/src/routes/auth.ts` (or similar)
    -   `packages/express/src/services/email.ts`
    -   `packages/express/src/permissions-orchestrator.ts`
