# Desktop, mobile and local IPC — IPC-SEC-01..08

**Activation.** The scope is a desktop or mobile app, privileged helper,
updater, local daemon, webview host (Electron, Tauri, WebView2, Android
WebView, WKWebView), deep-link or file-association handler, browser
native-messaging host, or a local IPC client/server. Adapted from the
desktop/mobile companion of
[cloudflare/security-audit-skill](https://github.com/cloudflare/security-audit-skill)
(MIT, `c1c8a8c`), in this skill's own wording.

**Already covered — extend, do not duplicate:** browser-side webview
behaviour (`client-side.md`), update authenticity
(`supply-chain-release.md` SUP-SEC-08), native memory and loader safety
(`memory-safety-native.md`), ArkTS/HarmonyOS specifics
(`language-specific.md`), temp-file TOCTOU in general (**SEC-19**).

**Discipline.** Name the realistic attacker and their starting capability:
another app, another OS user, a sandboxed child, an untrusted document, a
remote web origin. Harm within the same account and authority is not a
boundary violation. Paths, process names, bundle IDs and claimed sender
fields are not peer authentication — OS peer credentials, code identity,
capability handles or protected channel state are. The bridge or helper
must authorize each operation on the final resource after parsing. Signing,
merged manifests, entitlements, installer ACLs and OS version facts you
cannot see are **Needs validation**.

## Deep links and handoffs

- **IPC-SEC-01 Deep link does privileged work** — a custom scheme or app
  link that mutates state, imports data, completes login or selects an
  account without a current-session, one-time callback binding; loose
  scheme/host/path matching, duplicate query fields, replayed links.
  OAuth, SSO, magic-link, invite, pairing and payment callbacks must bind
  the initiating app, session, account, provider, operation and expiry.
- **IPC-SEC-02 File, share and notification actions** — an associated file,
  share intent, drag-and-drop item, clipboard record or notification action
  that triggers a privileged operation without checking content type,
  sender trust, current user intent and the final target; a confirmation
  (notification, widget, biometric prompt) that approves a different action
  than it showed or runs after expiry.

## Webviews and native bridges

- **IPC-SEC-03 Remote content reaches the bridge** — a JavaScript-to-native
  bridge meant for packaged content callable from remote frames because the
  origin is checked only at first load or by URL prefix, not at call time
  after every navigation, redirect, subframe, popup and error page
  (Electron: `contextIsolation: false`, `nodeIntegration: true`, an
  unvalidated `ipcMain` handler, `shell.openExternal` on untrusted URLs).
- **IPC-SEC-04 Bridge too powerful** — a generic bridge letting web content
  name arbitrary files, commands, IPC methods, credentials or system
  actions with no method allowlist, argument normalization, user authority
  check or gesture requirement; webview file/universal access, debug ports
  or custom protocol handlers that join remote content to local files or
  internal origins. A restrictive setting missing with no reachable
  protected content is hardening.

## Local IPC

- **IPC-SEC-05 Unauthenticated local peer** — Unix sockets, named pipes,
  XPC, Binder, D-Bus, native messaging, shared memory or loopback listeners
  that accept a lower-trust peer without OS credentials, code identity or
  channel ownership, in front of a meaningful method; world-writable socket
  paths, predictable request IDs, inherited descriptors or stale channels
  that let one peer answer or reuse another's operation; the channel
  authenticated as one user while a request field selects another.
- **IPC-SEC-06 Exported component overreach** — an Android activity,
  service, receiver or provider (or a local automation endpoint) invokable
  from outside and doing work meant for the app itself. Read the final
  merged manifest, intent filters, permission level and path grants;
  manifest state after packaging unknown → Needs validation.

## Privileged helpers and local data

- **IPC-SEC-07 Helper as confused deputy** — a low-privilege caller
  choosing a privileged command, file, service, user or setting with no
  per-operation authorization (sudo, polkit, UAC, XPC helper rules); an
  installer or repair path that reads manifests, scripts, packages,
  symlinks or working directories a lower-trust user can write after
  authorization; a check-then-follow on a path that can be swapped by
  symlink, mount or case change during a privileged read or write.
- **IPC-SEC-08 Local secrets and state across accounts** — a keychain item,
  token file, backup, log, clipboard, notification preview or local config
  readable by another app, profile or user with less authority (plaintext
  readable only by the same intended OS account is not automatically a
  finding); cached data, background tasks, widgets, local databases,
  webview storage or biometric approvals that survive logout or account
  switch and appear under the next account, including after backup and
  restore.

## How to hunt it

List every process, app component, local endpoint, URI scheme, file
association, webview origin and helper, with its OS identity, privilege,
caller and callable operations. Read the final packaging inputs — merged
manifest, entitlements, installer rules, native-messaging registration,
protocol handlers, ACL creation — because source declarations get
overwritten downstream. Reason with dummy profiles; never touch another
user's apps or credentials.
