# Mobile Web That Feels Native

Use when a web app is built for or reviewed on phones, a PWA, or when
something "works in Chrome on desktop but feels wrong on my phone". Each
fix has a reason; apply it where the reason applies, not everywhere by
habit.

## Viewport and safe areas

- `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`.
- **100vh is taller than the visible area** on mobile browsers (toolbars).
  Use `100dvh` (dynamic), `100svh` (smallest) or `100lvh` (largest) as the
  layout needs; full-screen app shells usually want `dvh`.
- With `viewport-fit=cover`, pad fixed bars with
  `env(safe-area-inset-top|bottom|left|right)` so nothing sits under the
  notch or home indicator.
- Match the browser chrome: `<meta name="theme-color">` (with
  `media="(prefers-color-scheme: dark)"` variants).

## Touch feedback

- **Sticky hover:** on touch, `:hover` stays applied after a tap. Wrap hover
  styles in `@media (hover: hover) and (pointer: fine)`.
- **Tap highlight flash:** `-webkit-tap-highlight-color: transparent` once,
  globally — then give every tappable element its own `:active` state,
  because you've removed the browser's only feedback.
- **Laggy taps:** the viewport meta above removes the old 300 ms delay;
  `touch-action: manipulation` on controls disables double-tap zoom there.
- Tap targets at least 44 × 44 px.

## Inputs

- **Inputs that zoom the page on focus (iOS):** the input's font-size is
  below 16 px. Use 16 px on mobile; don't disable zoom to hide it.
- Use the right keyboard: `type="email|tel|url|number"`, `inputmode`,
  `autocomplete`, `enterkeyhint`.
- Keep focused inputs visible above the keyboard (visual viewport API or
  `interactive-widget=resizes-content` in the viewport meta).

## Scroll

- **Pull-to-refresh or scroll chaining hijacking a panel:**
  `overscroll-behavior: contain` on inner scrollers, sheets and modals.
- Lock background scroll when a modal or sheet is open, without the page
  jumping (preserve scroll position).
- Carousels: CSS scroll snap (`scroll-snap-type: x mandatory`), native
  momentum, and `touch-action: pan-x` on horizontal strips so vertical page
  scroll still works. Don't hijack the swipe direction.
- Don't build custom scroll physics.

## Text selection and long-press

- Long-press on buttons and controls selects their text or opens a callout:
  `user-select: none` and `-webkit-touch-callout: none` on controls only —
  never on content people may want to copy.
- Images that are UI, not content: `draggable="false"`, and
  `-webkit-touch-callout: none`.

## App-like shell

- Fixed bottom navigation inside the safe area; content padded so it
  never hides behind it.
- Native-feeling sheets: drag to dismiss (`gestures.md`).
- PWA: manifest with `display: standalone`, icons, `theme_color`;
  `apple-mobile-web-app-status-bar-style` for iOS status bar style.
- Respect `prefers-color-scheme`, `prefers-reduced-motion`, and
  `prefers-contrast`.

## Test on real hardware

Emulators miss the toolbar behaviour, keyboard, safe areas, momentum and
performance. Check on at least one real iPhone (Safari) and one real
Android (Chrome) before calling it done.

## Code

### Base stylesheet for an app-like mobile web shell

```css
html {
  -webkit-text-size-adjust: 100%;            /* stop iOS inflating text on rotate */
  text-size-adjust: 100%;
}
body {
  -webkit-tap-highlight-color: transparent;  /* remove the grey flash... */
  overscroll-behavior-y: none;               /* app shell: no bounce/pull-to-refresh on the page itself */
}
button, a, [role="button"] {
  touch-action: manipulation;                /* no double-tap-zoom delay on controls */
  -webkit-user-select: none; user-select: none;
  -webkit-touch-callout: none;
}
button:active, a:active { opacity: 0.7; }    /* ...and give every tappable its own feedback */

.app {
  min-height: 100dvh;
  padding: env(safe-area-inset-top) env(safe-area-inset-right) 0 env(safe-area-inset-left);
}
.tabbar {
  position: fixed; inset-inline: 0; bottom: 0;
  padding-bottom: max(8px, env(safe-area-inset-bottom));
}
.content { padding-bottom: calc(64px + env(safe-area-inset-bottom)); } /* never hidden behind the tab bar */

input, select, textarea { font-size: max(16px, 1rem); }               /* no zoom on focus in iOS */

@media (hover: hover) and (pointer: fine) {
  .card:hover { background: var(--surface-hover); }                    /* hover only where it exists */
}
```

