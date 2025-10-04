# Assessment: Enhancing Authentication Flows

This document assesses options for enhancing the authentication system to support commercial application requirements, including user verification and password management.

## 1. Current State

The existing authentication system is built on CouchDB's standard security model:
- **User Store**: Accounts are stored in the central `_users` database.
- **Authentication**: A username and password are used to obtain an `AuthSession` cookie from CouchDB.
- **Authorization**: User data is isolated in per-user databases (e.g., `userdb-username`), with access controlled by CouchDB's security rules based on the session cookie.
- **Frontend Interaction**: The Express backend validates requests by checking the session cookie, as seen in `packages/express/src/couchdb/authentication.ts`.

This setup is robust and secure for basic authentication.

## 2. Goals

Based on our discussion, the primary goals are:
1.  **Implement Signup Verification**: Add a "soft gate" during registration to ensure a valid user email address is provided.
2.  **Retain Password Login**: Users should still be able to log in with a username and password after verification.
3.  **Implement Password Reset**: Allow users to reset their password if they forget it.
4.  **Record User Origin**: Capture metadata about where the user signed up from (e.g., which course URL).

## 3. Options Analysis

The core choice revolves around the mechanism for email-based verification and reset.

### Option A: Magic Link

A "magic link" is a unique, single-use URL sent to the user's email.

-   **Signup Flow**:
    1.  User registers with an email and username.
    2.  An account is created with a `pending_verification` status.
    3.  A magic link is emailed to the user.
    4.  User clicks the link, is redirected to the app, and is prompted to set their password.
    5.  The account status becomes `verified`.
-   **Password Reset Flow**:
    1.  User requests a password reset for their email.
    2.  A magic link is emailed.
    3.  User clicks the link and is prompted to set a new password.

-   **Pros**:
    -   **Seamless UX**: A single click verifies the email and brings the user directly to the next step.
    -   **Reusable**: The same token generation and verification logic can be used for both signup and password reset.
-   **Cons**:
    -   Some users may be wary of clicking links in emails.
    -   Requires careful handling of URL redirects on the frontend.

### Option B: One-Time Password (OTP)

An OTP is a short code sent to the user's email.

-   **Signup Flow**:
    1.  User registers with an email and username.
    2.  An account is created with a `pending_verification` status.
    3.  An OTP code is emailed to the user.
    4.  User returns to the app and enters the code into a form.
    5.  Upon successful validation, the user is prompted to set their password.
-   **Password Reset Flow**:
    1.  User requests a password reset.
    2.  An OTP is emailed.
    3.  User enters the OTP in the app and is prompted to set a new password.

-   **Pros**:
    -   Conceptually very simple for users.
    -   Avoids potential user apprehension about clicking links.
-   **Cons**:
    -   **Higher Friction**: Requires the user to switch between their email client and the app, then copy/paste or type the code.

## 4. Cross-Cutting Concerns

These items can be implemented regardless of the option chosen above.

-   **Record Originating Site**: This is a simple and valuable addition. It involves adding an `originatingSite` field to the user document in the `_users` database during registration.
-   **Social Logins (OAuth)**: This is a high-effort, high-reward feature. It significantly improves the signup funnel but adds considerable complexity (managing multiple providers, OAuth callbacks, token refreshes). It should be considered a separate, future work item.

## 5. Recommendation

I recommend **Option A: Magic Link**.

The implementation effort and cost for both Magic Link and OTP (via email) are virtually identical. Both require token generation, storage, and an email sending service.

The Magic Link provides a slightly more seamless user experience, which is critical for reducing friction during signup. The mechanism's direct reusability for both signup verification and password reset makes it an efficient choice. While some users are wary of links, this is a standard and widely accepted practice for account management.
