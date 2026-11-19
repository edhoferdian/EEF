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
