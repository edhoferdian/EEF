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

## Timing and curves

| Description | Term |
|---|---|
| How long a motion lasts | **Duration** |
| Wait before it starts | **Delay** |
| Shape of the speed over time | **Easing curve** (cubic-bezier) |
| Custom curve defined by four numbers | **Cubic bézier** |
| Same speed throughout | **Linear** |
| Fast in the middle, slow at both ends | **Ease-in-out** |
| Ends slightly past the target, then returns | **Overshoot / back easing** |
| Moves in discrete jumps | **Stepped / steps()** |
| A spring's "how fast it gets there" | **Response / stiffness** |
| A spring's "how much it wobbles" | **Damping (ratio)** |
| No wobble at all | **Critically damped** |
| Motion that keeps going until friction stops it | **Decay / inertia** |

## Transitions between views

| Description | Term |
|---|---|
| New screen slides over the old one | **Push / slide-over** |
| Old screen moves aside as the new one arrives | **Parallax push** |
| A card grows into a full screen | **Container transform / zoom transition** |
| Element animates between two pages | **Shared element / View Transition** |
| One view flips to show its back | **Flip** |
| Screens fade through a neutral midpoint | **Fade-through** |
| Views slide sideways in a sequence | **Carousel / pager** |
| Page behind recedes as a sheet comes up | **Sheet with background scale-down / depth push** |

## Text and content

| Description | Term |
|---|---|
| Letters appear one after another | **Typewriter** |
| Words or lines rise into place in sequence | **Text reveal / staggered text** |
| Text scrambles before settling | **Scramble / decode effect** |
| A word cycles through alternatives | **Rotating text / word swap** |
| Content fades in as you scroll to it | **Scroll reveal** |
| Highlight sweeps across text | **Text shimmer / gradient sweep** |
| Height grows smoothly to fit content | **Auto-height / expand animation** |

## Interaction patterns

| Description | Term |
|---|---|
| Pull down to reload | **Pull-to-refresh** |
| Swipe a row to reveal actions | **Swipe actions / swipe-to-reveal** |
| Swipe something away | **Swipe-to-dismiss** |
| Press and hold until something fills | **Hold-to-confirm / long-press progress** |
| Drag items to change their order | **Drag-to-reorder / sortable** |
| Item lifts when you start dragging it | **Lift / pick-up state** |
| Menu items light up as you move across | **Hover tracking / magnetic highlight** |
| Element nudges toward the cursor | **Magnetic hover** |
| Card tilts toward the pointer | **Tilt / 3D hover** |
| Indicator glides between selected tabs | **Sliding indicator / shared layout** |
| Button stretches into a panel | **Morph** |
| Item arcs into a cart or folder | **Fly-to / add-to-cart animation** |

## Ambient

| Description | Term |
|---|---|
| Slow continuous movement in the background | **Ambient / idle animation** |
| Soft breathing scale on a button | **Breathing / pulse** |
| Gradient colours slowly drifting | **Gradient animation / mesh gradient** |
| Moving noise texture | **Grain / film noise** |
| Infinite horizontal scroll of logos | **Marquee / ticker** |
| Things float gently up and down | **Floating / bobbing** |

When the user's description fits two terms, give both and the difference
in one line. Then give a ready-to-paste prompt line, e.g. *"Add a
scale-in pop (0.96 → 1, 180 ms ease-out, from the trigger's side) to the
dropdown."*