### Head tags

```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content">
<meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0b0b0c" media="(prefers-color-scheme: dark)">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<link rel="manifest" href="/manifest.webmanifest">
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">
```

Never `maximum-scale=1` or `user-scalable=no` — it breaks accessibility
zoom. Fix the input font size instead.

### Scroll lock for modals and sheets (keeps position, no jump)

```ts
export function lockScroll() {
  const y = window.scrollY;
  const { style } = document.body;
  Object.assign(style, { position: "fixed", top: `-${y}px`, left: "0", right: "0", overflow: "hidden" });
  return () => {
    Object.assign(style, { position: "", top: "", left: "", right: "", overflow: "" });
    window.scrollTo(0, y);
  };
}
```

Plus `overscroll-behavior: contain` on the sheet's own scroller so
reaching its end doesn't scroll the page behind. Component libraries
(Radix, Vaul) already do this — don't double-lock.

### Keep the focused input visible above the keyboard

```ts
const vv = window.visualViewport;
vv?.addEventListener("resize", () => {
  // the visual viewport shrinks when the keyboard opens
  document.documentElement.style.setProperty("--keyboard", `${window.innerHeight - vv.height}px`);
});
```

```css
.composer { position: fixed; bottom: var(--keyboard, 0px); }
```

With `interactive-widget=resizes-content` (Chrome on Android) the layout
viewport resizes instead, and `100dvh` layouts adapt without this script.
Test both browsers.

### Horizontal strip that doesn't steal vertical scroll

```css
.strip {
  display: flex; gap: 12px;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  overscroll-behavior-x: contain;    /* don't trigger browser back/forward swipes */
  touch-action: pan-x pan-y;
  scrollbar-width: none;
  scroll-padding-inline: 16px;
}
.strip > * { scroll-snap-align: start; flex: 0 0 80%; }
```

## PWA specifics

- Manifest: `name`, `short_name`, `start_url`, `display: "standalone"`,
  `background_color`, `theme_color`, icons (192, 512, maskable).
- In standalone mode there is no browser back button: every screen needs
  its own way back.
- Detect standalone with `matchMedia("(display-mode: standalone)")` to
  hide "install" prompts and adjust safe areas.
- Splash and status bar colours come from the manifest/meta tags — match
  them to the first screen to avoid a flash.
- Offline: a service worker with a clear offline state, not a blank page.

## Quick diagnosis

| "Feels wrong on my phone" | Cause | Fix |
|---|---|---|
| Bottom bar jumps when scrolling | `100vh` | `100dvh` / `100svh` |
| Content under the notch / home bar | No safe-area padding | `viewport-fit=cover` + `env(safe-area-inset-*)` |
| Page zooms when tapping an input | Input font < 16 px | 16 px on mobile |
| Buttons stay highlighted after tap | Hover styles on touch | `(hover: hover) and (pointer: fine)` |
| Grey flash on tap | Tap highlight | Transparent highlight + own `:active` |
| Long-press selects button text | Selectable controls | `user-select: none` on controls only |
| Modal scroll moves the page | Scroll chaining | `overscroll-behavior: contain` + scroll lock |
| Carousel blocks vertical scroll | Wrong `touch-action` / JS hijack | Native scroll snap, `pan-y` allowed |
| Keyboard covers the input | No viewport handling | `interactive-widget` + visualViewport |
| Status bar colour clashes | No `theme-color` | Per-scheme `theme-color` meta |
