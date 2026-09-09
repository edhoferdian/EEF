# Mode — Demo & Walkthrough Recording (Playwright)

**This is not a test.** It produces a WebM walkthrough video of a working app —
for a release note, a README, a client handoff, or a bug reproduction someone
else has to watch. It reuses this skill's Playwright driver detection
(`driver-detection.md`) and nothing else; there are no assertions, no pass/fail,
and a demo run must never be counted as E2E coverage.

Use `qa-sweep.md` for post-deploy verification, `journey-design.md` for real
tests, and this file only when the deliverable is a video.

## Three phases — never skip to recording

| Phase | Output | Gate to pass |
|---|---|---|
| 1. Discover | List of real selectors, routes, and credentials | Every element the script touches was seen in a live page |
| 2. Rehearse | Headless dry run, no video | 100% of selectors resolve and are visible |
| 3. Record | WebM + narration notes | Rehearsal passed unchanged |

Recording before rehearsal produces a video with a stall in the middle, and a
stall cannot be edited out without re-recording. Rehearsal is cheap; take it.

**When rehearsal fails:** screenshot the failing step, find the correct
selector, update the script, re-run rehearsal from the top. Never "record and
hope" — and never patch a selector into something broader (`.btn` instead of
`[data-testid=...]`) just to make rehearsal pass.

## Storytelling flow

Follow the user's requested order, or this default:

1. **Entry** — sign in or land on the starting screen
2. **Context** — pan the surroundings so the viewer orients
3. **Action** — the main workflow
4. **Variation** — one secondary feature (settings, theme, filter)
5. **Result** — the outcome, confirmation, or new state

## Pacing table

| Moment | Pause |
|---|---|
| After login | 4s |
| After navigation | 3s |
| After clicking a button | 2s |
| Between major steps | 1.5–2s |
| After the final action | 3s |
| Typing | 25–40ms per character |

These are the difference between a demo that reads as deliberate and one that
reads as a machine flailing. Do not compress them to shorten the video — cut
steps instead.

## Cursor overlay

Playwright's video has no cursor. Inject one, and re-inject after **every**
navigation — the overlay dies with the document.

```javascript
async function injectCursor(page) {
  await page.evaluate(() => {
    if (document.getElementById('demo-cursor')) return
    const cursor = document.createElement('div')
    cursor.id = 'demo-cursor'
    cursor.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M5 3L19 12L12 13L9 20L5 3Z" fill="white" stroke="black" stroke-width="1.5" stroke-linejoin="round"/>
    </svg>`
    cursor.style.cssText = `position:fixed;z-index:999999;pointer-events:none;
      width:24px;height:24px;transition:left .1s,top .1s;
      filter:drop-shadow(1px 1px 2px rgba(0,0,0,.3));`
    document.addEventListener('mousemove', e => {
      cursor.style.left = e.clientX + 'px'
      cursor.style.top  = e.clientY + 'px'
    })
    document.body.appendChild(cursor)
  })
}
```

## Move, then click — never teleport

```javascript
async function moveAndClick(page, locator, label, opts = {}) {
  const { postClickDelay = 800, ...clickOpts } = opts
  const el = typeof locator === 'string' ? page.locator(locator).first() : locator
  if (!(await el.isVisible().catch(() => false))) {
    console.error(`WARNING: moveAndClick skipped — "${label}" not visible`)
    return false
  }
  await el.scrollIntoViewIfNeeded()
  await page.waitForTimeout(300)
  const box = await el.boundingBox()
  if (box) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 10 })
    await page.waitForTimeout(400)
  }
  await el.click(clickOpts)
  await page.waitForTimeout(postClickDelay)
  return true
}

async function typeSlowly(page, locator, text, label, charDelay = 35) {
  const el = typeof locator === 'string' ? page.locator(locator).first() : locator
  if (!(await moveAndClick(page, el, label))) return false
  await el.fill('')
  await el.pressSequentially(text, { delay: charDelay })
  await page.waitForTimeout(500)
  return true
}
```

Every helper takes a `label` and **warns rather than throws** on a missing
element — a demo run that dies halfway leaves no usable footage, while one that
skips a step leaves footage you can cut. This is the opposite of the failure
policy in `journey-design.md`, where a missing element must fail the test loudly.
Do not copy this leniency back into real tests.

Use `pressSequentially`, not `fill`, for anything the viewer should watch being
typed. Use smooth scroll (`page.mouse.wheel` in small increments or
`scrollIntoViewIfNeeded` + pause), never a jump.

## Before recording

- [ ] Discovery ran against the live app; every selector was observed, not guessed
- [ ] Rehearsal passed with zero skipped steps
- [ ] Test/demo data is seeded and looks real (no `asdf`, no `test@test.com`)
- [ ] No real credentials, tokens, PII, or internal URLs will appear on screen
- [ ] Viewport is fixed and matches the intended output aspect ratio
- [ ] Cursor injection is called after every navigation
- [ ] Any date/time or random content that would make the video look stale is
      controlled or accepted

## Common pitfalls

| Pitfall | Consequence |
|---|---|
| Instant `fill()` on inputs | Text appears from nowhere; viewer loses the thread |
| Cursor injected once, at start | Cursor vanishes after the first navigation |
| Selector guessed instead of discovered | Mid-video stall, full re-record |
| Real account used for the demo | Credentials or PII published in the video |
| Skipping rehearsal "because it's a small demo" | The most common cause of a re-record |
