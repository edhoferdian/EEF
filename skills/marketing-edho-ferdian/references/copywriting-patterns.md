# Copywriting Patterns — Landing Pages & Email Sequences

Scoped down from a full campaign-agency version (which assumes a
content-engine, paid ad budget, and multi-platform distribution pipeline)
to what a solo developer marketing their own tool actually produces and
maintains.

Apply the `VOICE PROFILE` from `brand-voice-framework.md` and the locked
positioning statement from SKILL.md Step 1 to every template below — these
are structures, not finished copy on their own.

---

## Landing page

Produce sections in this order. Each section states its purpose so the user
can tell if it's earning its place.

### Hero
- **Headline** (8-12 words) — states the core benefit, not a feature list.
- **Subhead** (1-2 sentences) — clarifies who it's for and what makes the
  mechanism work.
- **Primary CTA** — one action, specific ("Install with npm", "Try the
  demo"), never "Learn more".

### Problem
- 3-4 **concrete** pain points. Not abstract ("developers struggle with
  complexity") — specific ("you delete a file and find out three days later
  it broke prod").

### Solution
- How the product addresses each pain point named above, in the same order.
  One-to-one mapping makes the page easy to scan and hard to argue with.

### Features
- 3-5 named capabilities, each with **one line of benefit**, not a spec
  sheet. `Feature name — what it lets you actually do.`

### How it works
- 3-step flow, visual-friendly (numbered or icon-friendly phrasing). This is
  the section that turns "sounds cool" into "I get how to use this."

### Social proof
- Structure for testimonials/stats/logos **if real ones exist**.
- If the project has none yet (very common for a solo/early project): say so
  plainly in the deliverable notes and either omit the section or use an
  honestly-labeled placeholder (`[testimonial slot — fill once first users
  respond]`). Never fabricate a quote or a usage number.

### Closing CTA
- Restate the core benefit in one line, then the same primary CTA. Add
  urgency or specificity only if it's real (a genuine deadline, a genuine
  limited batch) — never fake scarcity.

---

## Email sequences

Two sequence types cover almost everything a solo dev needs. Pick based on
what the user is actually launching.

### Launch announcement (single email or 2-3 email burst)

| Email | Purpose | Notes |
|---|---|---|
| 1. Announcement | "Here's what I built and why" | Lead with the problem/mechanism, not "I'm excited to announce" |
| 2. (optional) Deeper dive | One specific use case or technical detail worth a second look | Only if there's real depth to add — don't pad to hit 3 emails |
| 3. (optional) Last call | Genuine close of a real window (e.g. early-access pricing ending) | Skip entirely if there's no real deadline |

### Onboarding drip (for a tool/SaaS with sign-ups)

| Day | Purpose |
|---|---|
| 0 | Welcome + the single most important first action to take |
| 2-3 | One concrete use case or workflow, shown not just told |
| 5-7 | Address the most common point of confusion/drop-off |
| 10-14 | Check-in — are they stuck? offer help, don't just upsell |

Sequence arc for either type: **problem → education → agitation → solution →
proof → urgency → final CTA** — not every email needs every beat, but the
sequence as a whole should move through this arc, not repeat the same pitch.

### Per-email structure

```text
Day N / Purpose: <what this email does in the sequence>
Subject: <subject line>
A/B variant: <alternate subject, if worth testing>
Preview text: <preview>
Body (150-300 words, one CTA):
<body copy>
```

Keep every email to **one CTA**. An email asking for two actions gets
neither.

---

## Ad copy variants (only if the user actually runs paid ads)

Do not produce this section unless the user has confirmed they're running
paid ads somewhere — a solo dev's marketing is usually organic (README,
social posts, community). If they are:

Produce 3-4 variants, each testing a different angle or audience segment:

```text
Variant N — <angle: e.g. "pain-first" | "outcome-first" | "mechanism-first">
Short headline (5-7 words): <...>
Long headline (10-14 words): <...>
Body (30-50 words): <...>
```

---

## Social posts (lightweight — organic only)

For a solo developer, this usually means a launch post plus a couple of
follow-ups, not a content calendar. Structure per post:

```text
[PLATFORM] Purpose: <problem angle | proof/insight angle | direct invitation>
<post copy — platform-native length and tone, never duplicate copy verbatim across platforms>
```

Keep each platform's post in its own native voice/length rather than copy-
pasting the same text everywhere — a post that reads as obviously
cross-posted undercuts the launch.

---

## Cold outreach anti-patterns

Watch for these when drafting any cold outreach message:

- Generic template with no personalization — nothing that shows the sender
  actually looked at the recipient.
- A long paragraph explaining the entire project instead of the one relevant
  point.
- More than one ask per message — pick a single next step.
- Fake familiarity ("great to connect!") with no specific detail backing it
  up.
- Identical copy reused verbatim across channels — it reads as obviously
  cross-posted and undercuts trust.

For a short-form video script, write it timestamped with visual-direction
notes rather than prose. A content calendar is only worth building when the
posting cadence is real, not aspirational — see `platform-content.md` for
both.

## Copy review checklist (apply before delivering anything above)

Cross-reference: this is the same table as SKILL.md Step 4 — re-run it here
specifically for the deliverable just produced, not as a separate pass:

- 5-second test: above-fold copy makes clear who it's for and what it does.
- One primary CTA per page/email/post.
- No hollow superlatives or marketing clichés (see SKILL.md hard-ban list).
- Voice matches the `VOICE PROFILE`.
- Every claim is specific and something the product can actually back up.
- Email subject matches email body — no bait-and-switch.
- Ad claims (if any) match landing-page claims.
