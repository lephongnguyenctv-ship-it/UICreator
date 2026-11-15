---
name: ai-agent-prompt-templates
description: Detail of AI Agent Session Workflow — copy-paste prompts for starting and ending AI sessions, a worked example, prompt anti-patterns, and lessons from reviewing large agent frameworks (Claude Code Game Studios).
type: ai-skill
domain: craftland-ugc
status: authoritative
version: 1.0.0
last_updated: 2026-11-03
---

# AI Agent Prompt Templates & Framework Lessons

> Detail file of [AI Agent Session Workflow](ai_agent_session_workflow.md) — read that file first. Content moved verbatim on
> 2026-11-03 to keep the parent short; section numbers (§) refer to the parent's numbering.

## 6. Prompt templates

**Start, shortest** (Claude Code with `CLAUDE.md` needs only the task):

```markdown
Read <project path>\AGENTS.md, then do: <task>
```

**Start, full** (important tasks):

```markdown
Project: <path>.
Read only, in order: AGENTS.md → docs/PROGRESS.md → <files from the routing table>.
Do not read lib/. Do not read large files whole — search for the function you need.

Task: <1–3 sentences>
Scope: change only <files/folders>. Do not touch <files/folders>.
Done when: <visible result> + <verify command> passes.
If more than 3 files must change: propose a plan of ≤ 10 lines and wait for my approval.
End of session: update docs/PROGRESS.md and summarise the result in 3 lines.
```

**Worked example** *(source project)*:

```markdown
Read only: AGENTS.md → docs/PROGRESS.md → docs/DIALOGUE.md → data/dialogues.js.
Task: add 10 two-person dialogues about "end-of-month KPI closing" and 5 monologues.
Scope: change only data/dialogues.js.
Done when: smoke test passes, no idea repeats an existing dialogue.
```

**End of session:**

```markdown
Before finishing: update docs/PROGRESS.md with (1) done, (2) in progress and why,
(3) next steps, (4) new decisions if any. Max 15 lines.
If a decision changes game rules, update the matching doc too.
```

**Anti-patterns:**

| Avoid | Instead |
|---|---|
| "the purple character file" | the exact path |
| "read the whole project first" | the routing table |
| a large task with no plan gate | "plan ≤ 10 lines, wait for approval" |
| no definition of done | visible result + verify command |

## 8. Adopting large agent frameworks

Reviewed example: [Claude Code Game Studios](https://github.com/Donchitos/Claude-Code-Game-Studios)
(49 agents, 74 commands, 15 hooks, 62 templates; built for Godot/Unity/Unreal, Claude Code in a terminal, Git, Python, Bash).

| Lesson | Evidence |
|---|---|
| Light process beats heavy process | The author's own test: "standard" rigor wrote ~30 docs in 58 min before code, and that game ranked last; "minimal" is their default. |
| Long instructions hurt small models | One of its check commands is ~600 lines, mostly engine-specific. |
| Check the environment fit first | Hooks/permissions need Claude Code started at the repo root; engine-bound. |

**Take the ideas, not the bundle:** screenshot evidence for visual changes · a file as memory between sessions · honest "not assessed" instead of a false pass · balance data out of code · a few project-specific commands instead of dozens of generic ones.
