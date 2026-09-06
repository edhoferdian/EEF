# Language Lens — React Native / Expo

Adapted from ECC `react-native-patterns` (SKILL.md) and `rules/react-native/*`
(`patterns.md`, `performance.md`, `security.md`, `coding-style.md`,
`accessibility.md`, `production-readiness.md`, `testing.md`, `hooks.md`),
fetched 2026-09-07.

**Detect.** `package.json` present with `react-native` or `expo` in
`dependencies`/`devDependencies` (Expo managed workflow assumed unless a bare
`android/`/`ios/` folder with no `expo` dependency signals a bare RN app —
note that distinction in the Phase 0 summary since some findings below,
EAS/OTA specifics, only apply to the managed workflow).

**Requires: `references/react.md` (load first).** React Native runs the same
reconciler and hook rules as web React — conditional hooks, missing/lying
dependency arrays, stale closures, direct state mutation, `key={index}` on
reordered lists, and the whole `useEffect`+`fetch` anti-pattern all apply
unchanged and are **not repeated here**. This lens adds only what's specific
to **React Native's runtime**: no DOM, a native list/view model instead of
HTML, a public app bundle instead of a same-origin web page, and native
device APIs with their own permission/lifecycle model. If `react.md` hasn't
already run for this file, run it first — this file assumes its findings are
already in scope.

**Boundary — read before flagging anything.** Generic TypeScript typing,
generic async correctness, generic function-length/nesting/magic-number
checks, and every hook-correctness item already owned by `react.md` are
**not re-flagged here**. This lens only adds React Native-specific mechanics:
list virtualization on `FlatList`/`FlashList` (not `<div>`+CSS), native
storage/permission APIs, Expo Router param validation, platform-file
divergence, and the bundle-is-public security model that differs from a
same-origin web app.

**Code placement.** Findings land as **CQ-10 (React Native mobile
anti-patterns)** in the general report, same slot `react.md` already uses for
web React anti-patterns — a React Native finding is still a React
anti-pattern, just one that only exists because there's no DOM. **No
`§React Native` section exists yet in
`security-review-edho-ferdian/references/language-specific.md`** (only
`§React` for the web lens does). Until one is written, flag React
Native-specific security findings directly under Domain 2 (SEC) using the
general skill's existing codes — **SEC-02** (secret exposure: real secrets in
the JS bundle), **SEC-10** (token handling: tokens outside
`expo-secure-store`), **SEC-01** (input sanitization: unvalidated deep-link/
route params) — rather than inventing a new per-stack code here that would
go stale the day that file catches up.

---

## Ground-truth commands

```bash
npx tsc --noEmit                                  # type errors, independent of Metro
npx expo lint                                      # eslint-config-expo (flat config, SDK 53+)
npx expo-doctor                                    # Expo/native dependency health + config validation
npx expo install --check                           # native deps aligned with the installed Expo SDK
npm audit                                          # supply-chain, general SEC domain
npx jest                                            # component/hook tests (jest-expo preset)
```

`expo-doctor` catches a class of finding that reading code alone can't:
native dependency/SDK version drift. Run it before asserting a New
Architecture compatibility finding as fact — reading a package's `package.json`
`peerDependencies` is reasoning, not verification, per the general skill's
ground-truth-first rule.

---

## Lens criteria

### CRITICAL

- **A large or dynamically-changing array rendered via `.map()` inside a
  `ScrollView`** instead of `FlatList`/`FlashList`. No virtualization means
  every row mounts at once — janky scroll and unbounded memory growth as the
  list grows, not just a performance nit at this size. **CQ-10.**
- **Auth tokens or other sensitive values stored in `AsyncStorage` or plain
  MMKV** instead of `expo-secure-store` (Keychain/Keystore-backed).
  `AsyncStorage` is unencrypted on-disk storage — readable by anything with
  filesystem access on a rooted/jailbroken device. **SEC-10.**
- **A real secret (private API key, service-role key, signing secret) present
  anywhere in JS source, `app.config`, or an `EXPO_PUBLIC_*` env var.** The
  bundle is public — a compiled app can be unpacked and every string in it
  read back out, `EXPO_PUBLIC_*` values included. Only genuinely public
  values (a Supabase anon key protected by RLS, a Firebase client config)
  belong there. **SEC-02.**
- **Deep-link or `useLocalSearchParams()` route params used to drive
  navigation, an API call, or a permission decision without Zod (or
  equivalent) validation first.** Deep links are attacker-controlled input —
  `parsed.data.id` reaching a query/mutation unchecked is the mobile
  equivalent of an unvalidated URL param on the web. Prefer `safeParse` over
  `parse`: a malformed deep link should redirect, not throw during render and
  crash the screen. **SEC-01.**

### HIGH

- **`FlatList`/`SectionList` missing a stable `keyExtractor`, or `renderItem`
  not memoized** — causes full row remount on every parent re-render instead
  of item-level reconciliation; worse than the equivalent web-list finding
  because RN's bridge/native-view creation cost per remounted row is higher
  than a DOM node. **CQ-10.**
