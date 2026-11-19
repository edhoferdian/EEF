# Expo / React Native Motion

Use for any animation, gesture, sheet, screen transition, press feedback
or haptic in a React Native or Expo app. Code for every pattern below is
in `expo-recipes.md`. The web decisions in `motion-foundations.md` still
apply; this file covers what changes on a phone.

## Decision order

Make these in order; an earlier answer can cancel the rest.

1. **Should it move?** Same test as the web: it orients, confirms,
   explains or signals. Phones are used one-handed, in a hurry — every
   extra 100 ms is felt. Frequent actions (tab switches, list taps, typing)
   stay instant or near-instant.
2. **Native first.** Is there a platform component that already does this
   (native stack push, form sheet, context menu, swipeable row, pull to
   refresh)? Use it. Users already know its feel, and it runs off the JS
   thread for free.
3. **Which thread?** Anything continuous or gesture-driven runs on the UI
   thread (Reanimated worklets). JS only learns the result.
4. **Which properties?** `transform` and `opacity`. Layout changes go
   through layout animations, not animated width/height.
5. **Spring or timing?** Gesture-driven and interruptible → spring with
   the gesture's velocity. Fixed feedback → timing with an ease-out curve.
6. **How does the gesture hand off?** Release velocity continues into the
   animation; the user can grab it again mid-flight.
7. **How does it degrade?** Reduced motion, screen reader, low-end
   Android, and the JS thread being blocked.

## Stack

| Need | Use |
|---|---|
| Animation values and styles | `react-native-reanimated` (+ `react-native-worklets` in v4) |
| Touch input | `react-native-gesture-handler` (`Gesture.*` + `GestureDetector`) |
| Screens, modals, sheets | Expo Router (React Navigation native stack) |
| Bottom sheets beyond native detents | `@gorhom/bottom-sheet` |
| Keyboard-synced UI | `react-native-keyboard-controller` |
| Tactile feedback | `expo-haptics` |
| Blur / materials | `expo-blur` (`BlurView`) |
| Vector / complex animation | `react-native-svg` with animated props; Lottie or Rive for illustrator-made motion |

Install with `npx expo install` so versions match the SDK. Reanimated 4
requires the New Architecture and moves the JS bridge helpers to
`react-native-worklets` (`scheduleOnRN` replaces `runOnJS`). Recent
`babel-preset-expo` configures the plugin; don't add it twice. Confirm
against the project's SDK before wiring anything by hand.

## The thread model, concretely

React Native has (at least) two threads that matter:

- **JS thread** — React renders, effects, state, fetch parsing,
  navigation logic. Busy often: a screen mounting, a big list rendering.
- **UI thread** — native views, layout commits, and Reanimated worklets.

An animation driven from JS state (`setState` every frame, legacy
`Animated` without the native driver) freezes whenever the JS thread is
busy — exactly when the user is navigating. The fix is structural:

- Values live in `useSharedValue`; styles in `useAnimatedStyle`; both run
  on the UI thread.
- Gesture callbacks are worklets: write to shared values directly inside
  `onUpdate`.
- Cross back to JS only at the edges: gesture end, animation finished
  (`withTiming(…, cb)` → `scheduleOnRN(fn)`), threshold crossed once.
- Read shared values in render only for initial values; never subscribe
  React to a per-frame value.
- `useDerivedValue` for values computed from others (progress → opacity),
  `useAnimatedReaction` to react to a threshold without re-rendering.

## Properties and layout

- Translate/scale/rotate/opacity are cheap. Prefer `translateY` over
  animating `top`/`marginTop`.
- Size and position changes from content (an item added, text expanding):
  layout animations (`layout={LinearTransition}`), `entering`/`exiting`.
- Animating `height` is acceptable when it is directly driven by scroll or
  a gesture 1:1; avoid timed height animations on complex layouts.
- Shadows are expensive on Android (elevation re-renders). Animate the
  opacity of a pre-rendered shadow layer instead of shadow properties.
- Blur (`BlurView`) is costly; don't animate its intensity on large areas
  every frame on Android.

## Curves, springs, durations

- Share one token file with the web values (see `expo-recipes.md` §0): an
  ease-out for entering, an ease-in-out for moving, a drawer curve for
  sheets, two or three named springs.
- UI springs: critically damped or close (no visible overshoot). Reserve
  bouncy springs for rare celebratory moments.
- Pass `velocity` from the gesture into `withSpring` on release, or the
  motion visibly restarts.
- Durations on phones: press 100–150 ms, small elements 150–250 ms,
  sheets 300–450 ms. Exits shorter than entrances.
- Reanimated 4 changed spring defaults and supports duration-based springs
  (`duration` + `dampingRatio`); pick one style per project and keep it.

