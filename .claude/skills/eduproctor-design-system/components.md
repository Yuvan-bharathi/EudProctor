# Component recipes

## AppShell
- Left sidebar 240 px, `bg-surface border-r border-border`; active nav item `bg-primary-50 text-primary-700 rounded-lg`.
- Top bar 56 px, white, page title 20 px/600, role badge on the right.
- Content max-width 1200 px, padding 24–32 px, `bg-bg`.

## FlagCounter (candidate assessment page, top bar)
- Three small dots + text "Flags 1 of 3". Empty dot `border border-border-strong`; filled dot `bg-danger-500`.
- Container `rounded-full bg-surface-muted px-3 py-1 text-xs text-muted`; when ≥1 flag, text `text-danger-700`.
- Always visible but small; never blocks questions.

## FlagNotice (candidate, appears on new red flag)
- Toast at top-centre: `rounded-xl bg-danger-50 text-danger-700 border border-danger-500/30 px-4 py-3`, icon `Eye`.
- Text: "Flag {n} of 3 – please keep your eyes on the screen." Auto-hide after 5 s, `role="status"` (polite).
- No sound, no shake, no modal. After flag 3, no further notices.

## GlanceChip (mentor only)
`inline-flex items-center gap-1 rounded-full bg-info-50 text-info-700 px-2 py-0.5 text-xs` + icon (`ScanEye` for eyes, `MoveHorizontal` for head) + duration "1.4 s".

## RedFlagChip (mentor)
`rounded-full bg-danger-50 text-danger-700 px-2 py-0.5 text-xs font-medium` "Red flag 2 of 3". Post-limit: same with text "After limit".

## SeverityBadge
High `bg-danger-50 text-danger-700` · Medium `bg-warning-50 text-warning-800` · Low `bg-info-50 text-info-700`.

## TopicChip
Strong `bg-success-50 text-success-700` · Developing `bg-warning-50 text-warning-800` · Weak `bg-danger-50 text-danger-700` · Insufficient data `bg-surface-muted text-muted`. Always include the score: "Thermodynamics · 54%".

## AiDraftCard (anything written by an agent)
- Card with `bg-ai-50 border border-ai-100 rounded-xl`, header badge "AI draft" (`bg-ai-100 text-ai-700`, icon `Sparkles`).
- After mentor approval the card becomes a normal white card with badge "Approved by {mentor}" (`bg-success-50 text-success-700`).

## SummaryReviewPanel (mentor)
Two columns: left = candidate results (score, topic chart, wrong answers); right = AiDraftCard with editable recommended topics, notes picker (approved library only), message text. Footer actions: "Request changes" (secondary), "Approve" (primary). "Publish to candidate" enabled only after approve.

## CandidateTimelineTable (mentor candidate details)
- Summary line above: StatCards "Red flags 2/3", "Head glances 6", "Eye glances 9", "Other alerts 0".
- Table: header `bg-surface-muted text-muted text-xs uppercase tracking-wide`; rows 44 px, zebra off, hover `bg-surface-muted`.
- Columns: Time (mono, 13 px) · Event (chip) · Direction · Duration · Candidate notified · Evidence (thumbnail button) · Decision (select).
- Filters as segmented control: All / Red flags / Glances / Other.

## StatCard
`rounded-xl border border-border bg-surface p-4`; label 12 px `text-muted`; value 24 px/600 `text-text`; optional delta chip.
