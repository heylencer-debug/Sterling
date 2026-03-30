# STERLING LIGHT UI REDESIGN
> Agent: claude-opus-4-5 | Priority: HIGH
> Full visual redesign: Dark → Light, Minimalist, Modern, Premium

---

## Carlo's Direction
Redesign Sterling from dark navy (#0A0E1A) to a **Light UI — Minimalist, Modern, Premium**.
Think: Wealthsimple, Linear, Robinhood light mode. Clean. Airy. Professional.

---

## Design System

### Colors
```
Background page:    #F4F6F9   (soft cool gray)
Background card:    #FFFFFF   (pure white)
Background subtle:  #F8FAFC   (off-white for sections)
Background inset:   #F1F5F9   (slightly darker inset areas)

Text primary:       #0F172A   (near-black, deep navy)
Text secondary:     #475569   (medium gray)
Text muted:         #94A3B8   (light gray)
Text hint:          #CBD5E1   (very light)

Accent gold:        #C9960C   (rich gold, readable on white)
Accent gold light:  #FEF3C7   (gold tint for backgrounds)
Accent gold border: #FDE68A   (gold border)

Border default:     #E2E8F0   (light gray border)
Border subtle:      #F1F5F9   (barely-there border)

Positive:           #059669   (emerald green)
Positive bg:        #ECFDF5
Negative:           #DC2626   (red)
Negative bg:        #FEF2F2

Blue accent:        #2563EB   (for links, BUY signals)
Blue bg:            #EFF6FF

Shadow card:        0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)
Shadow hover:       0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04)
Shadow elevated:    0 8px 24px rgba(0,0,0,0.10)
```

### Typography
```
Font stack: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif
Heading:    700 weight, #0F172A
Body:       400-500 weight, #475569
Small:      11-12px, #64748B
Monospace:  'SF Mono', 'Fira Code', monospace (for prices)
```

### Cards
- White background
- 12px border-radius
- Subtle box-shadow (not thick borders)
- 1px #E2E8F0 border
- 16px padding

### Nav
- White background or #F8FAFC
- Active tab: gold accent underline or filled
- Clean, no gradients

---

## Files to Edit

### 1. `style.css` — FULL REWRITE
Path: `C:\Users\Carl Rebadomia\.openclaw\workspace\knightwatch\docs\style.css`

READ the entire current style.css first (it is 2000+ lines, read in chunks).
Then do a complete visual rewrite — change ALL color values, shadows, backgrounds.
**Preserve every class name exactly** — only change the values, not the selectors.
Add any new classes that are needed.

Key rules:
- Replace ALL `#0A0E1A`, `#0D1320`, `#1E2A3A` → white/light backgrounds
- Replace ALL `#FFD700` → `#C9960C` (gold readable on white)
- Replace ALL dark text colors (`#E2E8F0`, `#CBD5E1`, `#94A3B8` as text) → dark text (`#0F172A`, `#475569`, `#64748B`)
- Replace ALL dark card backgrounds → #FFFFFF with box-shadow
- Replace ALL dark borders (#1E2A3A, #2D3748) → #E2E8F0
- Nav: white background, active gold underline
- Summary bar: white card, shadow
- Holdings grid: white cards
- Trade history table: clean white/stripe
- Badge colors: keep semantic (green=buy, gold=dca, blue=hold, red=sell) but ensure readable on white

### 2. `app.js` — Minor changes only
Path: `C:\Users\Carl Rebadomia\.openclaw\workspace\knightwatch\docs\app.js`

The main chart (DragonFi iframe) uses inline styles. Update these:
- Container border: `#E2E8F0` (was `#1E2A3A`)
- Container background: `#F8FAFC` (was `#0D1320`)
- Label text color: `#C9960C` (was `#FFD700`)
- "DragonFi Live Chart" text: `#64748B` (was `#475569` — same actually)
- `Open full ↗` link: border `#E2E8F0`, color `#64748B`

Also update these inline style strings in the chart section:
- `background:#0D1320` → `background:#F8FAFC`
- `border:1px solid #1E2A3A` → `border:1px solid #E2E8F0`
- `color:#FFD700` (chart label) → `color:#C9960C`

For the "No chart data" fallback state in `toggleCardChart`:
- Button colors update to light theme

### 3. `index.html` — Bump version only
- Change `app.js?v=15` → `app.js?v=16`
- Change `style.css?v=2` → `style.css?v=3` (or whatever current version + 1)

---

## Important Notes

### intelligence-builder may have already pushed changes
Before starting, read the LATEST app.js and style.css from disk:
- `C:\Users\Carl Rebadomia\.openclaw\workspace\knightwatch\docs\style.css`
- `C:\Users\Carl Rebadomia\.openclaw\workspace\knightwatch\docs\app.js`
These are the source of truth — GitHub may be slightly behind.

### Preserve ALL new pillar CSS classes
The intelligence-builder may have added these — keep them, just update colors:
- `.pillar-ai-summary` — change background from dark to `rgba(201,150,12,0.06)` and border-left to `#C9960C`
- `.pillar-meta`, `.pillar-date`, `.pillar-stale`, `.pillar-fresh` — update text colors
- `.pillar-block`, `.pillar-header`, `.pillar-body`, `.pillar-points`, `.pillar-point`, `.pillar-dot`, `.pillar-sources`, `.pillar-src` — update to light theme

### DragonFi iframe filter
Remove the `filter:brightness(0.95) saturate(0.9)` from the iframe (was for dark mode adjustment).

### FAB button (Trade Log)
The floating ⚡ button — update to:
- Background: `#C9960C` (gold on light)
- Or keep dark: `#0F172A` (dark button on light page — premium contrast)
Recommendation: use `#0F172A` background with white text — more premium on light pages.

---

## Complete Color Replacement Map

| Old (dark) | New (light) | Usage |
|---|---|---|
| `#0A0E1A` | `#F4F6F9` | Page background |
| `#0D1320` | `#FFFFFF` | Card background |
| `#111827` | `#F8FAFC` | Subtle background |
| `#1E2A3A` | `#E2E8F0` | Borders |
| `#2D3748` | `#CBD5E1` | Subtle borders |
| `#FFD700` | `#C9960C` | Gold accent |
| `rgba(255,215,0,0.1)` | `rgba(201,150,12,0.08)` | Gold tint bg |
| `rgba(255,215,0,0.2)` | `rgba(201,150,12,0.15)` | Gold tint stronger |
| `#E2E8F0` (as light text) | `#0F172A` | Primary text |
| `#CBD5E1` (as light text) | `#1E293B` | Secondary heading |
| `#94A3B8` (as light text) | `#475569` | Body text |
| `#64748B` (as light text) | `#64748B` | Muted text (same) |
| `#475569` (as light text) | `#94A3B8` | Very muted |
| `#00D4A0` | `#059669` | Positive/buy green |
| `rgba(0,212,160,0.1)` | `rgba(5,150,105,0.08)` | Green tint |
| `#FF4757` | `#DC2626` | Negative/sell red |
| `rgba(255,71,87,0.1)` | `rgba(220,38,38,0.08)` | Red tint |
| `#60A5FA` | `#2563EB` | Blue/hold |
| `rgba(96,165,250,0.1)` | `rgba(37,99,235,0.08)` | Blue tint |

---

## Push Order
```
node push-file.js docs/style.css docs/style.css
node push-file.js docs/app.js docs/app.js
node push-file.js docs/index.html docs/index.html
```

---

## Telegram Notify
```js
const { spawnSync } = require('child_process');
spawnSync(process.execPath, [
  'C:\\Users\\Carl Rebadomia\\AppData\\Roaming\\npm\\node_modules\\openclaw\\openclaw.mjs',
  'message', 'send', '--channel', 'telegram', '--target', '1424637649',
  '--message', '⚔️ Sterling redesigned — Light UI live. Minimalist, modern, premium. Hard refresh to see: Ctrl+Shift+R'
], { stdio: 'inherit' });
```
