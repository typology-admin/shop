# Typology Network — Design System

Living reference for the public shop (landing board) and admin UI. Source of truth for tokens lives in `src/styles/global.css` (`:root`) and chrome/network styles in `src/styles/network.css`. Prefer these decisions over inventing new looks.

---

## Brand feel

Warm, quiet, material. The board is a linen-grey stage; UI floats on frosted paper. Lowercase labels. Pills everywhere. No purple gradients, no glow stacks, no dashboard chrome. Brand name is a first-class signal on empty/loading states (`typology network`), not a tiny nav eyebrow.

---

## Color

| Token | Hex | Role |
| --- | --- | --- |
| `--board` | `#c5c1b6` | Page / canvas ground |
| `--board-deep` | `#b9b4a8` | Slightly deeper board tone |
| `--paper` | `#efece3` | Surfaces, filled buttons text, frosted panels |
| `--paper-2` | `#e4e0d5` | Nested surface / hover fills |
| `--ink` | `#1c1b18` | Primary text, filled buttons, focus |
| `--ink-muted` | `#5c594f` | Secondary text, hints, idle icons |
| `--line` | `#1c1b18` | Hairline rules (often at full ink) |
| `--danger` | `#8f2d16` | Destructive actions / errors |
| `--focus` | `#1c1b18` | Focus-visible ring |

### Transparent recipes (use these, don’t invent new ones)

| Use | Fill | Border | Blur |
| --- | --- | --- | --- |
| Chrome pill / search | `rgba(255,255,255,0.22)` | `rgba(28,27,24,0.16)` | `blur(18px) saturate(1.45)` |
| Chrome pill hover / open | `rgba(255,255,255,0.46)` | `rgba(28,27,24,0.28)` | same |
| Admin bar | `rgba(239,236,227,0.92)` | none | `blur(10px)` |
| Admin tools rail | `rgba(239,236,227,0.55)` | transparent | `blur(28px) saturate(1.2)` |
| Admin panel body | `rgba(239,236,227,0.72)` | transparent | `blur(40px) saturate(1.25)` |
| Footer overlay | `rgba(197,193,182,0.78)` | — | `blur(18px) saturate(1.2)` |
| Ghost hover | `rgba(28,27,24,0.06–0.08)` | — | — |

Well / gravity accent colors (admin canvas only): `#c8553d`, `#3d7ea6`, `#5b8c5a`, `#b08d2f`, `#7a5aa6`.

---

## Typography

| Token | Stack |
| --- | --- |
| `--font-ui` | SF Pro Text / Display → system UI sans → Helvetica Neue |
| `--font-display` | Iowan Old Style → Palatino → Georgia |

### Usage

- **UI everywhere (admin + chrome):** `--font-ui`, 13–15px, weight 500, often `letter-spacing: 0.02em`, **lowercase** on buttons and pills.
- **Brand wordmark (empty / loading / auth):** prefer `.wordmark-ui` on the board (UI sans, tight tracking, lowercase). Display serif (`.wordmark`) reserved for moments that need editorial weight.
- **Field labels:** 11px, uppercase, `letter-spacing: 0.12em`, `--ink-muted`.
- **Hints / meta:** 12px, `--ink-muted`.
- **Panel titles:** 18px, weight 600, `letter-spacing: -0.02em`.
- **Admin brand link:** 15px, weight 500, `letter-spacing: -0.04em`, lowercase.

Body default: 14px / 1.4 on `--font-ui`.

---

## Shape & layout

- **Pill radius:** `border-radius: 999px` for buttons, tabs, chrome controls, rail, icon hit targets.
- **Panel card radius:** `20px` (admin panel body).
- **Dropzone radius:** `16px`, dashed `1px` ink border.
- **Admin bar height:** `--bar-h: 48px`.
- **Admin panel content width:** `--panel-w: 280px`.
- **Tools rail width:** `--panel-rail-w: 48px`.
- **Floating admin tools:** rail + one open panel; `pointer-events: none` on the shell, `auto` on children so the board stays clickable around them.
- **No full-height opaque sidebars** for tools — floating frosted pill + card.
- **No outline on frosted admin chrome** (transparent borders); filled `.btn` and chrome pills keep soft ink borders.

