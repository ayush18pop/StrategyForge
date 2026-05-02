# 🧠 StrategyForge — Frontend Design Specification  

**“Neural Command Center × Forge Unchained”**  

A living, breathing interface for an autonomous DeFi agent that learns.  
This document defines the visual, interactive, and emotional experience of StrategyForge.

---

## 1. Design Philosophy

StrategyForge is not a dashboard. It is a window into a machine that forges financial strategies, learns from its own failures, and proves its intelligence on-chain.  
The interface must feel **dangerous, precise, and alive** — part cybernetic forge, part derelict intelligence foundry.

**Core principles:**

- **Verifiable Truth** — Every attestation, hash, and on-chain record glows with authenticity.
- **Visible Thought** — The agent’s reasoning is never hidden; it streams, burns, and scars the screen.
- **Industrial Brutalism** — Asymmetric layouts, raw typography, thick scanlines, and molten data pools.
- **Learning as Spectacle** — Failures crack the UI; improvements forge new light.

---

## 2. Color Palette

| Role | Color | Usage |
|------|-------|-------|
| **Void Black** | `#020205` | Main background, base of all surfaces |
| **Panel Steel** | `#121418` | Cards, modals, sidebar |
| **Deep Graphite** | `#1A1F26` | Borders, subtle separators |
| **Neon Cyan** | `#00F0FF` | Primary actions, active pipeline, success glow, gradients |
| **Hot Red** | `#FF3D71` | Suboptimal flags, errors, failed steps, deprecated |
| **Acid Green** | `#39FF14` | Deployment success, on-chain confirmation, learning applied |
| **Molten Amber** | `#F5A623` | Draft status, pending actions, warnings |
| **Text Primary** | `#E8EDF2` | Main content |
| **Text Secondary** | `#8E9AAB` | Metadata, timestamps |
| **Muted Metal** | `#3A4654` | Disabled or irrelevant elements |
| **Gradient Accent** | `linear-gradient(135deg, #00F0FF 0%, #6C5CE7 100%)` | Hero elements, key transitions |

---

## 3. Typography — “Scattered Blueprints”

We use a deliberate clash of typefaces to create tension between human readability and machine obsolescence.

### 3.1 Primary Typeface: **Commit Mono**

*(Jagged industrial monospace, teletype soul)*  

- **Headings:** `Commit Mono`, Ultra Wide (variable weight). `letter-spacing: 0.15em`, uppercase.  
- **Body:** `Commit Mono`, regular weight. Uneven line height: `1.2` on even lines, `1.8` on odd (achieved via JavaScript or a custom CSS `::nth-line` workaround with background gradients).  
- **Numbers & Data:** Monospace, `text-shadow: 0 0 4px currentColor` for phosphor burn.

### 3.2 Counter-Font: **Bagnard Sans** *(optional)*

A brutal serif for massive, stamped-metal pull-quotes. Used only for `evidenceOfLearning` quotes, rotated -2°, heavy drop shadow.

### 3.3 Glitch Font: **Fragment Mono (damaged subset)**

Custom `@font-face` where random glyphs are vertically offset by 1-2px. Used for:

- Attestation hashes
- The word `DEPRECATED`
- On-chain transaction IDs

### 3.4 Typographic Treatments

- **Melting Hierarchy:** Strategy titles are `clamp(3rem, 12vw, 8rem)`, clipped inside containers with a fading red glow at the bottom.
- **Asymmetric Underlines:** Links have jagged SVG underlines that twitch on hover.
- **Hidden Machine Mantras:** Tiny text (`font-size:4px`, opacity 0.3) in backgrounds repeating `observeresearchstrategizecriticizecompileexecute...` as a texture.
- **Lateral Data Tickers:** Addresses scroll in a horizontal marquee when hovered, `8px` size.
- **Tactile Evidence Block:** `evidenceOfLearning` displayed on a crumpled-paper texture, printed in dual layers (red stamp + crisp white offset by 2px).
- **Glitch on Error:** Suboptimal strategy titles flash between three font variants for 1 second.

---

## 4. Visual Language & Textures

Everything should feel heavy, metallic, and slightly damaged.

- **Card Glassmorphism:** `backdrop-filter: blur(12px)`, `background: rgba(18,20,24,0.6)`, border `1px solid rgba(0,240,255,0.1)`.
- **Blueprint Grid:** Background features a faint cyan grid (`opacity 0.03`) with slow parallax drift.
- **Scanlines:** Chunky 4px solid black / 4px transparent horizontal bars, waving vertically.
- **Data Glow:** Key metrics have soft `text-shadow` in their semantic color.
- **Divider Lines:** Dotted, glowing cyan lines like scanning beams.
- **Inverted Contrast Hover:** When hovering on version cards, the background briefly solarizes (inverts) for 200ms before settling.

---

## 5. Background Environment — “The Anvil Reactor”

The background is not static; it reacts and behaves like a living foundry.

