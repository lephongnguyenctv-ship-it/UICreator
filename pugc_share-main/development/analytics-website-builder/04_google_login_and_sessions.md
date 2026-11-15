---
doc_type: development_reference
domain: craftland-ugc
version: 1.0.0
last_updated: 2026-10-14
source: "pugc_tracking/exports/analytics-website-builder/04-google-login-and-sessions.md"
---

# Google Login and Sessions

> Imported reference snapshot (2026-10-14): product-specific defaults and implementation
> limitations require validation for the target app. See [integration and canonical owners](README.md#integration-and-canonical-owners).

[Skill index](README.md) · [Access and safety](05_access_privacy_and_safety.md)

## Setup contract

An operator must supply their own Google Cloud project and OAuth client. Enable the Google Sheets API and configure the consent screen and exact callback URIs, for example `http://localhost:8501/oauth/callback` for development and `https://analytics.example.com/oauth/callback` for production. These are examples, not an existing deployment.

Use private environment variables such as `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET` and `GOOGLE_OAUTH_REDIRECT_URI`. A client ID is not an access token, but this export still supplies no installation-specific values.

## Flow

1. Browser follows a server-generated login route.
2. Backend generates unpredictable, short-lived OAuth state bound to the initiating browser.
3. Google authenticates the user and asks for the configured scopes.
4. Callback checks state/expiry before exchanging the code.
5. Backend verifies the account information, checks website access and creates a session.
6. Browser receives an opaque session cookie, not Google tokens.
7. Authenticated APIs refresh expiring access tokens server-side as needed.

Ordinary login requests identity/email/profile and Sheets read-only access. Request write scope incrementally only after an authorized editor chooses to enable document editing. Website permission and Google file Editor permission are separate checks.

## Sessions and token persistence

The reference persists encrypted refresh tokens and session records locally while caching access tokens in memory. A production recreation should use an operator-managed encryption key and durable storage appropriate for its instance count. Keep keys separate from the encrypted store, rotate safely, and fail closed if the key/storage is unavailable.

Use HttpOnly session cookies, SameSite appropriate to the callback flow, Secure on HTTPS, bounded expiry and server-side logout. Do not copy a minimal development cookie snippet as a complete hardened production implementation.

Refresh tokens may be absent on later consents. Preserve a previously stored valid token where appropriate; require user re-consent if no usable token exists or it has been revoked. Refresh shortly before access-token expiry, not after every API request. Avoid simultaneous refresh storms.

## Own reader versus shared reader

Each user's read account can be their own Google login or a privately configured shared reader. Shared reading changes the backend credential used for Sheets retrieval; it does not change the signed-in user's project/region permissions.

The shared account must authenticate through the new installation, and its operator must grant it the appropriate file access. Never copy a token from another deployment. Shared credentials are read-only for this workflow: document writes use the signed-in editor's own Google account.

## Hosting details

Set a canonical public origin or an explicit callback override. Only accept forwarded host/protocol information from trusted reverse proxies; do not blindly trust arbitrary Host headers. Callback URI mismatch is a configuration error, not a reason to bypass validation.

Localhost can work while deployment fails because of callback/proxy configuration, missing runtime secrets, non-persistent stores, Google file permissions or network routing. Distinguish these from chart computation failures using staged diagnostics.

## Acceptance checks

Test successful login/logout, disallowed account/domain, expired state, revoked/missing refresh token, deployment callback mismatch, restart persistence, own/shared reader isolation, incremental write consent and Google Editor denial. Do not publish account identities or credential values in test logs.