---

## Buttons & controls

### Primary `.btn`
- Filled `--ink`, text `--paper`, pill, height 36px, lowercase.
- Hover → near-black `#000`.

### Ghost `.btn-ghost`
- Transparent fill, ink text, ink border (or transparent on frosted surfaces).
- Hover → light ink wash.

### Danger `.btn-danger`
- Transparent + `--danger` text/border; hover fills danger with paper text.

### Chrome pills (public + section hooks)
- Frosted white recipe above; min-width ~6.5rem; height 36px (hooks 30px).
- Lowercase labels: shop, network, about, scene names.

### Admin tabs
- Inactive: frosted light fill + soft border.
- Active: filled ink / paper text (same as primary button).

### Forms (admin panel)
- Underline inputs: transparent bg, bottom border only (`var(--line)`), no box radius.
- Auth / landing overlays may use pill frosted inputs instead.
- Range sliders: full width, `accent-color: var(--ink)`.

---

## Effects

1. **Frosted glass** — primary UI material over the board (`backdrop-filter` + translucent paper/white). Prefer stronger blur on reading surfaces (panel ≈ 40px) than on chrome pills (≈ 18px).
2. **Soft board wash** — `.board-scroll` top gradient: `linear-gradient(180deg, rgba(255,255,255,0.08), transparent 180px)`.
3. **Blur behind modals** — `html.item-modal-open` / `chrome-overlay-open` blur the board (~28–40px); don’t stack extra shadows.
4. **Loading mark** — 36×2px ink bar with gentle scale/opacity pulse.
5. **Avoid:** multi-layer drop shadows, neon glow, purple gradients, heavy cards for non-interactive blocks.

---

## Public landing (shop board)

- **Hero is the board itself** — knolled product photos on `--board`, not a marketing card layout.
- Landing jumps to a random scene (section hook); section rail on the right reveals scene pills on scroll.
- Site chrome: frosted pills (search, about, nav) — not a dense header bar.
- Footer: quiet lowercase links on board color; mobile may use a frosted sheet overlay.
- Empty / loading: centered wordmark + short lede; brand first.

---

## Admin shop board

- **Top bar:** frosted paper, **no bottom outline**, brand + pill tabs + actions.
- **Tools:** icon rail (add / sections / view) as a vertical pill; one section open at a time; click again to collapse.
- **Panel body:** frosted rounded card; readable over the canvas.
- **Scenes:** one gravity well per section at canvas horizontal center (`CANVAS_WIDTH / 2`) and section `y`; equal vertical rhythm (`SCENE_START_Y` + `n * SCENE_SPACING`, default 900 / 1400).
- **Item inspector:** “Attracted to” chooses the gravity section; rearrange / pack tightness live under View.

---

## Motion

- Intentional and few: section-hook fade, loading pulse, gravity settle on the board.
- Prefer short fades (0.12–0.22s) over bounce or springy UI.

---

## Copy tone

- Lowercase UI labels (`add item`, `hide tools`, `space evenly`).
- Short hints under controls; no marketing fluff in admin.
- Destructive confirmations stay plain and specific.

---

## Do / don’t

**Do**
- Reuse CSS variables and existing classes (`.btn`, `.chrome-pill`, `.field`, frosted recipes).
- Keep one open admin tool panel; collapse to the rail.
- Keep outlines off frosted admin shells unless a control needs a border for affordance.

**Don’t**
- Introduce Inter / Roboto / purple themes / cream+terracotta editorial clichés called out in project rules.
- Add card grids or hero overlays on the public board.
- Make tools a full-bleed opaque drawer again.
- Add heavy shadows or glowing focus rings — focus is a simple ink outline.

---

## File map

| Area | Files |
| --- | --- |
| Tokens + base UI | `src/styles/global.css` |
| Public chrome / pills / tabs | `src/styles/network.css` |
| Admin board shell | `src/pages/AdminBoard.tsx`, `src/components/AdminToolsRail.tsx` |
| Public board | `src/pages/PublicBoard.tsx`, `src/components/SiteChrome.tsx` |
| Scene rhythm | `src/lib/sections.ts` (`SCENE_START_Y`, `SCENE_SPACING`) |