## Gestures

All rules from `gestures.md` apply. Specific to Gesture Handler:

- **Intent thresholds**: `activeOffsetX/Y` before a pan claims the touch;
  `failOffsetX/Y` to give up when the user scrolls the other way.
- **Composition**: `Gesture.Simultaneous` (pinch + rotate),
  `Gesture.Exclusive` (double-tap before single-tap), `Gesture.Race`.
- **Scroll interplay**: a draggable sheet with inner scroll content needs
  `Gesture.Native()` for the scroller and `simultaneousWithExternalGesture`
  so the sheet only drags when the content is at the top.
- **Projected release**: decide the target from position + velocity ×
  ~0.15–0.2 s, then spring there with the velocity.
- **Edge resistance**: past the limit, move 20–30 % of the finger delta.
- **Android back** closes sheets and modals; handle it.

## Screens and sheets

- Native stack push/pop for hierarchy. Don't replace it with a custom JS
  transition without a reason.
- Modal for a separate task; form sheet (`presentation: "formSheet"` with
  detents and a grabber) for a quick related task. They behave differently
  on iOS and Android — test both.
- Custom sheets (`@gorhom/bottom-sheet` or hand-rolled) when you need
  behaviour native detents don't give: dynamic content height, footer
  pinned above the keyboard, nested scroll.
- Sheet entrance with the drawer curve; backdrop opacity follows the
  sheet's position.

## Press feedback

- Scale to ~0.97 on press-in (timing, ~120 ms, ease-out); spring back on
  press-out.
- Full-width rows: background highlight instead of scale.
- Android ripple (`android_ripple`) where the platform look matters.
- Feedback must appear even when the JS thread is busy — UI-thread
  animation, not state.

## Haptics

| Moment | Call |
|---|---|
| Picker tick, segmented change, crossing a swipe threshold | `selectionAsync()` |
| Snapping into a detent, toggling a switch | `impactAsync(Light)` |
| A heavier physical action (drop into place) | `impactAsync(Medium)` |
| Success / warning / failure outcome | `notificationAsync(Success / Warning / Error)` |

Fire at the event, once. Never per frame, never on scroll, never on every
tap of a frequent control. Respect the system setting (haptics simply do
nothing when disabled).

## Materials and depth

- iOS chrome over content (tab bar, header, sheet header): `BlurView` with
  `tint` matched to the color scheme, plus a hairline separator.
- Android: blur is costlier and less conventional; a solid surface with a
  tonal elevation colour often reads better.
- Elevation levels consistent across the app; dark mode relies on lighter
  surfaces rather than shadows.

## Reduced motion and accessibility

- `useReducedMotion()` (Reanimated) or `AccessibilityInfo.isReduceMotionEnabled()`.
- Layout animations: `.reduceMotion(ReduceMotion.System)`.
- Replace movement with fades; keep meaningful feedback.
- Every gesture has an accessible alternative: `accessibilityActions`
  ("Delete", "Dismiss"), buttons for sheet close, a non-hold confirm.
- Screen reader focus moves into a newly opened sheet/modal and returns on
  close.

## Performance on device

- Judge feel only in a release build (`npx expo run:ios --configuration
  Release`, `npx expo run:android --variant release`) on the weakest phone
  you target. Expo Go and debug builds run slower JS and lie about feel.
- Turn on the Perf Monitor: the UI frame rate must stay at 60/120 while the
  JS frame rate drops during heavy work.
- Long lists: FlashList or a tuned FlatList (`getItemLayout`,
  `windowSize`, memoised rows) — animations can't save a list that drops
  frames rendering rows.
- Images: correctly sized (`expo-image` with caching); decoding big images
  during a transition causes hitches.

## Symptoms → cause

| Symptom | Likely cause | Fix |
|---|---|---|
| Stutters while a screen loads | Animation tied to JS state | Shared values + animated style |
| Gesture feels laggy | JS callback or `setState` in `onUpdate` | Write shared values only; bridge on end |
| Jumps on release | Velocity not passed; starting from a stale value | `withSpring(target, { velocity })`; continue from current value |
| Can't grab it mid-animation | Timing animation with no `onBegin` capture | Store current value on begin, cancel and track |
| Sheet fights the inner scroll | No native-gesture coordination | `Gesture.Native()` + `simultaneousWithExternalGesture` |
| Smooth on iPhone, choppy on Android | Shadows/blur/elevation animated, debug build | Pre-render shadows, test release build |
| Keyboard covers the input | `KeyboardAvoidingView` timing | `react-native-keyboard-controller` |
| Haptics feel noisy | Firing on every update or every tap | Fire once at the event; drop it from frequent controls |
