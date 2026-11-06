---
name: lean-trellis-workflow
description: "Structured, single-agent workflow for large features and complex refactoring. Operates 100% via natural chat prompts: 'Tạo task/feature <name>', 'Implement task <name>', 'Check/Nghiệm thu task <name>'. Guides requirement discovery (PRD), technical design with alternatives, and implementation checklist directly in the chat session without requiring manual terminal commands."
---

# Lean Trellis Workflow

> Structured, lightweight workflow for major features and complex refactoring, operated **100% via natural conversation in chat**.  
> Retains the rigorous planning discipline of Trellis (PRD → Design → Implementation Checklist → Verification) within an interactive, in-session pair programming flow that avoids context bloat.

---

## 1. Core Conversational Triggers

The user interacts using natural language. The assistant automatically activates the corresponding phase:

| User Prompt (English or Vietnamese) | Autonomous Assistant Actions |
| :--- | :--- |
| **1. "Tạo task / Lập kế hoạch `<name>`"**<br>*or "Create task `<name>`", "Plan feature `<name>`", `/plan `<name>`* | **Autonomous Scaffolding & Planning**:<br>• Create topic directory `.trellis/research/<slug>/`<br>• Initialize `prd.md`, `design.md`, `implement.md`<br>• Inspect existing codebase evidence first, then clarify requirements. |
| **2. "Implement task `<name>`"**<br>*or "Triển khai task `<name>`", "Start coding..."* | **Direct In-Session Execution**:<br>• Read `implement.md` to identify pending tasks (`[ ]`).<br>• Write code, run tests incrementally, and mark `[x]`.<br>• Collaborate directly in the active session with real-time feedback. |
| **3. "Check task `<name>`"**<br>*or "Nghiệm thu task `<name>`", "Finish task..."* | **Verification & Knowledge Persistence**:<br>• Reconcile Acceptance Criteria in `prd.md`.<br>• Execute the project test suite (`npm test`, build check).<br>• Update `.trellis/spec/` conventions and record session journal via `add_session.py`. |

---

## 2. Working Principles

### 1. Repository Evidence First (Non-Negotiable)
- If an answer can be derived from inspecting code, tests, configs, or existing specs in `.trellis/spec/` — **the assistant must inspect the codebase first**.
- Never ask the user questions that repository evidence can already answer.
- Ask the user only for: Product intent, feature scope boundaries (in-scope vs out-of-scope), UX preferences, or business risk tolerance.

### 2. Single High-Value Question per Message
- While requirements remain unclarified, end the turn with **exactly one highest-value question**.
- Each question must include:
  - What decision is needed and why it matters.
  - Recommended choice (`➡️ Recommended: ...`).
  - Trade-off if the user selects an alternative path.

### 3. Interactive In-Session Execution
- All phases (planning, coding, testing, verification) execute sequentially within the active chat session.
- Keep the user in the loop with short, continuous progress updates.

### 4. Topic Directory Management
- Maintain artifacts under `.trellis/research/<slug>/`:
  - `prd.md`: Requirements, in-scope/out-of-scope, testable acceptance criteria.
  - `design.md`: Architecture, data flow, contracts, and **Alternatives Considered** (always state the strongest reason for a rejected path before explaining why it was dismissed).
  - `implement.md`: Ordered checklist with `[ ]` checkboxes, target files, and test commands.

---

## 3. Step-by-Step Execution Guide

### Phase 1: Planning ("Tạo task / Plan `<name>`")
1. Derive a concise URL-safe `slug` from the feature name (e.g., `user-auth`, `kanban-sync`).
2. Scaffold `.trellis/research/<slug>/` with `prd.md`, `design.md`, and `implement.md` from templates (or run `scripts/new-feature.sh <slug> "<name>"`).
3. Recall prior relevant project decisions:
   ```bash
   mini-trellis mem recall "<feature keywords>"
   ```
4. Read relevant specs under `.trellis/spec/` or `docs/`.
5. Pre-fill known facts and repository constraints into `prd.md`.
6. Ask the single highest-value question if product intent is missing. Update `prd.md` upon user response.
7. Present the PRD summary and await user confirmation before proceeding to design.

### Phase 2: Technical Design (`design.md`)
1. Detail component boundaries, schemas, and contract interfaces.
2. Formulate **Alternatives Considered**: document rejected options with their strongest arguments and reasons for rejection.
3. Define backward compatibility and rollback precautions.

### Phase 3: Implementation Checklist (`implement.md`)
1. Break down implementation into 3-5 distinct phases.
2. Each item must have a testable task checkbox `[ ]`, files to modify, and validation commands.

### Phase 4: Implementation ("Implement task `<name>`")
1. Read `implement.md` to locate the current pending subtask (`[ ]`).
2. Implement code directly in the active session.
3. Validate immediately with unit tests or build commands.
4. Update `implement.md` by checking off `[x]`.
5. Provide a brief progress summary and move to the next item.

### Phase 5: Verification & Completion ("Check task `<name>`")
1. Run the project verification suite (`npm test`, build check, type check).
2. Explicitly verify every Acceptance Criterion in `prd.md`.
3. If durable project conventions were established, update `.trellis/spec/` using `lean-trellis-update-spec`.
4. Record the completed session in the developer journal:
   ```bash
   python3 ./.trellis/scripts/add_session.py \
     --title "Complete task: <feature-name>" \
     --summary "<Summary of implementation, key decisions, and tests passed>" \
     --topic .trellis/research/<slug>/prd.md
   ```
