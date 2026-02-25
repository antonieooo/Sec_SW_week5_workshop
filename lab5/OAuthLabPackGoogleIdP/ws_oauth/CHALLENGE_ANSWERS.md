# Challenge Task 1 Answers (Aligned to `workshop -OAuth 2.0.pdf`)

## Source Alignment

This markdown is written against the exact `Challenge Task 1` text extracted from `workshop -OAuth 2.0.pdf` (page section around line ~472 in extracted text).

## Challenge Task 1 (PDF) - Responses

### (1) Modern software properties vs delegated security (<=300 words)

Yes, these properties are important, and they are directly relevant to secure engineering in modern systems. In a distributed ecosystem, observability is essential because security failures often occur across service boundaries (e.g., token issuance, callback handling, session state, cookie propagation, WebSocket upgrade). Without strong observability, engineers cannot detect misuse, expiry failures, replay attempts, or configuration errors quickly.

Autonomy is also important because services evolve independently and need clear trust boundaries. Delegating identity to a third-party IdP (such as Google) is a practical example of autonomy with specialization: the application focuses on business logic while the IdP provides authentication, account recovery, MFA, and abuse protection.

Adaptability matters because protocols, provider policies, and browser security behavior change over time. OAuth-based systems must adapt to new requirements such as PKCE, stricter cookie policies, and certificate validation behavior.

There is a trade-off. Greater autonomy and integration flexibility can increase attack surface, operational complexity, and misconfiguration risk. Delegating security also introduces dependency risk (provider outages, API changes, token handling mistakes in the relying app). The balance is achieved by minimizing custom auth logic, using standard flows, validating tokens and state strictly, instrumenting logs/metrics, and keeping trust boundaries explicit. In practice, modern engineering benefits from these properties, but only when supported by disciplined security controls and operational visibility.

### (2) Why token management, secure storage, and flow selection matter (<=300 words)

OAuth security depends as much on implementation details as on the protocol itself. Proper token management is critical because tokens are the credentials used after login; if access or refresh tokens are leaked, an attacker may act as the user without knowing the user’s password. Systems therefore need expiry handling, rotation strategy, revocation behavior, and clear separation between short-lived access tokens and longer-lived refresh tokens.

Secure storage is equally important. Tokens stored in insecure browser storage or exposed to client-side scripts are vulnerable to XSS and session theft. In this workshop design, using cookies can improve control, but cookie flags (e.g., `HttpOnly`, `Secure`, `SameSite`) must be chosen carefully. Sensitive tokens (especially refresh tokens) should be protected more strictly than UI-facing profile data.

Flow selection matters because different OAuth flows assume different client capabilities and threat models. Choosing the wrong flow can expose tokens or authorization codes to interception. The authorization code flow (and PKCE-enhanced variant) is preferred for server-backed applications because it avoids exposing client secrets in the browser and reduces interception risk. In short, a secure OAuth system is not only “using OAuth”; it is selecting the right flow, storing tokens safely, and managing token lifecycle correctly under realistic attacker assumptions.

### (3) Token expiry relogin design: pros/cons + refresh-token extension

#### (3a) Advantages and disadvantages of current relogin-on-expiry design

Advantages:

- Simpler implementation and easier to reason about.
- Smaller session-management attack surface (no refresh logic, no token renewal bugs).
- Forces re-authentication, which can reduce risk if a session is abandoned on a shared device.
- Easier debugging during early lab development.

Disadvantages:

- Poor user experience (session interruption, repeated login prompts).
- Loss of continuity in long-running forum usage.
- More redirects to the IdP increase dependency on network/provider availability.
- Higher load on OAuth endpoints and more state/callback handling complexity over time.

#### (3b) Refresh-token extension (implementation status)

Status: `Not fully implemented in this repository yet` (design and integration plan below).

Reason for status:

- The current code stores `refreshToken` in a cookie, but there is no refresh endpoint / middleware path that exchanges it for a new access token when `accessToken` expires.
- A complete implementation requires safe refresh flow, token rotation handling, and retry behavior before serving `/auth` and before WebSocket join flows.

#### (3c) Proposed implementation for this codebase (concrete)

1. Add a refresh helper in `helper-oauth-handler.js`:
- New function `refreshGoogleAccessToken(refreshToken)` calling `https://oauth2.googleapis.com/token`
- `grant_type=refresh_token`
- Return new access token (and refreshed expiry)

2. Update auth middleware in `oserver-ws.js`:
- In `authenticateToken`, if `accessToken` missing/expired but `refreshToken` exists:
  - call refresh helper
  - reset `accessToken` cookie
  - continue to `/auth` instead of forcing login

