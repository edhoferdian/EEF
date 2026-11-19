# Expo / React Native Motion

Use for any animation, gesture, sheet, screen transition, press feedback
or haptic in a React Native or Expo app. The decisions from
`motion-foundations.md` still apply (should it move, purpose, frequency,
curve, duration, exit, reduced motion); this file adds what is different
on device.

## Stack

- **Reanimated** for animation: shared values and animated styles run on
  the UI thread.
- **React Native Gesture Handler** for gestures, composed with Reanimated.
- **Expo Router** (React Navigation underneath) for screen transitions and
  native modals / form sheets.
- **expo-haptics** for tactile feedback.

Install with `npx expo install <package>` so versions match the SDK, not
plain `npm install`. Reanimated 4 needs `react-native-worklets`; check the
current setup steps for the project's SDK via Context7 before wiring the
Babel plugin by hand — recent `babel-preset-expo` handles it.

## Thread rule

The JS thread is busy (React renders, data, navigation). Anything that
must stay smooth runs on the UI thread:

- Drive animations with `useSharedValue` + `useAnimatedStyle`, never with
  React state per frame.
- Gesture callbacks from Gesture Handler (`Gesture.Pan()` etc.) run as
  worklets; update shared values there directly.
- Call back into JS (navigation, state) only at the end of a gesture or
  animation, through the worklets bridge (`scheduleOnRN` in Reanimated 4;
  `runOnJS` in older versions).
- Avoid the legacy `Animated` API for new work unless `useNativeDriver`
  covers every property you animate.

## Properties

Animate `transform` and `opacity`. Animating `width`/`height`/`margin`
re-runs layout; use Reanimated layout animations (`entering`, `exiting`,
`LinearTransition`) when size or position must change.

## Spring or timing

- Gesture release, interruptible motion → `withSpring`, passing the
  gesture's velocity.
- Fixed-length UI feedback → `withTiming` with an ease-out
  `Easing.bezier(...)` matching the web tokens.
- Keep springs critically damped for UI; bounce only for rare playful
  moments.

## Gesture hand-off

Same rules as `gestures.md`: track 1:1, carry velocity into release,
interruptible, resistance at edges, snap from projected position. Compose
simultaneous gestures explicitly (`Gesture.Simultaneous`,
`Gesture.Exclusive`) and coordinate with ScrollViews instead of fighting
them. Check whether a built-in fits first (e.g. Gesture Handler's
`ReanimatedSwipeable` for swipe rows).

## Sheets and screens

- Prefer native presentation: Expo Router `presentation: "formSheet"` /
  `"modal"` with detents, before a custom JS sheet. Behaviour differs
  between iOS and Android — test both.
- Custom sheets: drawer-style curve, drag to dismiss, keyboard-aware.
- Keyboard: `react-native-keyboard-controller` when inputs must move with
  the keyboard smoothly.

## Press feedback

Scale to ~0.97 on press-in with a quick timing, back with a spring on
press-out. Use `Pressable` + Reanimated, or a pressable that animates on
the UI thread.

## Haptics

Haptics confirm, they don't decorate:

- `selectionAsync()` for picker ticks and segmented changes.
- `impactAsync(Light/Medium)` for snapping into place, toggles.
- `notificationAsync(Success/Warning/Error)` for outcomes.

Fire at the moment of the event (snap, threshold crossed), not on every
frame. Never on scroll.

## Reduced motion

`useReducedMotion()` from Reanimated (or `AccessibilityInfo`). Replace
movement with fades or instant changes; layout animations accept
`.reduceMotion(ReduceMotion.System)`.

## Verify on device

Judge the feel on real hardware — the weakest phone you target, running a
release build. Expo Go and simulators flatter performance. Use the performance monitor to confirm the UI
thread holds 60/120 fps while the JS thread is busy.

## Symptoms → cause

| Symptom | Likely cause |
|---|---|
| Stutters while data loads | Animation driven from JS state; move it to shared values |
| Gesture feels laggy | `runOnJS`/state updates inside the gesture's update callback |
| Jumps on release | Velocity not passed to `withSpring`, or starting from a stale value |
| Works in simulator, stutters on phone | Dev build / Expo Go; test a release build |
