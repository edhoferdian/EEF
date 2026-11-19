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
