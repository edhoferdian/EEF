# Expo / React Native Recipes

Working starting points for `expo-motion.md`. Written against Reanimated 4
+ react-native-worklets, Gesture Handler 2, Expo SDK with Expo Router.
Check the installed versions first (`npx expo install --check`, Context7):
spring defaults and the JS-callback bridge changed between Reanimated 3
and 4.

## 0. Shared setup

```bash
npx expo install react-native-reanimated react-native-worklets react-native-gesture-handler expo-haptics
```

Wrap the app root once (Expo Router: `app/_layout.tsx`):

```tsx
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Stack } from "expo-router";

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack />
    </GestureHandlerRootView>
  );
}
```

Motion tokens — one file, imported everywhere, mirroring the web tokens:

```ts
// motion.ts
import { Easing } from "react-native-reanimated";

export const ease = {
  out: Easing.bezier(0.22, 1, 0.36, 1),
  inOut: Easing.bezier(0.65, 0, 0.35, 1),
  drawer: Easing.bezier(0.32, 0.72, 0, 1),
};

export const duration = { press: 120, small: 180, medium: 260, sheet: 380 };

// Critically damped feel: no visible bounce. Tune per product, then reuse.
export const spring = {
  ui: { damping: 26, stiffness: 300, mass: 1 },
  snappy: { damping: 22, stiffness: 420, mass: 0.9 },
  playful: { damping: 12, stiffness: 180, mass: 1 }, // rare, celebratory moments only
};
```

## 1. Press feedback (scale on press)

Runs entirely on the UI thread; JS can be busy and the press still feels
instant.

```tsx
import { Pressable, PressableProps } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { ease, duration, spring } from "./motion";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function PressableScale({ style, children, ...props }: PressableProps & { children: React.ReactNode }) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <AnimatedPressable
      {...props}
      onPressIn={(e) => {
        scale.value = withTiming(0.97, { duration: duration.press, easing: ease.out });
        props.onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.value = withSpring(1, spring.snappy);
        props.onPressOut?.(e);
      }}
      style={[style, animatedStyle]}
    >
      {children}
    </AnimatedPressable>
  );
}
```

Large surfaces (list rows, cards that fill the width): use a background
opacity change instead of scale — scaling a full-width row looks like the
screen is breathing.

## 2. Enter / exit with layout animations

```tsx
import Animated, { FadeIn, FadeOut, LinearTransition, ReduceMotion } from "react-native-reanimated";

{visible && (
  <Animated.View
    entering={FadeIn.duration(220).easing(ease.out).reduceMotion(ReduceMotion.System)}
    exiting={FadeOut.duration(160).reduceMotion(ReduceMotion.System)}
    layout={LinearTransition.springify().damping(26).stiffness(300)}
  >
    <Banner />
  </Animated.View>
)}
```

- `entering`/`exiting` replace `AnimatePresence` from the web.
- `layout` animates siblings moving when an item is added or removed.
- Custom entering: combine opacity + a small translate (8–12 pt), never a
  scale from 0.

List with items leaving and siblings closing the gap:

```tsx
<Animated.FlatList
  data={items}
  keyExtractor={(i) => i.id}
  itemLayoutAnimation={LinearTransition.springify().damping(26).stiffness(300)}
  renderItem={({ item }) => (
    <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(140)}>
      <Row item={item} />
    </Animated.View>
  )}
/>
```

## 3. Swipe-to-dismiss row / card

