# HTTP protocol and authentication — WEB-SEC-01..12

**Activation.** The scope speaks HTTP at a parsing, caching or identity
boundary: a reverse proxy, CDN or gateway config, a custom HTTP server, or
an app implementing sessions, JWT, OAuth/OIDC, SAML, password recovery,
MFA, passkeys, API keys or mTLS. Access control asks whether a principal
may do something; this file asks whether the HTTP or identity layer can
confuse *which* principal, request, assurance level or token it belongs
to. Adapted from the web/auth companion of
[cloudflare/security-audit-skill](https://github.com/cloudflare/security-audit-skill)
(MIT, `c1c8a8c`), in this skill's own wording.

**Already covered — extend, do not duplicate:** missing auth checks
(**SEC-03**), CORS and the CSRF bearer-token trap (**SEC-09**), token
storage, expiry and session fixation (**SEC-10**), `X-Forwarded-*`
spoofing of client identity (**SEC-15**), open redirects (**SEC-18**).

**Discipline.** Framing and cache findings need two interpretations of the
same request, response or key — name both components and the value each
side sees. For every credential, find the verification *and* every binding
its role needs: issuer, audience, origin, RP, client, session, principal,
resource, assurance, expiry, one-time state. A missing header, cookie flag,
MFA prompt or rate limit is not a finding alone; require an accepted
invalid request, cross-principal impact, assurance downgrade or credential
disclosure. Proxy chains, edge cache keys, IdP policy and browser behaviour
outside the repo are **Needs validation**. A single app behind an unseen
managed proxy has little source-confirmable smuggling surface.

## HTTP framing and caching

- **WEB-SEC-01 Request desync** — front and back end disagree on request
  length or header normalization: duplicate `Content-Length`,
  `Transfer-Encoding` handling, HTTP/2→1 downgrade, header-name folding,
  CR/LF conversion. Only in repos that own a proxy or a parser.
- **WEB-SEC-02 Cache poisoning and deception** — a request value (forwarded
  host or scheme, a cookie, a query variant, a language header) changes
  cached content but is not in the cache key; or edge routing treats a
  private dynamic path as a static asset (`/account/settings.css`) and
  caches a personal response. Compare the cache key with every response
  variant and the app's path normalization.
- **WEB-SEC-03 Host header trust** — untrusted `Host`/`Forwarded` builds
  absolute URLs, password-reset links, callbacks, tenant routing or cache
  keys. (Client-IP spoofing is SEC-15.)
- **WEB-SEC-04 Response-header injection** — untrusted data reaching
  `Location`, `Set-Cookie`, CSP or another header with control characters;
  check whether the framework already rejects CR/LF before reporting.

## Browser sessions

- **WEB-SEC-05 Session lifecycle** — beyond SEC-10's fixation rule:
  sessions, refresh tokens, signed cookies and websocket connections that
  stay valid after logout, password change, revocation or account disable;
  account switch and impersonation that keep the old session's authority.
  CSRF inventory per SEC-09 must include method-override, multipart and
  legacy routes and login CSRF.
- **WEB-SEC-06 Cookie scope** — a sensitive cookie with an over-broad
  `Domain` or `Path` reachable by a less-trusted sibling subdomain, or two
  same-name cookies that different components pick differently. A bare
  missing flag stays a hardening note unless a realistic origin, network
  position or browser path can read or replace the credential.

## Federated identity

Establish the role first: redirect allowlisting and code issuance belong
to an authorization server, not a relying-party client; verification
belongs to whoever consumes the artifact.

- **WEB-SEC-07 JWT verification and claims** — signature verified with a
  server-pinned algorithm and key source; `exp`, `nbf`, `aud`, `iss`
  checked; `kid`, `jku`, `x5u` treated as untrusted key selectors; no
  decode-without-verify path. A token validly signed by a trusted issuer
  for *another* service is still invalid here.
- **WEB-SEC-08 OAuth/OIDC and SAML binding** — session-bound `state`, PKCE
  and code binding, ID-token issuer/audience/signature/nonce, the selected
  IdP bound in multi-provider flows, exact `redirect_uri` matching on the
  authorization server; compare the first callback with retry, mobile/deep
  link and account-link routes. For SAML: the element whose signature is
  checked must be the element used as identity (signature wrapping), with
  safe XML parsing, audience/recipient, validity window and replay state.

## Strong authentication and account transitions

- **WEB-SEC-09 MFA and step-up** — enrolling, replacing or disabling a
  second factor, generating recovery codes, or trusting a device without
  the fresh authentication policy requires; a completed challenge that
  upgrades the wrong session, account, tenant or action; an API, batch or
  resumed-flow route that skips the assurance check the UI enforces.
  WebAuthn: challenge, RP ID, origin, credential-to-user binding and
  required user verification checked at registration and login.
- **WEB-SEC-10 Account linking and recovery** — adding an IdP, passkey,
  email, phone or device to an account without a current session, proof of
  the new identity, step-up and state bound to the initiating account;
  unlink/relink and invite acceptance that collide verified identifiers or
  tenants. Recovery tokens and support/admin recovery: randomness,
  user and action binding, expiry, one-time use, rate limiting, delivery
  URL built from trusted config (see WEB-SEC-03), and invalidation of
  earlier tokens and sessions. Revealing that a public account exists is
  not automatically a finding.

## Service credentials

- **WEB-SEC-11 API-key scope and exposure** — a key that reaches more
  tenants, resources, actions or environments than its server-side record
  grants, or request parameters that override that binding; publishable vs
  secret key confusion; revocation cached too long; keys in client
  bundles, URLs, logs or error responses. A public identifier named "key"
  is not a secret — confirm the authority it grants.
- **WEB-SEC-12 mTLS identity** — client-certificate identity headers
  trusted from any network peer; a valid chain whose subject text maps to
  the wrong account; certificates accepted for the wrong trust domain,
  usage or audience; expired, revoked or renewal-failed certificates that
  fall back to bearer-only or anonymous access; pooled connections that
  keep authority after revocation. An in-repo fail-open branch is
  confirmable; missing revocation data is Needs validation.

## How to hunt it

Walk issue → store → transmit → consume → refresh → revoke for every
credential and challenge, across normal, error, retry, legacy and
account-switch paths. Enumerate every door to the same identity and every
route to the same sensitive operation: the effective policy is the weakest
parallel path. Diff parser, proxy, router, cache and app normalization side
by side. For recovery and linking, draw the account graph before and after:
each edge names the current principal, proof of the new identity, required
assurance, session binding and what gets revoked.
