# Interface Design System: Neumorphism Club

## Direction and Feel
- **Visual Style:** Minimal, clean, tactile, high-contrast, matrix-inspired terminal.
- **Typography:** All Elements: `Inter` (sans-serif, clean, uniform).
- **Base Surface Color:** `#E7E5E4` (warm stone-gray).
- **Core Accent:** `#006666` (deep teal).
- **Secondary Highlight:** `#F1F2F5` (light cool gray).

## Depth Strategy (Neumorphic Shadows)
- **Extruded (Raised):** `box-shadow: -6px -6px 12px rgba(255, 255, 255, 0.85), 6px 6px 12px rgba(168, 162, 158, 0.45);`
- **Recessed (Inset):** `box-shadow: inset 4px 4px 8px rgba(168, 162, 158, 0.45), inset -4px -4px 8px rgba(255, 255, 255, 0.85);`
- **Extruded Hover:** Translate upward by `-2px` on the Y-axis and increase shadow spread.

## Spacing Base Unit
- Base unit: `4px`.
- Core spacing scale:
  - `space-1` = `4px`
  - `space-2` = `8px`
  - `space-3` = `12px`
  - `space-4` = `16px`
  - `space-6` = `24px`
  - `space-8` = `32px`

## Key Component Patterns
- **Button:** Center-aligned, uppercase tracking-wider text inside a rounded-lg container with a thin contrast boundary border (`1px` border of `rgba(30, 41, 56, 0.1)`). Transitions from Extruded (default) to Recessed (active/pressed).
- **Card:** Rounded-xl container with `padding: space-4` and Extruded shadow. No solid border for default state, translate-Y transition on hover.
- **Badge:** Small tag rounded container with Recessed (inset) shadow, indicating sub-states or metrics.
- **Live Ticker:** Chronological vertical stack of receipt callbacks showing simulated "double-ticks" representing message dispatch status (sent, delivered, opened, clicked, failed).