3. Handle refresh failure safely:
- Clear invalid auth cookies
- Redirect user to login page / restart OAuth flow

4. Security controls:
- Keep `refreshToken` in `HttpOnly + Secure + SameSite=strict` cookie
- Do not expose refresh token to frontend JS
- Log refresh failures (without logging token values)

### (4) Redesign and implement SSE-Forum using GitHub as IdP

Status: `Not implemented in this repository yet` (design answer provided).

#### Design changes required

1. Replace Google OAuth endpoints with GitHub OAuth endpoints:
- Authorize: `https://github.com/login/oauth/authorize`
- Token: `https://github.com/login/oauth/access_token`

2. Replace Google user info retrieval:
- Use GitHub API (e.g., `/user`, and optionally `/user/emails`)

3. Update environment variables:
- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `GITHUB_REDIRECT_URI`

4. Update callback logic:
- Parse GitHub token response format
- Map GitHub profile fields to local cookies/session fields (`name`, `email`, avatar, etc.)

5. Keep existing forum behavior unchanged:
- Continue using `ws_host`, `sessionID`, and `wss://.../forum`
- Only authentication provider changes

#### Recommended file changes

- Add `helper-oauth-github-url.js`
- Add `helper-oauth-github-handler.js`
- Refactor `oserver-ws.js` to support provider-specific strategy selection (Google/GitHub)

### (5) Redesign and implement SSE-Forum using Passport Google OAuth 2.0 strategy

Status: `Not implemented in this repository yet` (design answer provided).

#### Why Passport helps

- Reduces custom OAuth flow code
- Standardized middleware and callback handling
- Better maintainability and easier provider substitution
- Cleaner separation between authentication and forum business logic

#### Proposed architecture

1. Install middleware:
- `passport`
- `passport-google-oauth20` (or `passport-google-oauth2`)
- `express-session`

2. Configure Passport strategy:
- Google client ID / secret / callback URL
- Verification callback maps Google profile to local user/session

3. Replace custom `/auth` and `/auth/google/callback` orchestration:
- `/auth/google` -> `passport.authenticate(...)`
- `/auth/google/callback` -> Passport callback + success redirect to forum page

4. Session integration:
- Store authenticated user identity in server session
- Set `ws_host`/`sessionID` as needed for WebSocket forum join

5. Keep WebSocket logic mostly unchanged:
- WebSocket endpoint can continue using cookies/session identity
- Main refactor is HTTP auth flow, not chat broadcast logic

## What Was Actually Implemented and Verified in This Repo (Current Work)

The following fixes were implemented and tested while getting the workshop system running in WSL:

### A. Startup and dependency fixes

- Restored missing dependencies in `package.json`
- Added script `start-ws-forum`
- Added missing `helper-oauth-url.js` referenced by `oserver-ws.js`

### B. WSL WebSocket join fix (critical)

Problem:
- `ws_host` cookie was set using `ip.address()` (WSL virtual IP such as `10.x.x.x`)
- Browser on Windows could not reliably connect to `wss://<that-ip>:<PORT_WS>`

Fix in `oserver-ws.js`:
- Added `resolveClientHost(req)` and `PUBLIC_HOST` support
- `ws_host` cookie now uses `PUBLIC_HOST` / request hostname / `localhost`

### C. WSL binding and TLS diagnostics improvements

Fix in `oserver-ws.js`:
- Added `BIND_HOST` support (default `0.0.0.0`)
- Explicit binding for OAuth HTTPS server and WSS HTTPS server
- Added simple HTTPS response on WebSocket port for browser certificate testing
- Added `tlsClientError` logging for WSS TLS issues

## Recommended `.env` for WSL (Working Setup)

```env
PORT_OAUTH=3000
PORT_WS=9443
PUBLIC_HOST=localhost
BIND_HOST=0.0.0.0

GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=https://localhost:3000/auth/google/callback
```

## References from PDF (as listed in challenge prompt)

- GitHub OAuth Apps docs: `https://docs.github.com/en/apps/oauth-apps`
- Passport Google OAuth2 strategy docs: `https://www.passportjs.org/packages/passport-google-oauth2/`

## Notes for Submission Readiness

For full completion of PDF Challenge Task 1 items (3)-(5), code implementation work is still needed:

- `(3)` Refresh token auto-renewal flow in code
- `(4)` GitHub IdP implementation
- `(5)` Passport-based Google OAuth refactor

This file currently provides:

- Exact PDF-aligned question coverage
- Full written answers for `(1)` and `(2)`
- Pros/cons + concrete implementation plan for `(3)`
- Concrete redesign plans for `(4)` and `(5)`
- Verified implementation notes for the WSL/OAuth/WSS issues actually completed in this repo

