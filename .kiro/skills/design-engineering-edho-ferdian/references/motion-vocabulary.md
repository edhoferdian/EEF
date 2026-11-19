# Motion Vocabulary — naming the effect

Use when the user can picture an effect but can't name it
("the bouncy thing when a popover opens", "what's it called when…"). Give
the term, a one-line definition, and a phrase they can prompt with. This
is for naming, not building — to build it, go to `motion-foundations.md`.

## Entering and leaving

| Description | Term |
|---|---|
| Fades in while growing slightly | **Scale-in / pop-in** |
| Grows a bit past full size then settles | **Overshoot** (spring with bounce) |
| Slides in from an edge | **Slide-in** (from the named edge) |
| Appears from the element that opened it | **Origin-aware transition** / transform-origin |
| One element turns into another across screens | **Shared element transition** / morph (`layoutId`, View Transitions) |
| Old content fades out as new fades in | **Crossfade** |
| Blur clears as it fades in | **Blur-in / focus-in** |
| Revealed by an expanding mask | **Clip-path reveal / wipe** |
| Items appear one after another | **Stagger** / cascade |

## Movement quality

| Description | Term |
|---|---|
| Starts fast, slows to a stop | **Ease-out / deceleration** |
| Starts slow, speeds up | **Ease-in / acceleration** |
| Feels like it has weight and momentum | **Spring physics** |
| Wobbles before settling | **Underdamped spring / bounce** |
| Keeps moving after you let go | **Momentum / inertia (fling)** |
| Stretches resistively past the edge, snaps back | **Rubber-banding / overscroll bounce** |
| Lands on fixed positions after a drag | **Snap points** |
| Follows the finger exactly | **Direct manipulation / 1:1 tracking** |
| Can be grabbed mid-animation | **Interruptible animation** |
| Slightly lags the main motion | **Follow-through / secondary motion** |
| Squashes on impact, stretches when fast | **Squash and stretch** |
| Small move back before the main move | **Anticipation** |

## Feedback

| Description | Term |
|---|---|
| Button shrinks slightly when pressed | **Press state / tap scale** |
| Shakes side to side on error | **Shake / wiggle** |
| Ring expands from the tap point | **Ripple** |
| Element briefly grows to draw attention | **Pulse** |
| Line or icon draws itself | **Stroke draw / path animation** |
| Number rolls to its new value | **Number ticker / rolling digits** |
| Light sweeps across a placeholder | **Shimmer / skeleton loading** |
| Phone vibrates subtly on action | **Haptic feedback** |

## Scroll and space

| Description | Term |
|---|---|
| Background moves slower than foreground | **Parallax** |
| Animation progress tied to scroll position | **Scroll-driven animation** |
| Header shrinks or sticks as you scroll | **Collapsing / sticky header** |
| Elements animate as they enter the viewport | **Scroll reveal** |
| Layout reflows smoothly when items change | **Layout animation / FLIP** |
| Content behind looks frosted | **Backdrop blur / glass material** |
| Stack of cards fanned behind the front one | **Stacked / deck layout** |

When the user's description fits two terms, give both and the difference
in one line.
