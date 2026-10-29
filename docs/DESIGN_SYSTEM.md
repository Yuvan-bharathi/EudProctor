# Design system — "Soft Mist" light theme

Calm, light and quiet, so candidates under exam pressure aren't stressed and mentors can scan a
lot of data without fatigue. The full tokens and component rules are in the
`eduproctor-design-system` skill (`.claude/skills/eduproctor-design-system/`).

## Principles
- Light only for MVP. White cards on a very pale grey-blue page; colour is used sparingly for meaning.
- One calm primary (sage teal) for actions; soft lavender for AI-generated content; muted status colours.
- Red flags use soft coral, never bright red; glances use soft blue. Nothing flashes or shakes.
- Generous spacing, rounded corners (10–14 px), hairline borders instead of heavy shadows.
- Text contrast ≥ 4.5:1 (all text tokens below are checked). `text-subtle` is for placeholders/disabled only.

## Palette
| Role | Token | Hex | Use |
|---|---|---|---|
| Page background | `--bg` | #F7F9FA | app background |
| Surface | `--surface` | #FFFFFF | cards, tables, dialogs |
| Muted surface | `--surface-muted` | #F1F4F6 | table headers, inputs, hover |
| Border | `--border` | #E2E7EB | hairlines |
| Text | `--text` | #1F2A37 | body (13.8:1 on bg) |
| Muted text | `--text-muted` | #5B6676 | labels, meta (5.5:1) |
| Primary | `--primary-600` | #3F7D78 | buttons, links, focus (white text 4.8:1) |
| Primary tint | `--primary-50` | #EEF6F5 | selected rows, info panels |
| AI accent | `--ai-500` / `--ai-50` | #8B85C9 / #F2F1FA | AI-drafted content, agent badges |
| Strong / success | `--success-700` on `--success-50` | #2F6B4C / #EAF5EE | strong topics, approved |
| Developing / warning | `--warning-800` on `--warning-50` | #8A5A14 / #FBF4E6 | developing topics, pending review |
| Red flag / weak | `--danger-700` on `--danger-50` | #A8433C / #FCEDEB | red flags, weak topics |
| Glance / info | `--info-700` on `--info-50` | #36658F / #EBF2F9 | glance log, info |

Typography: Inter (fallback system-ui), 14 px base, 1.5 line height; headings 600 weight, 20/24/30 px.