```tsx
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming, interpolate, Extrapolation } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets"; // Reanimated 3: runOnJS from react-native-reanimated
import { useWindowDimensions } from "react-native";
import * as Haptics from "expo-haptics";

export function SwipeToDismiss({ onDismiss, children }: { onDismiss: () => void; children: React.ReactNode }) {
  const { width } = useWindowDimensions();
  const x = useSharedValue(0);
  const crossed = useSharedValue(false);
  const threshold = width * 0.35;

  const pan = Gesture.Pan()
    .activeOffsetX([-12, 12])      // intent threshold: taps and vertical scroll still work
    .failOffsetY([-10, 10])        // lock to the horizontal axis
    .onUpdate((e) => {
      x.value = e.translationX;    // 1:1 tracking, no animation during the drag
      const isPast = Math.abs(e.translationX) > threshold;
      if (isPast !== crossed.value) {
        crossed.value = isPast;
        scheduleOnRN(Haptics.selectionAsync); // tick when crossing the threshold
      }
    })
    .onEnd((e) => {
      const projected = e.translationX + e.velocityX * 0.2; // distance + momentum
      if (Math.abs(projected) > threshold) {
        const to = Math.sign(projected) * width * 1.1;
        x.value = withTiming(to, { duration: 200 }, (done) => {
          if (done) scheduleOnRN(onDismiss);
        });
      } else {
        x.value = withSpring(0, { ...spring.ui, velocity: e.velocityX });
      }
    });

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }],
    opacity: interpolate(Math.abs(x.value), [0, width * 0.6], [1, 0.4], Extrapolation.CLAMP),
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={style}>{children}</Animated.View>
    </GestureDetector>
  );
}
```

Check first whether Gesture Handler's `ReanimatedSwipeable` already covers
the case (swipe rows with actions behind them) before writing this.

## 4. Bottom sheet with snap points

Prefer, in order: native form sheet (Expo Router `presentation: "formSheet"`
with `sheetAllowedDetents`), then a maintained library
(`@gorhom/bottom-sheet`), then this hand-rolled version.

```tsx
const SNAP = [0.9, 0.5]; // fractions of screen height, top → bottom
const { height } = useWindowDimensions();
const points = SNAP.map((f) => height * (1 - f));  // translateY for each detent
const closed = height;

const y = useSharedValue(closed);
const start = useSharedValue(0);

const open = () => { y.value = withTiming(points[1], { duration: duration.sheet, easing: ease.drawer }); };

const pan = Gesture.Pan()
  .onBegin(() => { start.value = y.value; })   // grab mid-animation: continue from where it is
  .onUpdate((e) => {
    const next = start.value + e.translationY;
    // rubber-band above the highest detent
    y.value = next < points[0] ? points[0] - (points[0] - next) * 0.25 : next;
  })
  .onEnd((e) => {
    const projected = y.value + e.velocityY * 0.15;
    const candidates = [...points, closed];
    const target = candidates.reduce((a, b) => (Math.abs(b - projected) < Math.abs(a - projected) ? b : a));
    y.value = withSpring(target, { ...spring.ui, velocity: e.velocityY }, (done) => {
      if (done && target === closed) scheduleOnRN(onClose);
    });
  });

const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
const backdropStyle = useAnimatedStyle(() => ({
  // overlay follows sheet progress instead of running its own animation
  opacity: interpolate(y.value, [closed, points[1]], [0, 0.4], Extrapolation.CLAMP),
}));
```

Rules the sketch leaves to you: a close button and Android back handling,
focus/accessibility (`accessibilityViewIsModal`), keyboard avoidance, safe
area padding at the bottom, and only starting the drag from inner scroll
content when it is scrolled to the top (`Gesture.Native()` +
`simultaneousWithExternalGesture`).

## 5. Shared header that collapses on scroll

```tsx
const scrollY = useSharedValue(0);
const onScroll = useAnimatedScrollHandler((e) => { scrollY.value = e.contentOffset.y; });

const headerStyle = useAnimatedStyle(() => ({
  height: interpolate(scrollY.value, [0, 120], [140, 64], Extrapolation.CLAMP),
}));
const titleStyle = useAnimatedStyle(() => ({
  transform: [{ scale: interpolate(scrollY.value, [0, 120], [1, 0.8], Extrapolation.CLAMP) }],
  opacity: interpolate(scrollY.value, [60, 120], [0, 1], Extrapolation.CLAMP),
}));

<Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16}>…</Animated.ScrollView>
```

Height animates layout; acceptable here because it is driven 1:1 by
scroll on the UI thread. Prefer transforms when the layout below doesn't
need to reflow.

## 6. Tab / segmented indicator

