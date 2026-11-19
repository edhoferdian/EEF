# Break the UI — worst-case data stress test

Use for "coba data terburuk", edge-case hunting, or any request to see
how a component or screen holds up under hostile data. Not for visual critique
(`interface-polish.md`) or motion (`motion-review.md`).

## Process

1. **Read the component** and list every piece of data it renders: names,
   emails, titles, counts, dates, images, lists, optional fields.
2. **Build a worst-case set** for each field from the catalog below — only
   cases that can actually occur for that field.
3. **Render behind a toggle.** Add a small dev-only switch
   ("Demo data / Worst case", or one option per scenario) next to the
   component, so the user can flip between real-looking and worst-case data
   live. Keep it out of production builds.
4. **Flip through every scenario** and check the layout at narrow (≈320
   px) and wide widths, light and dark.
5. **Report** what broke, with the fix for each.
6. **Fix only what the user picks**, using the project's conventions, then
   flip through every scenario again. Remove the toggle when the user says
   so.

## Catalog

**Text length**
- Very long name with no spaces (`Maximilianus-Bartholomew-Wolfeschlegel…`)
- Long email without break points (`firstname.lastname.department@subdomain.company-name.co.uk`)
- Long URL with query string
- One-character name; empty string; only whitespace
- Long label on a button, tab, badge, or menu item
- A paragraph where a short line was expected
- Long single word in a heading (German compound)

**Missing or odd values**
- Optional fields missing (no avatar, no description, no date)
- `null` / `undefined` rendered as text
- Image that fails to load; image with extreme aspect ratio
- Default avatar initials from an emoji or non-Latin name

**Numbers**
- 0, 1 (singular), 2, very large (1,234,567,890), negative, decimals
- Currency with long symbols; percentages over 100
- Count that grows from 9 to 10 to 100 (width change)

**Collections**
- Zero items (empty state)
- One item
- Many items (hundreds) — scrolling, performance, "show more"
- Items of wildly different heights

**Language and script**
- Non-Latin scripts (Arabic RTL, Chinese, Thai, Devanagari)
- Mixed RTL/LTR in one string
- Emoji, including multi-codepoint sequences (family, flags)
- Accents and combining characters

**Dates and time**
- Far past, far future, today, "just now"
- Different time zones; 12/24-hour formats

**State**
- Loading, error, partial data, permission denied
- Very slow network (skeleton duration)
- Text zoom 200 % and large system font

## Fix patterns

| Broke | Fix |
|---|---|
| Text overflows container | `min-width: 0` on the flex child + truncate or wrap per field |
| Unbreakable string widens layout | `overflow-wrap: anywhere` (content) or middle truncation (emails, file names) |
| Truncated value unreadable | Full value on hover/focus (title or tooltip) |
| Avatar squished | `flex-shrink: 0`, fixed size |
| Count changes width | `tabular-nums`, min-width, or "99+" |
| "1 items" | `Intl.PluralRules` |
| Empty list shows nothing | Real empty state with an action |
| RTL breaks alignment | Logical properties (`margin-inline-start`), `dir="auto"` |

## Report format

```
## Break test — <component>

| # | Scenario | What broke | Fix |
|---|---|---|---|
| 1 | Long email | Pushes the action button off-screen | min-width: 0 + middle truncation, full value in tooltip |

Survived: <scenarios that rendered fine>
Which should I fix?
```

## Ready-made worst-case data

Copy into a fixture file next to the component (`Component.worstcase.ts`)
and pick only the fields that exist.