- **A native Expo SDK call or subscription (`expo-location`, camera,
  notifications, etc.) wired directly into a component body or JSX** instead
  of inside a `use*` hook with a cleanup function — leaks the
  subscription/listener past unmount. Track status explicitly (`loading` /
  `denied` / `granted`, not just the raw value) so the UI can tell "still
  requesting permission" apart from "permission denied." **CQ-10.**
- **Inline style object or array literal on a hot-path component**
  (`<View style={{ padding: 16 }} />` re-created every render inside a list
  row or frequently-re-rendered screen) instead of `StyleSheet.create()` at
  module scope or a NativeWind class string. Each inline object is a fresh
  allocation every render — worse on RN than web because it also defeats
  `React.memo` on native view props. **CQ-10.**
- **`console.log` left in code that ships to a release build.** RN has no
  browser devtools to strip it in production the way a bundler sourcemap
  might quietly do on web — a stray `console.log` in a hot path (a list
  `renderItem`, a frequently-firing effect) has a measurable perf cost on
  device, not just a style nit. **CQ-10.**
- **Large platform divergence handled with scattered `Platform.OS === 'ios'`
  branches** instead of `Component.ios.tsx` / `Component.android.tsx` files.
  `Platform.select()`/`Platform.OS` is fine for a one-line style tweak; a
  component whose logic diverges substantially between platforms buried in
  inline conditionals is harder to reason about and test than two files with
  one contract. **CQ-10.**
- **Hardcoded status-bar/notch/safe-area offsets** instead of
  `react-native-safe-area-context` — breaks on any device with a different
  notch/Dynamic Island/gesture-bar geometry than the one it was eyeballed
  against. **CQ-10.**

### MEDIUM

- **Icon-only `Pressable`/`TouchableOpacity` with no `accessibilityLabel`.**
  There is no visible text for a screen reader to announce, so the control is
  silently unusable with VoiceOver/TalkBack. This is the RN-native-props
  equivalent of the web a11y lens's missing-`alt`/unlabeled-input finding —
  flag it here using RN's own `accessibilityRole`/`accessibilityLabel`/
  `accessibilityState` API, not the web ARIA vocabulary the general
  `accessibility-lens.md` expects; that lens is written for DOM elements and
  does not apply its own checklist mechanically to native views.
- **Async/transient UI changes (toast, inline validation error) with no
  `accessibilityLiveRegion` (Android) or `AccessibilityInfo.
  announceForAccessibility`** — a sighted user sees the change; a screen
  reader user gets no signal anything happened.
- **Touch target smaller than ~44×44pt (iOS) / 48×48dp (Android)** with no
  `hitSlop` to compensate — a usability/a11y regression on real devices, not
  just a design nit, since RN's default touch handling doesn't pad small
  targets the way some web click areas effectively do via surrounding
  padding.
- **A component's whole subtree wrapped in `useContext` for a
  high-frequency-changing value** (scroll position, animation progress) —
  every consumer re-renders on every update; prefer `react-native-reanimated`
  shared values or a narrower store for anything that changes every frame.
- **New object/array/function literal passed as a prop to a `React.memo`
  child on a screen with heavy native view trees** — same web finding as
  `react.md`, worth restating here because the remount cost per defeated
  memoization is higher on native (view creation, not just VDOM diffing).

---

## False-positive traps

- `Platform.OS`/`Platform.select()` used for a **genuinely small** style or
  behavior difference (one property, one line) is the *correct* tool — only
  flag it when the branch has grown into multi-line divergent logic that
  belongs in separate platform files instead.
- A `console.log`/`console.warn` wrapped in `if (__DEV__)` or stripped by a
  babel plugin configured for release builds is not a finding — check for
  that guard before flagging.
- `EXPO_PUBLIC_*` env vars holding a genuinely public value (a Supabase anon
  key, a Firebase web config, an analytics write key meant to be public) are
  not a secret-exposure finding — the finding is real only when the value is
  a private/service-role credential or a signing secret.
- `useLocalSearchParams()` read without validation is not a finding when the
  value is used only for a client-side UI decision with no backend/API call
  and no destructive action gated on it (e.g. which tab to highlight) — the
  risk is real when the param drives a fetch, a mutation, or an
  authorization decision, not for every read of every param.

## Escalate to general domain when…

- The finding is about **TypeScript typing or generic async correctness**
  with no React Native-specific mechanism behind it — general Domain 1 (CQ),
  not this lens.
- The finding is a **hook-correctness issue that also applies to web React**
  (conditional hook, missing dependency, stale closure) — that's `react.md`'s
  job; don't duplicate it here just because the file happens to be `.tsx` in
  an RN project.
- A performance claim needs **actual on-device profiling** (Hermes sampling
  profiler, React DevTools profiler, the in-app performance monitor) to
  confirm rather than static reading — escalate to `performance-audit-edho-
  ferdian` per the general skill's PERF escalation rule.
- The finding is a **build/dependency/New-Architecture-compatibility
  failure** rather than a review-time code-quality concern — that's
  `build-fix-edho-ferdian/references/react-native.md`'s job, not this lens's.
