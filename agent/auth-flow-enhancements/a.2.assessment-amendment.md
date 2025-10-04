# Assessment Amendment: Commercial and Multi-Site Requirements

This document amends `a.1.assessment.md` to incorporate new requirements for a multi-site, commercial application model. It focuses on per-site entitlements and automated permissions management.

## 1. Analysis of New Requirements

The new requirements introduce two primary concepts: per-site user entitlements and linking those entitlements to database permissions.

### 1.1. Per-Site Entitlements

The initial proposal of a single `account status` field is insufficient for a multi-site model where a user can have different access levels for different products (sites/courses). A user's payment for Site X should not grant access to Site Y.

**Proposed Solution**: The user document in the `_users` database should contain a structured `entitlements` object. This object would map a `courseID` (representing a site/product) to the user's status for that specific product.

This structure elegantly handles several requirements:
- **Payment Isolation**: Each course has its own entitlement record.
- **Account Status**: The `status` field (`paid`, `trial`) is stored per-course.
- **Registration Date**: Can be stored within each entitlement object.
- **Site of Registration**: The first entry in the `entitlements` object implicitly serves as the `site-of-registration`.

**Example `entitlements` object:**
```json
"entitlements": {
  "course_id_for_site_x": {
    "status": "paid",
    "registrationDate": "2025-09-18T10:00:00Z",
    "expires": "2026-09-18T23:59:59Z"
  },
  "course_id_for_site_y": {
    "status": "trial",
    "registrationDate": "2025-09-20T11:30:00Z",
    "expires": "2025-10-20T23:59:59Z"
  }
}
```

### 1.2. Automated Permissions Management

This is the most critical technical challenge. The goal is to grant a user `read` permissions to a course database (e.g., `coursedb-siteX`) based on their entitlement status in the `_users` database.

**The Challenge**: A user cannot grant themselves permissions. The `_security` document of a CouchDB database, which controls access, can only be modified by a database admin. Therefore, a change to a user's entitlement (e.g., after a payment) must trigger a privileged, administrative action.

**Proposed Solution: A Backend "Permissions Orchestrator" Service**

I propose creating a new, trusted backend service that runs with admin privileges.

1.  **Listen for Changes**: This service will listen to the `_changes` feed of the `_users` database.
2.  **Detect Entitlement Updates**: When it detects a change to a user's `entitlements` field, it will parse the change.
3.  **Synchronize Permissions**: The service will then use its admin privileges to connect to the relevant course database (e.g., `coursedb-siteX`) and update its `_security` document, adding the user's `name` to the `members` list (which grants read access).

This architecture creates a clean, secure, and automated link between application-level entitlements and database-level permissions.

## 2. Revised User Schema

Incorporating all requirements from both assessments, a complete user document in the `_users` database would look like this:

```json
{
  "_id": "org.couchdb.user:colin",
  "type": "user",
  "name": "colin",
  "roles": [],
  "password_scheme": "pbkdf2",
  "iterations": 10,
  "derived_key": "...",
  "salt": "...",

  // --- New Metadata Fields ---
  "email": "colin@example.com",
  "status": "verified", // 'pending_verification', 'verified', 'suspended'
  "verificationToken": null,
  "verificationTokenExpiresAt": null,

  "entitlements": {
    "course_id_for_site_x": {
      "status": "paid",
      "registrationDate": "2025-09-18T10:00:00Z",
      "expires": "2026-09-18T23:59:59Z"
    }
  }
}
```

## 3. Impact on Previous Recommendation

These new requirements are compatible with the recommendation from `a.1.assessment.md`. The choice of Magic Link vs. OTP for the initial user verification and password reset is independent of how entitlements and permissions are managed afterward.

## 4. Updated Recommendation

1.  **Proceed with Option A (Magic Link)** from the previous assessment for handling user registration and password resets.
2.  **Adopt the structured `entitlements` object** within the `_users` document schema to manage per-site access.
3.  **Design and implement a backend "Permissions Orchestrator" service.** This is a critical new component required to automatically synchronize the entitlements stored in user documents with CouchDB's database-level `_security` permissions.
