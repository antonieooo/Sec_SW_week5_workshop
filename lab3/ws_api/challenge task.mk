# Challenge Tasks

## Task 1

A pure REST redesign of SSE-Forum could use `POST /messages` for sending messages and periodic `GET /messages?since=<timestamp>` polling to retrieve new messages.

This approach has some benefits. First, it is simpler to implement and debug because it uses standard request-response patterns that are familiar in web development. Second, it generally works well with existing HTTP infrastructure such as proxies, load balancers, and monitoring tools. Third, access control, logging, and API testing can be easier to manage using standard REST tooling.

However, there are important tradeoffs.

Polling introduces latency because new messages are only received when the client sends the next request, so the discussion feels less real-time than WebSockets. It also creates inefficient traffic: many polling requests may return no new data, wasting bandwidth and server resources. As the number of participants grows, the server must handle a large number of repeated requests, which can reduce scalability and increase cost. Long polling can reduce some inefficiency, but it still adds complexity and does not fully match the responsiveness of a persistent WebSocket connection.

Overall, a REST-only design may be acceptable for low-frequency updates or simpler systems, but for interactive chat-like communication such as SSE-Forum, WebSockets provide better responsiveness and network efficiency.

## Task 2

A cookie-free alternative design is to replace `Set-Cookie` usage with an initialization REST endpoint that returns configuration and a short-lived session token in JSON. For example, the client first calls `GET /init`, and the server responds with `{ ws_host, session_token }`. The browser then opens the WebSocket connection using the returned host and includes the token (e.g., as a query parameter or via `Sec-WebSocket-Protocol`). The server validates the token (signature, expiry, and purpose) before accepting the WebSocket session.

This design reduces reliance on cookies, which is useful as browsers increasingly restrict third-party cookies. It also makes the protocol more explicit and easier to reason about because all connection parameters are returned directly by the API. In addition, short-lived signed tokens can improve session control and reduce replay risk when combined with expiry checks.

However, this approach introduces additional implementation complexity because the server must issue and verify tokens. If the token is included in the URL, it may be exposed in logs or browser history, so careful handling is required. The design also does not remove the need for `wss`, input validation, authentication, and XSS protection.

## Task 3

Based on the current implementation of the browser client and server API, the system contains several security flaws:

1. **No authentication / identity spoofing**
   The application accepts `name` and `email` directly from the client and uses them as user identity without verification. Any user can impersonate another participant by entering someone else’s name/email.

2. **Insecure transport (`http` / `ws`)**
   The system uses plain HTTP and WebSocket (`ws://`) instead of HTTPS/WSS. Messages, cookies, and session-related values can be intercepted or modified by an attacker on the same network (e.g., MITM attack).

3. **Cross-Site Scripting (XSS) risk**
   User-controlled content (such as chat messages and names) is rendered into the page using `innerHTML`. A malicious participant could send HTML/JavaScript payloads, which may execute in other users’ browsers.

## Task 4

Refactor SSE-Forum to use `WebSocketSecure (wss)` instead of `ws`.

Implementation status in this project:

- Server refactored to use `https` + `wss`
- Client updated to use `wss://` when the page is loaded over `https`
- Local self-signed TLS certificates generated for testing

## Task 5

### Which flaws in Task 3 are mitigated by `wss`?

Using `wss` (WebSocket over TLS) mitigates the security flaws related to insecure transport. In particular, it helps mitigate:

1. **Insecure transport (`http` / `ws`)**
   `wss` encrypts traffic between client and server, so chat messages and session-related data are no longer sent in plaintext.

2. **Message interception and tampering (MITM risk)**
   TLS provides confidentiality and integrity, making it much harder for an attacker on the network to read or modify messages in transit.

3. **Session/token exposure in transit (partially)**
   If session identifiers or cookies are transmitted over secure channels (`https` + `wss`), they are less likely to be captured by passive network sniffing. This is strengthened further when cookies also use the `Secure` flag.

However, `wss` does **not** mitigate:

- XSS (`innerHTML` rendering)
- Identity spoofing / lack of authentication
- Weak session ID generation (`Math.random()`)
- Missing input validation / rate limiting
- Missing WebSocket `Origin` validation

## Task 6

The identified security flaws vary in severity, but several are high risk because they directly affect confidentiality, integrity, and trust in the forum. The use of plain `http/ws` is a high-severity issue because attackers on the same network can intercept or modify traffic (MITM attacks). This can expose messages and session-related values. The primary mitigation is to use `https` and `wss`, with valid TLS certificates.

The XSS risk is also high severity because user input (chat messages and names) is rendered using `innerHTML`. A malicious user could inject scripts that execute in other users’ browsers, potentially stealing session data or manipulating the UI. This should be mitigated by avoiding `innerHTML` for untrusted data and using safe rendering methods such as `textContent` or proper output encoding/sanitization.

Lack of authentication and identity verification is medium to high severity because any participant can impersonate another user by entering a false name/email. This undermines trust and accountability. Mitigation includes user authentication, signed session tokens, and server-side identity checks.

Weak session ID generation (`Math.random()`), insecure cookie settings, missing `Origin` validation, and the absence of rate limiting are medium severity issues. These can increase the risk of session misuse, cross-site abuse, and denial-of-service. Mitigations include cryptographically secure IDs (`crypto.randomUUID()` or `crypto.randomBytes`), secure cookie attributes (`Secure`, `HttpOnly`, `SameSite`), `Origin` checks during WebSocket handshake, and server-side message size/rate limits.
