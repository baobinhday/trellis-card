---
name: lean-trellis-session-insight
description: "Find project knowledge and past AI conversation history through the `lean-trellis mem` CLI. Use whenever the user asks 'how did we solve X last time', 'have we discussed this before', 'what was the decision on X', '上次怎么解的', '之前讨论过吗', or when continuing work across sessions. Returns source-linked excerpts from project documents and past conversations."
---

# Session Insight

How to call `lean-trellis mem` and when that is the right move. Capability, not a workflow. No required write-back.

## What it is

A local CLI that searches project Markdown and local AI conversation logs across **Claude Code**, **Codex**, **Devin CLI** (`~/.local/share/devin/cli/sessions.db`), **Grok**, **Pi**, and **Antigravity**. System prompt tags (`<system-reminder>`, `<workflow-state>`, `<INSTRUCTIONS>`, etc.) and tool noise are stripped automatically; user turns are weighted `3×` higher than assistant turns. Documents and sessions are discovered automatically; no index service or upload is used.

```bash
lean-trellis mem recall "<topic or path>"
# Only when the excerpts leave a question unresolved:
lean-trellis mem read "<ref from recall>" "<another ref>"
```

For targeted conversation-only drill-downs or design-rationale recovery:
```bash
lean-trellis mem search "<topic>" [--platform claude|codex|devin|grok|pi|antigravity|all]
lean-trellis mem context <session-id> --grep "<topic>" --turns 3 --around 1
lean-trellis mem extract <session-id> --phase brainstorm
```

Full flags: `lean-trellis mem help`.

## When

- The user asks whether a decision was already made
- A bug or topic feels familiar from an earlier session
- The user resumes after a gap ("where were we")

## When not

- The answer is already in the current turn, spec, git log, or open files
- The user asked not to dig through history

## After a hit

Treat output as raw material. Quote it, promote a durable boundary with `lean-trellis-update-spec`, or just use it. Do not invent a task directory.

## Evidence and limits

Start with `recall` when earlier decisions or relevant project rules are needed; do not search on every turn. If an excerpt already answers the question with its source and necessary conditions/negations, cite it and stop. `read` is not a mandatory verification step. Use it for missing context, especially a proposal, rejection or condition in neighboring turns. Preserve speakers and chronological order. Reuse refs exactly; they include a source fingerprint. If a source changed or moved, recall again rather than trusting old text. Do not repeat the same lookup or run the legacy dialogue-only `search/context` after sufficient evidence merely to confirm it again; those commands remain available for explicit dialogue-only work.

`weak` is lexical overlap, not a confirmed answer. `incomplete` means some sources were not searched; `truncated` means the output budget or result limit was reached. Check warnings before claiming no memory exists. One keyword rewrite can help; do not loop indefinitely or infer semantic search.

Write new notes in the user's requested language, otherwise the discussion language. Preserve an existing document's language and original identifiers. Update the existing topic before creating another; journal entries should link to the topic rather than duplicate it.
