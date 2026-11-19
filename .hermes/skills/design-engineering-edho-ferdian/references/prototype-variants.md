# Prototype Variants — several versions behind a live picker

**Manual mode:** run when the user asks for options ("kasih beberapa
versi", "give me a few options", "prototype this").

Builds several genuinely different versions of one UI piece, renders them
in the real app behind a small picker so the user can flip between them
live, then promotes the chosen one into the codebase.

## Process

1. **Pin down the piece.** One component or section, its real data and
   its states. Ask one question if the target is unclear.
2. **Choose the axes of difference.** Variants must differ in an idea, not
   in a colour: layout (list vs cards vs table), hierarchy (what leads),
   density, interaction model (inline edit vs dialog), motion approach.
   Write one line per variant naming its idea before building.
3. **Build 3 variants** by default (2–5 if the user asks). Each meets the
   full craft bar on its own — correct curves and durations, states,
   accessibility, responsive — no "rough draft" variant.
4. **Picker.** Render the variants in place, in the real page, with a
   small floating switcher (dev-only):
   - Fixed in a corner, above other UI, unobtrusive.
   - Buttons or a segmented control labelled with each variant's idea;
     keyboard shortcuts (e.g. `1`–`5`, or `[` / `]`) to cycle.
   - Remembers the current choice across reloads (`localStorage`, guarded
     with try/catch).
   - Excluded from production builds (env check or a dev-only import).
   Keep variants in a folder next to the component
   (`Component.variants/VariantA.tsx …`) with a small switch component.
5. **Hand over.** Tell the user the shortcut, one line per variant, and
   what to look for.
6. **Promote.** When the user picks one: move it into the real component,
   delete the other variants and the picker, and clean imports. Optionally
   keep a note of what was rejected and why.

## Rules

- Same data, same states for all variants — a fair comparison.
- Don't change shared code (tokens, layout shell) to make one variant
  work; keep variants isolated.
- If the user mixes ("A's layout with C's header"), build that as a new
  variant and keep the picker until they settle.

## Picking the axes — examples

| Piece | Variant A | Variant B | Variant C |
|---|---|---|---|
| Pricing section | Three cards side by side | Comparison table with sticky header | Single plan + toggle for team size |
| Settings page | Long single page with anchors | Left nav with sections | Search-first command list |
| Empty state | Illustration + one CTA | Checklist of first steps | Template gallery |
| Data row actions | Inline icon buttons | Overflow menu | Swipe/hover reveal |
| Onboarding | Multi-step modal | Inline checklist in the product | Interactive sample data |

If two variants would differ only in colour or spacing, they are one
variant — pick a different axis.

## Picker — React implementation

```
src/components/Pricing/
  Pricing.tsx                 ← renders the picker in dev, the chosen variant otherwise
  Pricing.variants/
    A-cards.tsx
    B-table.tsx
    C-single.tsx
    VariantPicker.tsx
```

```tsx
// Pricing.variants/VariantPicker.tsx
import { useEffect, useState } from "react";

type Variant = { id: string; label: string; Component: React.ComponentType<any> };

const read = (key: string) => { try { return localStorage.getItem(key); } catch { return null; } };
const write = (key: string, v: string) => { try { localStorage.setItem(key, v); } catch {} };

export function VariantPicker({ name, variants, props }: { name: string; variants: Variant[]; props: any }) {
  const storageKey = `variant:${name}`;
  const [id, setId] = useState(() => read(storageKey) ?? variants[0].id);
  const index = Math.max(0, variants.findIndex((v) => v.id === id));
  const current = variants[index];

  useEffect(() => write(storageKey, current.id), [current.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "]") setId(variants[(index + 1) % variants.length].id);
      if (e.key === "[") setId(variants[(index - 1 + variants.length) % variants.length].id);
      const n = Number(e.key);
      if (n >= 1 && n <= variants.length) setId(variants[n - 1].id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, variants]);

  return (
    <>
      <current.Component {...props} />
      <div role="toolbar" aria-label={`${name} variants`}
        style={{ position: "fixed", right: 12, bottom: 12, zIndex: 2147483647, display: "flex", gap: 4,
          padding: 4, borderRadius: 10, background: "rgb(20 20 20 / 0.85)", backdropFilter: "blur(8px)",
          font: "12px/1 system-ui", color: "white" }}>
        {variants.map((v, i) => (
          <button key={v.id} onClick={() => setId(v.id)} aria-pressed={v.id === current.id}
            title={`${i + 1} · ${v.label}`}
            style={{ padding: "6px 10px", borderRadius: 7, color: "inherit", border: 0,
              background: v.id === current.id ? "rgb(255 255 255 / 0.18)" : "transparent" }}>
            {i + 1}. {v.label}
          </button>
        ))}
      </div>
    </>
  );
}
```

```tsx
// Pricing.tsx
import { VariantPicker } from "./Pricing.variants/VariantPicker";
import A from "./Pricing.variants/A-cards";
import B from "./Pricing.variants/B-table";
import C from "./Pricing.variants/C-single";

export function Pricing(props: PricingProps) {
  if (process.env.NODE_ENV !== "production") {
    return <VariantPicker name="pricing" props={props} variants={[
      { id: "a", label: "Cards", Component: A },
      { id: "b", label: "Table", Component: B },
      { id: "c", label: "Single plan", Component: C },
    ]} />;
  }
  return <A {...props} />;   // current production choice until one is promoted
}
```

For non-React stacks, the same idea: a dev-only fixed toolbar, a key
listener, and a stored choice. Remove the whole `*.variants/` folder on
promotion.

## Hand-over message

```
3 variants of <piece> are live behind the picker (bottom-right, keys 1–3 or [ ]):
1. Cards — fastest to scan, plans side by side
2. Table — best when features matter more than price
3. Single plan — least choice, strongest default
Flip through them at mobile and desktop width. Tell me which to keep, or what to combine.
```