```tsx
const x = useSharedValue(0);
const w = useSharedValue(0);
const layouts = useRef<{ x: number; width: number }[]>([]);

const select = (i: number) => {
  const l = layouts.current[i];
  x.value = withSpring(l.x, spring.snappy);
  w.value = withSpring(l.width, spring.snappy);
  Haptics.selectionAsync();
};

const indicator = useAnimatedStyle(() => ({ width: w.value, transform: [{ translateX: x.value }] }));

{tabs.map((t, i) => (
  <Pressable key={t} onLayout={(e) => (layouts.current[i] = e.nativeEvent.layout)} onPress={() => select(i)}>
    <Text>{t}</Text>
  </Pressable>
))}
<Animated.View style={[styles.indicator, indicator]} />
```

## 7. Number that changes

```tsx
// Roll the new value in from below; tabular figures keep the width steady.
<Animated.Text
  key={value}
  entering={FadeIn.duration(160).withInitialValues({ transform: [{ translateY: 8 }] })}
  exiting={FadeOut.duration(120)}
  style={{ fontVariant: ["tabular-nums"] }}
>
  {formatted}
</Animated.Text>
```

## 8. Hold to confirm

```tsx
const progress = useSharedValue(0);
const HOLD_MS = 900;

const hold = Gesture.LongPress()
  .minDuration(HOLD_MS)
  .onBegin(() => { progress.value = withTiming(1, { duration: HOLD_MS, easing: Easing.linear }); }) // linear: it represents time
  .onStart(() => { scheduleOnRN(Haptics.notificationAsync, Haptics.NotificationFeedbackType.Success); scheduleOnRN(onConfirm); })
  .onFinalize((_e, success) => { if (!success) progress.value = withTiming(0, { duration: 180, easing: ease.out }); });

const fill = useAnimatedStyle(() => ({ transform: [{ scaleX: progress.value }] }));
```

Always offer a non-hold path for accessibility (a confirm dialog when a
screen reader is on — `AccessibilityInfo.isScreenReaderEnabled()`).

## 9. Screen transitions with Expo Router

```tsx
// app/_layout.tsx
<Stack screenOptions={{ animation: "default" }}>         {/* platform-native push */}
  <Stack.Screen name="settings" options={{ presentation: "modal" }} />
  <Stack.Screen
    name="filters"
    options={{ presentation: "formSheet", sheetAllowedDetents: [0.5, 1], sheetGrabberVisible: true }}
  />
</Stack>
```

Prefer the native transitions: users know them and they run off the JS
thread. Custom transitions only when the product has a reason, and then
keep them short.

Shared-element transitions: check the installed Reanimated version's
support status before relying on `sharedTransitionTag`; it has been
experimental and changed between versions.

## 10. Keyboard-aware input bar

```tsx
import { KeyboardStickyView } from "react-native-keyboard-controller";

<KeyboardStickyView offset={{ closed: 0, opened: insets.bottom }}>
  <Composer />
</KeyboardStickyView>
```

`react-native-keyboard-controller` (needs `KeyboardProvider` at the root)
moves the bar with the keyboard frame-by-frame; `KeyboardAvoidingView`
alone often lags or jumps on Android.

## 11. Skeleton shimmer

```tsx
const t = useSharedValue(0);
useEffect(() => { t.value = withRepeat(withTiming(1, { duration: 1400, easing: Easing.linear }), -1); }, []);
const shimmer = useAnimatedStyle(() => ({
  transform: [{ translateX: interpolate(t.value, [0, 1], [-width, width]) }],
}));
```

Stop the loop when the content arrives (`cancelAnimation(t)`), and skip the
shimmer entirely with reduced motion — a static placeholder is enough.

## 12. Reduced motion everywhere

```tsx
import { useReducedMotion } from "react-native-reanimated";

const reduce = useReducedMotion();
const enter = reduce ? FadeIn.duration(150) : FadeIn.duration(220).withInitialValues({ transform: [{ translateY: 12 }] });
```

Movement becomes fade; feedback that carries meaning (a success state, a
selection) stays.

## Checklist before calling it done

- Release build on the weakest target phone, iOS and Android.
- Interrupt every animation: tap twice fast, grab mid-flight, rotate.
- No `scheduleOnRN`/`runOnJS` inside `onUpdate` except rare, throttled
  events (threshold haptics).
- Reduced motion on: still usable, nothing essential lost.
- Screen reader on: every gesture has a button or action alternative.
