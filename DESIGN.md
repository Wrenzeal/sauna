# Design

## Source of truth
- Status: Active
- Last refreshed: 2026-07-13
- Primary product surfaces: entry, lobby, FocusRoom, studio, settings, board meeting
- Evidence reviewed: `docs/PRD_CONTEXT.md`, `docs/CLAUDE_HANDOFF.md`, current Next.js components, user deep interview on 2026-07-13

## Brand
- Personality: warm private club, quiet luxury, thoughtful hospitality
- Trust signals: calm hierarchy, legible content, precise status feedback, restrained materials
- Avoid: mint/teal AI styling, neon gradients, distillation tanks, temperature gauges, particle steam, literal rooms, playful equipment illustrations

## Product goals
- Goals: make users feel welcomed and cared for before consulting a brain trust; keep the advisor team visibly present; make consultation focused and calm
- Non-goals: photorealistic rooms, game-like scenes, backend/API redesign, new animation engines
- Success signals: users understand whom to select, see a question field only after selection, and can navigate/chat without visual noise

## Personas and jobs
- Primary personas: founders, operators, creators and professionals seeking strategic advice
- User jobs: choose an advisor, ask a serious question, follow a streamed response, revisit consultation history, configure a model, distill a new advisor
- Key contexts of use: daytime focused work and nighttime reflective review

## Information architecture
- Primary navigation: top hospitality-style navigation
- Core routes/screens: `/`, `/lobby`, `/focus-room/[sessionId]`, `/studio`, `/settings`, `/board-meeting`
- Content hierarchy: atmosphere -> advisors -> selected-advisor consultation action; secondary history/settings live behind navigation or drawers

## Design principles
- Atmosphere without illustration: communicate sunlight, firelight and comfort through light, material and shadow
- Quiet until touched: ambient motion is slow and subtle; interaction motion is short and decisive
- One primary action per surface
- Content outranks chrome in FocusRoom
- Tradeoff: fewer persistent widgets in exchange for calmer hierarchy

## Visual language
- Color: cream, ivory, walnut, espresso and amber; night uses charcoal, dark walnut, warm ivory and ember light
- Typography: serif display/identity headings, sans-serif operational UI and body text, tabular numerals for data
- Spacing/layout rhythm: generous 24/32/48px section rhythm, max content width 1440px
- Shape/radius/elevation: soft outer radii, tighter controls, walnut-tinted shadows, thin warm borders
- Motion: 16–24s ambient light; 160–220ms micro feedback; 280–380ms component reveals; 360–480ms directional page transitions; 650–850ms entry light-curtain; reduced-motion fallback required
- Route language: top-level workspace routes slide according to navigation order; FocusRoom enters as a deeper space from below; navigation chrome remains stable
- Interaction language: material light, border and shadow respond once to selection; avoid looping float, bounce, sparkle and flash effects
- Imagery/iconography: Phosphor line icons and restrained emoji/identity marks; no equipment illustrations

## Components
- Existing components to reuse: store/API logic, Markdown renderer, plan cards, theme persistence
- New/changed components: top navigation, ambient scene, advisor workstation, consultation tray, session drawer, auth dialog
- Variants and states: day/night, selected/unselected, idle/thinking/consulting/offline, loading/error/empty
- Token/component ownership: semantic `--sauna-*` variables in `apps/web/src/app/globals.css`

## Accessibility
- Target standard: WCAG AA for primary text/actions
- Keyboard/focus behavior: visible warm focus rings; drawers/dialogs close with Escape; controls have labels
- Contrast/readability: no low-opacity text for essential information
- Screen-reader semantics: navigation, dialogs, status and buttons keep semantic labels
- Reduced motion and sensory considerations: remove ambient loops and simplify transitions

## Responsive behavior
- Supported breakpoints/devices: mobile, tablet, desktop
- Layout adaptations: workstation 1/2/3 columns; top navigation becomes compact menu-like horizontal controls on mobile; drawers become full-width sheets
- Touch/hover differences: minimum 44px touch targets; no hover-only actions

## Interaction states
- Loading: quiet inline status, no aggressive spinners
- Empty: one useful next action
- Error: internal warm error surface with recovery action
- Success: short confirmation, no celebratory animation
- Disabled: reduced contrast plus explanatory copy where needed
- Offline/slow network: preserve drafts and show actionable retry feedback

## Content voice
- Tone: warm, concise, confident, lightly playful only in empty consultation prompts
- Terminology: 智囊大厅, 蒸馏车间, VIP 桑拿房, 董事会桑拿
- Microcopy rules: no “AI-ready” jargon; one sentence per helper block when possible

## Implementation constraints
- Framework/styling system: Next.js 16, React 19, Tailwind v4, Motion, Zustand
- Design-token constraints: components use semantic CSS variables; no hardcoded competing palettes
- Performance constraints: no Three.js, Canvas, video backgrounds or particle engines
- Compatibility constraints: preserve routes, API contracts, SSE, Markdown, plan parsing and session operations
- Test/screenshot expectations: typecheck, lint, build, day/night and responsive manual review

## Open questions
- None blocking implementation. Fine-grained visual calibration may follow browser review.
