# How to use this kit with Claude Code

1. Create an empty repo folder (e.g. `eduproctor/`) and copy everything from this kit into its root,
   keeping the hidden `.claude/` folder:
   ```
   eduproctor/
   ├── CLAUDE.md                 ← loaded automatically every session
   ├── .env.example
   ├── docs/                     ← PRD, architecture, build plan, design system
   └── .claude/
       ├── skills/               ← loaded when relevant (or by name)
       │   ├── eduproctor-design-system/   (SKILL.md, tokens.css, components.md)
       │   ├── proctoring-engine/          (SKILL.md, reference.md)
       │   ├── assessment-evaluation-agent/ (SKILL.md, summary.schema.json, prompt.md)
       │   └── build-phase/                (SKILL.md → /build-phase <n>)
       └── agents/               ← reviewer subagents
           ├── guardrail-reviewer.md
           └── ui-reviewer.md
   ```
2. `git init && git add . && git commit -m "Project kit"`, then start `claude` in that folder.
3. First prompt: "Read CLAUDE.md and docs/, then run /build-phase 0." Continue with `/build-phase 1`, `2`, …
   Review and commit after each phase.
4. Open `docs/design-preview.html` in a browser to see the colour palette and key components.
5. Put your Anthropic API key and the model name in `.env` (copied from `.env.example`) before Phase 2 (question ideas) and Phase 7 (evaluation agent).

Tips
- If Claude drifts from a rule, point it at the rule in CLAUDE.md rather than re-explaining.
- Change thresholds (flag seconds, topic %) in `.env`/config only; the docs and tests reference config names.
- Keep the Word document and slide deck as the human-facing spec; these markdown files are the build spec. If you change one, update the other.