```ts
export const worstCase = {
  names: {
    long: "Maximilianus Bartholomew Montgomery-Wolfeschlegelsteinhausen",
    unbroken: "Supercalifragilisticexpialidocious_Administrator_Account",
    single: "Q",
    empty: "",
    spaces: "   ",
    rtl: "محمد عبد الرحمن",
    mixedDirection: "Order #4521 — طلب جديد",
    cjk: "李小龍工作室有限公司",
    thai: "สมชาย ใจดีมากที่สุด",
    devanagari: "श्रीनिवास रामानुजन्",
    emoji: "Ana 👩🏽‍💻🚀",
    familyEmoji: "👨‍👩‍👧‍👦 Family",
    accents: "Zoë Þórðardóttir-Ångström",
    allCaps: "WWWWWWWWWWWWWWWWWWWW",
  },
  emails: {
    long: "firstname.middlename.lastname.department@subdomain.example-company.co.uk",
    plus: "user+newsletter+2026@example.com",
  },
  urls: {
    long: "https://example.com/workspaces/acme/projects/q3-launch/documents/0f4c8e2a9b7d?tab=comments&filter=unresolved&sort=newest",
  },
  text: {
    paragraphInLabel: "This label was supposed to be two words but someone pasted the whole product description into it instead.",
    longWord: "Donaudampfschifffahrtsgesellschaftskapitän",
    newlines: "Line one\nLine two\n\n\nLine five",
    html: "<b>not bold</b> & \"quotes\" 'apostrophes'",
  },
  numbers: {
    zero: 0, one: 1, negative: -1250, decimal: 0.3333333, huge: 1234567890123,
    percentOver: 142.5, currencyLong: { amount: 98765432.1, currency: "IDR" },
  },
  counts: [0, 1, 2, 9, 10, 99, 100, 999, 1000, 10000, 1_000_000],
  dates: {
    now: new Date(),
    oneMinuteAgo: new Date(Date.now() - 60_000),
    farPast: new Date("1970-01-01T00:00:00Z"),
    farFuture: new Date("2099-12-31T23:59:59Z"),
    leapDay: new Date("2028-02-29T12:00:00Z"),
  },
  images: {
    broken: "https://example.invalid/missing.png",
    panorama: "https://picsum.photos/2400/300",
    tall: "https://picsum.photos/300/2400",
  },
  lists: {
    empty: [] as unknown[],
    one: (x: unknown) => [x],
    many: (x: unknown, n = 500) => Array.from({ length: n }, () => x),
  },
};
```

Locale and environment scenarios to flip as well: browser text zoom 200 %,
OS large text, right-to-left `dir="rtl"`, a narrow 320 px viewport, dark
mode, slow 3G (skeleton duration), and a failed request (error state).

## Toggle component (dev-only)

```tsx
const scenarios = ["demo", "long", "empty", "huge", "rtl", "missing"] as const;

export function WorstCaseToggle({ value, onChange }: { value: string; onChange: (s: string) => void }) {
  if (process.env.NODE_ENV === "production") return null;
  return (
    <div style={{ position: "fixed", bottom: 12, left: 12, zIndex: 9999, display: "flex", gap: 4,
      padding: 4, borderRadius: 8, background: "rgb(0 0 0 / 0.75)", font: "12px system-ui" }}>
      {scenarios.map((s) => (
        <button key={s} onClick={() => onChange(s)}
          style={{ padding: "4px 8px", borderRadius: 6, color: "white",
            background: s === value ? "rgb(255 255 255 / 0.2)" : "transparent" }}>
          {s}
        </button>
      ))}
    </div>
  );
}
```

## What to look for in each scenario

| Scenario | Look for |
|---|---|
| Long / unbroken text | Overflow, pushed-off buttons, overlapped icons, broken grid columns |
| Empty / missing | "undefined", "null", "NaN", empty boxes with borders, collapsed layout |
| Counts 9 → 10 → 1000 | Width jumps, badges overflowing, "1 items" |
| RTL / mixed | Mirrored icons that shouldn't be (logos, play), alignment, punctuation order |
| CJK / Thai | Line breaking, missing glyphs, vertical clipping of tall scripts |
| Emoji | Width miscounted, truncation splitting a sequence, avatar initials from an emoji |
| Many items | Scroll performance, sticky headers, pagination, "select all" |
| Dates | "in -3 days", wrong relative wording, time zone shifts |
| Broken image | Alt text layout, fallback, aspect ratio collapse |
| 200 % text | Clipped labels, overlapping elements, horizontal scroll |
