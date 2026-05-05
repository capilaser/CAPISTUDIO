# 🎨 Prompt para Google Stitch — Capi Studio v2

> **Como usar:** acesse stitch.withgoogle.com, crie um novo projeto e cole este prompt na primeira interação. Anexe junto a imagem `broches-studio_5.html` aberta como referência visual e o fluxograma se possível.

---

## CONTEXT

I'm designing **Capi Studio v2**, a Windows desktop application for laser engraving and laser cutting professionals who produce personalized products (corporate gifts, custom badges, engraved plates).

This is a **production tool**, not a creative design app. Think of it as the **Ableton Live or Logic Pro of laser engraving** — dense, technical, refined, made for daily heavy use by a single operator.

---

## DESIGN DIRECTION (non-negotiable)

**Aesthetic:** industrial-utilitarian but refined. The vibe is "professional DAW meets laser CAM software." Reference the **density and precision** of Lightburn, RDWorks, or Ableton Live — never the playfulness of Canva or Figma.

**Strict rules:**

- ❌ NO purple gradients on white backgrounds
- ❌ NO glassmorphism
- ❌ NO Inter, Roboto, or system-ui as primary font
- ❌ NO cute illustrations or emojis as UI elements
- ❌ NO timid, evenly-distributed pastel palettes
- ❌ NO oversized whitespace pretending to be "minimalist"

**Embrace:**

- ✅ High information density, expertly organized
- ✅ Functional color (operations have semantic colors — red = engraving, blue = laser cut)
- ✅ Monospaced fonts for numerical/dimensional values (mm precision)
- ✅ Sharp 1px borders, thin focus rings, restrained shadows
- ✅ Dark theme by default
- ✅ Subtle micro-interactions (no bounces, no celebrations)

---

## COLOR PALETTE

```
/* Surfaces (dark theme — primary) */
--ink-950: #0e0f10  /* canvas backdrop */
--ink-900: #16181a  /* app background */
--ink-800: #1f2123  /* panels */
--ink-700: #2a2c2e  /* borders */
--ink-600: #3a3d40  /* dividers */
--ink-500: #5a5d61  /* muted text */
--ink-400: #8a8e92  /* placeholder */
--ink-300: #b4b8bc  /* secondary text */
--ink-200: #d4d7da  /* primary text */
--ink-100: #ebeef0  /* high emphasis */

/* Accent — laser red (signature color) */
--laser: #dc2626
--laser-hover: #b91c1c
--laser-muted: #fca5a5

/* Operation colors (used in layer chips, machine routing) */
--op-contorno: #000000      /* outline */
--op-corte: #000000         /* cut */
--op-corte-laser: #2563eb   /* laser cut */
--op-gravacao: #dc2626      /* engraving */
--op-marcacao: #2563eb      /* marking */
--op-aplique: #7c3aed       /* applique */
--op-gravacao-aplique: #d97706 /* engraving on applique */

/* Feedback */
--ok: #15803d
--warn: #d4aa3a
--danger: #dc2626
```

---

## TYPOGRAPHY

