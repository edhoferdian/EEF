# Client side and browser — CS-SEC-01..09

**Activation.** Trust decisions or untrusted rendering happen in the
browser: SPAs, browser extensions, embedded webviews, service workers,
offline apps, or code that writes attacker-influenced content into the DOM,
receives cross-window messages, or keeps state in browser storage. These
paths include sources the server never sees — URL fragments,
`window.name`, `postMessage`, cached content. Adapted from the client-side
companion of
[cloudflare/security-audit-skill](https://github.com/cloudflare/security-audit-skill)
(MIT, `c1c8a8c`), in this skill's own wording.

**Already covered — extend, do not duplicate:** React escape hatches,
`NEXT_PUBLIC_*` leaks and other framework specifics (`language-specific.md`
§React), CORS with credentials and CSRF (**SEC-09**), server-side sessions
and callbacks (`web-protocol-auth.md`), the native side of a webview bridge
(`desktop-mobile-ipc.md`).

**Discipline.** Name a controllable source *and* an executing or disclosing
sink, and show the data reaching it. The impact must reach a victim's
session, another origin, or shared persistence — self-injection and
disclosing the attacker's own data are not findings. Framework escaping,
same-origin policy, CSP, COOP/CORP, service-worker scope and modern
`noopener` defaults are real controls; check them before assigning impact.
Deployed headers, extension permissions and renderer behaviour you cannot
see are **Needs validation**.

## DOM and object state

- **CS-SEC-01 DOM XSS** — `location.*`, `document.referrer`,
  `window.name`, message data or storage flowing into `innerHTML`,
  `outerHTML`, `document.write`, `eval`/`setTimeout(string)`,
  `javascript:` URLs, jQuery HTML APIs or a framework escape hatch.
  Interpolation the framework escapes is not a finding.
- **CS-SEC-02 DOM clobbering** — injected `id`/`name` attributes shadowing
  a global, form property, config object or init flag that code later
  trusts. Needs both a markup path that keeps the attribute and a
  security-relevant use of the shadowed value.
- **CS-SEC-03 Prototype pollution with a gadget** — an attacker-controlled
  key reaching a recursive write (deep merge, path assignment) *and* a
  reachable gadget that reads the polluted property to change
  authorization, execution, navigation or rendering. `JSON.parse`, a
  shallow copy, or pollution with no gadget is not enough.

## Cross-origin messaging

- **CS-SEC-04 `postMessage` trust** — a handler acting on `event.data`
  without an exact origin allowlist (and the expected `event.source` when
  several frames share an origin); substring, prefix, suffix or unanchored
  regex origin checks; sensitive data posted to `*`.
- **CS-SEC-05 Cross-site WebSocket** — an upgrade that accepts ambient
  cookies from any origin with no `Origin` check or channel token, plus a
  message handler that reads or mutates victim data.

## Service workers and storage

- **CS-SEC-06 Service-worker takeover or stale cache** — attacker content
  becoming the registered worker script, an over-broad
  `Service-Worker-Allowed` scope, imported scripts without integrity; or a
  worker caching personalized responses without account, tenant or auth
  state in the key and serving them after logout or account switch
  (check offline and error fallbacks too).
- **CS-SEC-07 Storage outliving authorization** — tokens, private responses
  or authorization decisions left in `localStorage`, `sessionStorage`,
  IndexedDB, Cache Storage or extension storage and read by another account
  or a less-trusted same-origin component, or used after logout or
  revocation; `storage` events, `BroadcastChannel` or shared workers
  carrying identity or commands between tabs without binding to the current
  session. A token in storage alone is not a finding — name the reader.

## Leaks and UI redress

- **CS-SEC-08 Cross-site state oracles** — an attacker page distinguishing
  protected state (does this private object, role or account exist?)
  through load/error events, frame counts, redirects, timing, cache or
  response size while the browser attaches the victim's cookies; window or
  opener relationships that leak navigation results or let an attacker
  steer a privileged navigation. Needs one concrete secret-bearing
  predicate, not generic timing noise.
- **CS-SEC-09 Clickjacking and navigation** — a state-changing action that
  completes inside a frame with no effective `frame-ancestors` /
  `X-Frame-Options`; client-controlled redirects without scheme and
  destination policy (`javascript:`, `data:`). Missing frame headers on
  read-only pages are hardening. Reverse tabnabbing applies only where code
  keeps `window.opener` deliberately or targets a browser without implicit
  `noopener`.

## How to hunt it

Start from DOM, navigation, worker, message and storage sinks and trace back
to browser-only and server sources, noting the browser policy that should
stop each path. Walk account switch, logout, worker update, offline fallback
and stale tabs with dummy accounts on a local origin. For a leak, list only
predicates the source proves, then name the header or rendering change that
removes the oracle.
