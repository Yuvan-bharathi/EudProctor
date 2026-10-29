---
name: eduproctor-design-system
description: Light "Soft Mist" design system for EduProctor — colour tokens, typography, spacing and component patterns (flag counter, glance chips, topic chips, AI summary cards, tables, states). Use whenever building or changing any React page, component, chart or style in apps/web.
---

# EduProctor design system

Light theme, subtle colours, soft tones. Follow these rules for every UI change.

## Setup (once, in Phase 0)
1. Copy `tokens.css` into `apps/web/src/styles/tokens.css` and import it first in `main.tsx`.
2. Map tokens to Tailwind and shadcn/ui as shown at the bottom of `tokens.css`.
3. Add Inter via `@fontsource-variable/inter` (fallback `system-ui`).

## Rules
- Never write raw hex in components; use Tailwind classes backed by tokens (`bg-surface`, `text-muted`, `bg-primary`, `bg-danger-50 text-danger-700`, …).
- Page = `bg-bg`; content in white cards: `rounded-xl border border-border bg-surface p-5`. Shadows at most `shadow-sm`.
- One primary button per view. Secondary = white with border. Destructive actions use `danger-600` only in confirm dialogs.
- Status is always colour **plus** text or icon (never colour alone).
- Spacing scale 4/8/12/16/24/32. Section gap 24 px. Card padding 20–24 px.
- Radius: inputs/buttons 10 px, cards 14 px, chips full.
- Focus ring: 2 px `--primary-500` with 2 px offset, always visible on keyboard focus.
- Motion: 150–200 ms ease-out fades only. No shaking, pulsing or flashing — especially on proctoring UI.
- Icons: lucide-react, 16–20 px, `text-muted` unless they carry status.
- Charts (Recharts): strong `--success-500`, developing `--warning-500`, weak `--danger-500`, neutral series `--primary-500`, gridlines `--border`, axis text `--text-muted` 12 px.
- Every data view has loading (skeleton in `surface-muted`), empty (icon + one sentence + action) and error (`danger-50` panel + retry) states.

## Component patterns
See `components.md` for exact class recipes: AppShell, FlagCounter, FlagNotice, GlanceChip, SeverityBadge,
TopicChip, AiDraftCard, SummaryReviewPanel, CandidateTimelineTable, StatCard.

## Checklist before finishing UI work
- [ ] No raw hex, no new colours outside tokens.css.
- [ ] Contrast OK (use only the text/background pairs listed in tokens.css).
- [ ] Keyboard reachable, visible focus, labels on all inputs.
- [ ] Loading, empty and error states present.
- [ ] Candidate screens show no glance/integrity data.