- **Display (titles, headers):** JetBrains Mono — technical, distinctive
- **Body (UI text):** Geist (Vercel's open-source font) — modern, refined
- **Numerical (mm values, coordinates):** JetBrains Mono with `tabular-nums`

Always show units inline: `8.0 mm`, `60 × 25 mm`, `300 dpi`.

---

## SCREENS TO DESIGN (in order of priority)

### 1. CANVAS EDITOR (the heart of the system — design this first)

**Layout — three-column technical workspace:**

```
┌─────────────────────────────────────────────────────────────────────────┐
│ [TOPBAR: 48px]  CapiStudio · Padrão: Broche Profissão · [Save] [Export]│
├──────────┬──────────────────────────────────────────────┬──────────────┤
│          │                                              │              │
│ TOOLBAR  │                                              │  PROPERTIES  │
│ 56px     │            CANVAS AREA                       │   PANEL      │
│ vertical │                                              │   280px      │
│          │   - Rulers in mm (top + left edges)          │              │
│ Tools:   │   - Dark grid background                     │  Tabs:       │
│  Select  │   - Centered artwork preview (real-time)     │  - Object    │
│  Pan     │   - Smart guide lines while dragging         │  - Layers    │
│  Slot    │   - Distance indicators in mm                │  - Align     │
│  Text    │                                              │  - Tags      │
│  Image   │   Bottom bar: zoom controls,                 │              │
│  Texture │   coordinates, mm/px ratio                   │              │
│  Align   │                                              │              │
│          │                                              │              │
├──────────┴──────────────────────────────────────────────┴──────────────┤
│ STATUS BAR (24px): X: 12.3 mm  Y: 8.1 mm  W: 30.0 mm  H: 4.0 mm  · ⚡ │
└────────────────────────────────────────────────────────────────────────┘
```

**Canvas details:**

- Backdrop is `--ink-950` with a very subtle 5mm grid in `--ink-800`.
- Rulers in mm with major ticks every 10mm and minor ticks every 1mm.
- The product (broche shape) is rendered at center with a subtle drop shadow.
- Texture is applied in real-time as the operator changes selection.
- Selected objects show 4 corner handles (squares) + 4 edge handles (smaller). Handles are `--laser` colored with `--ink-950` border.
- Smart guide lines appear in `--laser-muted` while dragging.
- Distance indicators show like `12.3 mm` in monospaced font with a thin connecting line.

**Properties Panel — when an object is selected:**

- Numeric inputs for X, Y, W, H in mm with up/down spinners
- Lock aspect ratio toggle (chain icon)
- Rotation input (degrees)
- For text slots: font family dropdown, size, alignment
- For layers: kind toggle (Visual / Production), if production → operation dropdown + machines multi-select chips
- All numeric inputs use `tabular-nums` and accept decimal precision (0.1mm)

**Layer Panel (Photoshop-style):**

- Each layer row: visibility toggle (eye icon), lock (padlock), name, machine chip(s), operation chip
- Drag handles on the left for reordering
- Layers can be nested (groups). Indentation on nested children.
- Active layer has a `--laser` left border (3px) and `--ink-700` background.

**Top bar:**

- Logo "CapiStudio" with the `s` styled as a laser dot/red marker
- Breadcrumb: home › patterns › current pattern name
- Mode toggle pill: `[ Operator | Designer ]` (Designer mode unlocks advanced tools)
- Right side: `Save` (primary, `--laser`), `Export ▾` (dropdown: PNG mockup, SVG cut by machine)

**Toolbar (left vertical strip):**

- Square buttons 40×40px with 20px lucide icons
- Active tool: `--ink-700` background + `--laser` accent bar on the left
- Tooltip on hover with name + keyboard shortcut

---

### 2. HOME SCREEN

**Layout:** Centered 1200px column on `--ink-900` background.

**Hero block (top):**

- Big monospace title "CAPI STUDIO" with "v2" superscript
- Below: thin tagline "Production system for laser engraving and cutting"
- Right of title: small status indicators (database OK, fonts loaded: 12, etc.) — like a developer dashboard

**4 main action cards (2×2 grid):**

- Each card: 280×180px, `--ink-800` background, `--ink-700` border, hover lifts to `--ink-700` background
- Icon (Lucide) at top-left, 32×32px
- Title in JetBrains Mono, 18px
- Subtitle in Geist, 14px, `--ink-400`
- Arrow icon bottom-right that animates on hover

Cards content:

1. **NEW PATTERN** · `Create a reusable template`
2. **OPEN PATTERN** · `Browse 7 validated scenarios` (with count)
3. **ART HISTORY** · `47 artworks · 3 pending` (live counts)
4. **ASSET BANK** · `Logos · Fonts · Textures · SVGs`

**Below cards — recent activity strip:**

- "Last edited" — horizontal scroll of 5 thumbnail cards
- Each thumbnail 160×120px with PNG preview, label, date
- Click reopens directly in canvas

**Footer thin bar:**

- Version, last backup, database size (like a Linux status line)

---

### 3. PATTERN GRID

**Layout:** sidebar (filters) + main grid.

**Sidebar 240px:**

- Filter sections: Product, Wave, Tags, Favorites
- Each filter is a collapsible group with checkboxes
- Footer: "Reset filters" link

**Main area:**

- Top bar: search input (with `Cmd/Ctrl+K` hint), sort dropdown (Recent, Most used, Alphabetical), view toggle (grid/list)
- Grid of pattern cards: 240×280px
  - Top: 240×180px PNG preview of the pattern (texture applied)
  - Below: pattern name in mono, product badge, last edited date
  - Hover: subtle lift, "Open in canvas" CTA fades in
  - Right corner: star icon for favorite (filled = `--warn` color)
- Cards in `--ink-800` with `--ink-700` border

---

### 4. ART HISTORY

Same layout as Pattern Grid but with these differences:

- Cards show generated artwork PNG (with applied texture and customer data)
- Each card has a Pending/Approved toggle pill at the bottom
  - Pending: `--ink-700` bg, `--ink-300` text
  - Approved: `--ok` bg with check icon
- Filter sidebar adds: Status (All/Pending/Approved), Date range, Pattern source

**Card detail modal (when clicked):**

- Large PNG preview on left (60% width)
- Right column (40%) with:
  - Customer label (large mono)
  - Metadata grid (date, pattern, machines used, fields)
  - Action buttons stacked: `Download PNG`, `Download SVG (Master Biro)`, `Download SVG (Fiber Laser)`, `Reopen in canvas`, `Duplicate`, `Delete` (last one in `--danger`)

---

### 5. ASSET BANK

**Layout:** top tab bar + content area.

**Tab bar:**

- 6 tabs: SVG Bases · Patterns · Fonts · Logos · Textures · Categories
- Active tab: `--laser` underline (2px), text in `--ink-100`
- Inactive: `--ink-400` text

**Content area per tab:**

- Top: search + "+ Add new" button (primary, `--laser`)
- Grid or table view depending on asset type
- Each asset card has: thumbnail, name, metadata (size, format, last used), actions menu (3 dots)

Specific tabs:

- **Fonts:** preview "The quick brown fox jumps over the lazy dog" + Portuguese variation
- **Logos:** thumbnail grid with customer name, format badge (SVG/PNG)
- **Textures:** grouped by family (Acrylic Glossy, Wood, etc.) with color swatches
- **Categories:** simple table (name, scope, color chip, count of items)

---

### 6. LOGIN / SETUP

Minimal centered card on dark background.

**Login:**

- 400px wide card
- Logo at top
- Single password input (with show/hide toggle)
- "Sign in" button (primary, `--laser`)
- Subtle "Forgot password? Use recovery seed" link

**First-time setup:**

- Welcome message + setup explanation
- Set password input + confirm
- Show generated recovery seed in a copyable monospace block with warning icon
- "I've saved the seed" checkbox required to proceed

---

## INTERACTION PATTERNS

- **Cmd/Ctrl+K** opens command palette (like Linear, Raycast) — fuzzy search across patterns, orders, actions
- All numeric inputs accept `+`/`-` keys to nudge by 0.1mm
- Drag-and-drop file uploads for SVG/PNG/font files (entire window becomes drop target with overlay)
- Right-click context menus everywhere (canvas, layers, asset cards)
- Keyboard shortcut hints (`⌘S`) shown next to button labels in tooltips
- Toasts (Sonner-style) for non-blocking feedback — bottom-right corner, max 3 stacked

---

## DELIVERABLES REQUESTED

Please generate, in this order:

1. **Canvas Editor screen** — full layout with toolbar, canvas area, properties panel, layer panel, all populated with realistic content (a broche pattern in mid-edit)
2. **Home screen** — with the 4 cards and recent activity strip
3. **Pattern Grid** — with filter sidebar and 6+ pattern cards
4. **Art History** — with cards showing varying statuses
5. **Asset Bank** — design at least 3 of the 6 tabs (Patterns, Fonts, Textures)
6. **Login/Setup** screen

For each screen:

- Provide the full visual design
- Annotate any complex interactions
- Use realistic Portuguese-Brazilian content (this is for a Brazilian laser engraving business): customer names like "João Silva", professions like "Advogado", "Médica Veterinária", product names like "Broche 60×25mm".

Make this a tool I'd be proud to use 8 hours a day. Make it feel like a professional instrument, not a toy.
