---
name: ai-agent-session-workflow
description: >
  How to run AI-assisted work (Cowork, Claude Code, Codex or similar) efficiently across many
  sessions: choosing the tool, keeping token cost low, setting up a project so any agent or a
  smaller model can resume from files instead of chat history (one entry file, routing table,
  progress log, task recipes), the per-session protocol an agent follows, copy-paste prompt
  templates, quality gates (one test command, visual evidence, Git, plan approval), and lessons
  for adopting large third-party agent frameworks. Use when starting or handing off an
  AI-built project, writing AGENTS.md/CLAUDE.md, planning which AI tool or model to use, or
  when a session is getting long and costly.
type: ai-skill
domain: craftland-ugc
status: authoritative
version: 1.1.0
last_updated: 2026-11-03
source: "Lessons from the 'Kelly Milk Tea Shop' three.js prototype (mini-simulation-game, 2026-10/11) and a review of github.com/Donchitos/Claude-Code-Game-Studios"
---

# AI Agent Session Workflow

> **One rule above all:** one task = one short session. The agent reads one entry file, then only
> the files that entry file routes it to, and verifies its own work before reporting "done".
> Decisions live in files, not in chat history.

Numbers marked *(source project)* are measurements from the worked example, not targets.

## 1. Core rules

| # | Rule | Why |
|---|---|---|
| 1 | **One task per session.** Switch task → open a new session. | Every message re-sends the whole conversation; long sessions cost more per turn and get auto-summarised (details lost). |
| 2 | **Files replace chat history.** Any decision that matters is written to a project file. | The next session, another model or a teammate can only see files. |
| 3 | **One entry file, written as an index** (`AGENTS.md`): "task X → read files Y". | Stops the agent from reading the whole repository. |
| 4 | **Design where you can see; build where you can diff.** Cowork for design/visual/research/docs, Claude Code for multi-step code. Repetitive work on a cheaper model. | See §2. |
| 5 | **Every prompt states:** what to read, what to do, scope, definition of done. | Missing "done" = the agent defines it, usually without verification. |
| 6 | **Two verification layers:** an automated check + looking at the result. Git to roll back. | Agents report "done" with the same confidence whether right or wrong. |

## 2. Choosing the tool

| Work | Use | Reason |
|---|---|---|
| Ideas, game/system design, balance discussion | Cowork | Back-and-forth reasoning, options, questions |
| Anything judged by looking (models, UI, layout, scene dressing) | Cowork | Preview + screenshots let the agent look and fix (the source project rebuilt 5 characters this way) |
| Writing content, docs, dialogue, research | Cowork | Writing-heavy, little logic; web research built in |
| Reports, decks, docs for the team | Cowork | Shareable page, Word, PowerPoint output |
| Implementing a feature from an existing recipe | Claude Code | Works in the repo, shows diffs to approve |
| Bug fixes, refactors across many files, run tests after each step | Claude Code | Iterative edit-test loop |
| Repetitive implementation, cost-sensitive work | Claude Code + smaller model | Recipes make small models reliable |
| Version control, rollback | Claude Code | Git: commit, branch, revert |

- **Hand-off between tools happens through files** (entry file, docs, progress log). Never let two tools edit the same folder at the same time.
- **Exception:** a small change right after a discussion → do it in the session that is already open; its context is loaded and switching costs more.
- Observed limits *(source project)*: Cowork's preview panel does not run animation frames (a debug fast-forward hook was needed to screenshot gameplay) and the session had no Git.

## 3. Token economy

| Approach | Read per turn *(source project, approximate)* |
|---|---|
| Continue one long conversation | Whole history, > 100k tokens (screenshots, file dumps, retries) |
| New session: entry file + 1–2 routed docs | ~6–8k tokens (+ ~12–15k if a 42 KB source file is needed) |

- Re-reading docs is far cheaper than carrying a long history; docs are the compressed history.
- A longer context is not a better understanding: stale, abandoned code in history makes the model less precise.
- Batch related requests into one message. Do not ask "do you understand the project?" or for a project recap.
- Use search (grep) to reach the exact function instead of reading a large file. Mark vendored libraries (e.g. `lib/`) as never-read.
- Screenshots only when the change is visual — each image is expensive.
- Paste errors compactly: the error line and file name, not the whole console.

## 4. Project setup for agents