### 5.1 Layer 1: Deep Void Core

- Base color `#020205`
- Radial gradient from center (subtle cyan/red depending on strategy status)
- CSS animated noise overlay (SVG turbulence + displacement) simulating analog film grain.

### 5.2 Layer 2: The Forge Anvil

- Centered monumental wireframe (hammer + anvil) built with thin cyan lines (`opacity 0.15`)
- Slow 3D isometric rotation (static on mobile)
- Persistent pulsing glow at hammer impact point (radial gradient scaling 0.8→1.2)

### 5.3 Layer 3: Data Spaghetti

- Hundreds of thin dim lines (`#2A3B4C`, opacity 0.4) connecting random points like a neural net.
- When deploying, a wave of cyan light propagates outward.

### 5.4 Layer 4: Spilled Molten Pools

- Amorphous, blurred blobs in corners (cyan for success, red/orange for suboptimal)
- Slow Brownian motion animation (`filter: blur(40px)`, `transform: translate()` keyframes)

### 5.5 Layer 5: Terminal Ghosting

- Every 15-30 seconds, a faint fragmented terminal log (mostly redacted) drifts diagonally.
- Screen burn-in effect: a ghost in the machine.

### 5.6 Interaction-Driven Shifts

- Mousemove parallax on forge and data threads (factor 0.02)
- Scroll depth changes background gradient: draft (amber) → live (cyan) → deprecated (red)
- Click sparks: CSS particle burst from cursor position

---

## 6. Core Component Styling

### 6.1 StrategyCard (Dashboard)

- Blueprint tile with `active pulse` dot for live strategies.
- Version badge: rounded pill, color-coded.
- Hover lifts card, intensifies border, scanline sweeps top-to-bottom.
- Deprecated cards have a red diagonal watermark `DEPRECATED` in damaged font.

### 6.2 PipelineRunner

- Three vertical nodes (search, brain, shield) connected by animated dotted lines.
- Nodes fill with `#00F0FF` as completed, pulsing glow when running.
- Below nodes: terminal-like modal streams LLM output with typewriter effect.
- Attestation ID displayed as a digital fingerprint.

### 6.3 EvidenceBundle

- Three dossier tabs: Researcher (amber), Strategist (cyan), Critic (purple).
- Each tab’s content has a paper-like edge and slight shadow.
- `evidenceOfLearning` is wrapped in a special “insight box” with glowing green left-border and a large quote mark.

### 6.4 VersionDiff

- Split-screen with v1 (red undertones) and v2 (green undertones).
- Central bridge shows an arrow “learned from execution #N” with particle flow.
- Suboptimal reason displayed in a “cracked container” graphic.

### 6.5 WorkflowJSON Viewer

- Custom code block with syntax highlighting (cyan keys, green strings, amber numbers).
- Dark IDE background, line numbers.
- Deploy button styled as a heavy industrial switch.

### 6.6 Unconventional Layout Touches

- No padding on evidence bundle: content bleeds edge-to-edge.
- Vertical `familyId` string ran along the left edge (`writing-mode: vertical-lr`, 10px, red).
- Fatal errors trigger viewport shake and full-screen inversion for 2 seconds.

---

## 7. Layout & Grid

- **Overall:** Command‑center dashboard, dark‑only, heavy contrast.
- **Sidebar:** 40px collapsed, 240px expanded. Icons only, expand on hover. Houses navigation: Dashboard, Forge, Strategies, Chain.
- **Main Content:** 12‑column grid, 24px gutter.
- **Top Bar:** Breadcrumb trail and a pulsing agent status indicator (green=operational, amber=learning, red=error).
- **Mobile:** Sidebar becomes bottom tab bar with same icons.

---

## 8. Animations & Micro-interactions

- **Page Transitions:** Digital wipe or “forge doors opening” (metallic shutter).
- **Loading:** Neural mesh resolving into content.
- **Deploy Sequence:** Rapid progress bar with scrolling hex data, then a confirmation burst and transaction hash.
- **Version Upgrade:** Old version shatters into particles, reforms as new one.
- **Hover Tooltips:** Glass‑effect slide‑outs with full detail.
- **`prefers-reduced-motion`:** All animations replaced with static, high‑contrast fallback.

---

## 9. Implementation Notes (Hackathon Scope)

- **Base UI:** shadcn/ui, theme aggressively overridden.
- **Animations:** Framer Motion for complex visuals (pipeline, version diff particle link).
- **Backgrounds:** CSS for noise, SVG filters, background patterns. Optional Three.js for the forge anvil if time allows.
- **Fonts:** Load Commit Mono from Google Fonts; create damaged Fragment Mono subset with `pyftsubset` or a simple CSS offset hack.
- **Readability first:** The experimental treatments are ambient; primary text remains crisp and WCAG AA compliant.

---

*This spec transforms StrategyForge from a tool into an experience. The agent’s learning is not just shown — it is felt in every glitch, every pulse, every brutal letter pressed into the screen.*