```
CLAUDE.md          → one line: @AGENTS.md (Claude Code auto-loads it)
README.md          → for humans; first line: "AI agents: start at AGENTS.md"
AGENTS.md          → the entry file: session protocol, routing table, hard rules, verify command
docs/PROGRESS.md   → memory between sessions: status, locked decisions, next steps, dated log
docs/<topic>.md    → one topic per file (design, architecture, modelling, dialogue…)
docs/TASK_RECIPES.md → step-by-step recipes for recurring tasks: files, steps, checks
tools/<check>      → one command that verifies the project
```

**Entry file (`AGENTS.md`) must contain, and stay short:**

1. Two-line project summary and stack.
2. The session protocol (§5).
3. A **routing table** — the part that saves the most tokens:

   | Task | Read (and nothing else unless needed) |
   |---|---|
   | Add/edit a character | `TASK_RECIPES.md` R1, `CHARACTER_MODELING.md`, `CHARACTER_ANIMATION.md`, one sample folder |
   | Add dialogue | `DIALOGUE.md`, `data/dialogues.js` |
   | Change prices/difficulty | `GAME_DESIGN.md` (economy), `TASK_RECIPES.md` R8 |
   | Fix a logic bug | `ARCHITECTURE.md`, then grep the function |

4. Hard rules and prohibitions (no build step, never edit `lib/`, do not reverse locked decisions without asking).
5. The verification command and how to check visually.

**Progress log:** if the project already has a decision log or changelog, use it — do not create a
parallel `PROGRESS.md`. For long projects with many decisions, upgrade to the full handbook,
generated facts, decision index and cold-read test in
[Documentation another agent can take over](../game-design/knowledge-pack/05-playbooks/04_documentation_handoff.md).

**If both `AGENTS.md` and `CLAUDE.md` exist with real content**, keep them consistent (same rules,
same bootstrap); prefer making one import the other.

## 5. Session protocol (what the agent does)

1. **Load state** — read the entry file, then the progress log (status, locked decisions).
2. **Read only what the routing table names** for the assigned task; search instead of reading large files.
3. **Plan first when the change is large** — more than 3 files or core logic: a plan of ≤ 10 lines, wait for approval.
4. **Work in small steps** — run the verification command after each step.
5. **Close the session** — update the progress log (≤ 15 lines: done, in progress + why, next, new decisions, how verified); update topic docs if rules changed; report to the user in 3–5 lines.

## 6. Prompt templates

Copy-paste prompts: shortest session start, full start (read list, task, scope, done-when, plan gate, end-of-session update), a worked example, the end-of-session prompt, and prompt anti-patterns. → [Details](ai_agent_prompt_templates.md#6-prompt-templates)

## 7. Quality gates

- **One verification command** (the source project: `node tools/smoke-test.js` — syntax of every file, builds and animates every character, validates data format). The entry file states: no "done" until it passes.
- **Visual changes need visual evidence** — passing tests do not prove a screen renders correctly. If the agent cannot look, it must report "not visually verified", never "pass".
- **Give the agent ways to look:** a standalone viewer page, a debug fast-forward (e.g. `__game.step(30)`), on-screen error toasts naming the file. See also headless checks in [Data & Tooling Patterns](data_tooling_patterns.md).
- **Git from day one**; commit before each large task so a broken change can be reverted.
- **Plan approval** before changing more than 3 files or core logic.
- **Data out of code** — balance numbers, dialogue, character info in data files, so a small model edits content without touching logic.
- **One folder per content unit** with the same file layout (e.g. `characters/<id>/info.js · model.js · animation.js`); adding = copy a sample and edit.
- **Write prohibitions explicitly**; small models follow clear rules better than they infer.

## 8. Adopting large agent frameworks

Take ideas, not bundles: light process beat heavy process in the framework author's own test; long instructions hurt small models; check environment fit first. → [Details](ai_agent_prompt_templates.md#8-adopting-large-agent-frameworks)

## 9. Precedence (when this conflicts with a repository's rules)

- **Repository protocols win.** Example: this knowledge base's [Update Protocol](../CONTRIBUTING.md#update-protocol-for-ai-agents-must-follow) requires reading every folder README for the duplicate check — do it; the minimal-reading rule applies to implementation sessions, not to protocol-mandated checks.
- **Existing logs win** over creating `PROGRESS.md` (§4).
- **Stricter approval rules win** (e.g. "flag and ask first, no silent fixes" over the 3-file plan threshold).
- **"Read source files first"** in [`SKILL.md`](../SKILL.md) still holds: minimal reading means reading the *right* files, never answering from memory.
