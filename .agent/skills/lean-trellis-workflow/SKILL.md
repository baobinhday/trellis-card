---
name: lean-trellis-workflow
description: "Structured, single-agent workflow for large features and complex refactoring. Operates 100% via natural chat prompts: 'Tạo task/feature <name>', 'Implement task <name>', 'Check/Nghiệm thu task <name>'. Guides requirement discovery (PRD), technical design with alternatives, and implementation checklist directly in the chat session without requiring manual terminal commands."
---

# Lean Trellis Workflow

> Structured, lightweight workflow for major features and complex refactoring, operated **100% via natural conversation in chat**.  
> Retains the rigorous planning discipline of Trellis (PRD → Design → Implementation Checklist → Verification) within an interactive, in-session pair programming flow that avoids context bloat.

---

## 1. Core Conversational Triggers

The user interacts using natural language. The assistant automatically activates the corresponding phase and updates document status:

| User Prompt (English or Vietnamese) | Autonomous Assistant Actions | Mandatory Status Transition |
| :--- | :--- | :--- |
| **1. "Tạo task / Lập kế hoạch `<name>`"**<br>*or "Create task `<name>`", "Plan feature `<name>`", `/plan `<name>`* | **Autonomous Scaffolding & Planning**:<br>• Create topic directory `.trellis/research/<slug>/`<br>• Initialize `prd.md`, `design.md`, `implement.md`<br>• Inspect existing codebase evidence first, then clarify requirements.<br>• Confirm scope and approve plan. | • `prd.md`: `Draft` ➔ `Approved`<br>• `design.md`: `Draft` ➔ `Approved`<br>• `implement.md`: `Planning` |
| **2. "Implement task `<name>`"**<br>*or "Triển khai task `<name>`", "Start coding..."* | **Direct In-Session Execution**:<br>• Set status to `In Progress`.<br>• Read `implement.md` to identify pending tasks (`[ ]`).<br>• Write code, run tests incrementally, and mark `[x]` (only in Section 1).<br>• Upon finishing all checklist items, set status to `Verification` and output 2 Git commands (`git add`, `git commit`). | • Start: `implement.md` ➔ `In Progress`<br>• All items done: `implement.md` ➔ `Verification` |
| **3. "Check task `<name>`"**<br>*or "Nghiệm thu task `<name>`", "Finish task..."* | **Verification & Knowledge Persistence**:<br>• Reconcile Acceptance Criteria in `prd.md`.<br>• Execute the project test suite (`npm test`, build check).<br>• Update status to `Completed` across task docs.<br>• Update `.trellis/spec/` conventions and record session journal via `add_session.py`. | • `prd.md` ➔ `Completed`<br>• `design.md` ➔ `Completed`<br>• `implement.md` ➔ `Completed` |

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

### 4. Topic Directory Management & Markdown Hygiene
- Maintain artifacts under `.trellis/research/<slug>/`:
  - `prd.md`: Requirements, in-scope/out-of-scope, testable acceptance criteria.
  - `design.md`: Architecture, data flow, contracts, and **Alternatives Considered** (always state the strongest reason for a rejected path before explaining why it was dismissed).
  - `implement.md`: Ordered checklist with `[ ]` checkboxes, target files, and test commands.
- **Checklist Scope Rule**: Markdown checkboxes `- [ ]` and `- [x]` are **strictly reserved** for `## 1. Ordered Implementation Checklist`. Never use checkboxes in `## 3. Risk Watchlist`, notes, or references (use standard bullet points `- ` instead) to avoid corrupting subtask scanners.

---

## 3. Step-by-Step Execution Guide

### Phase 1: Planning ("Tạo task / Plan `<name>`")
1. Derive a concise URL-safe `slug` from the feature name (e.g., `user-auth`, `kanban-sync`).
2. Scaffold `.trellis/research/<slug>/` with `prd.md` (`Status: Draft`), `design.md` (`Status: Draft`), and `implement.md` (`Status: Planning`) from templates (or run `scripts/new-feature.sh <slug> "<name>"`).
3. Recall prior relevant project decisions:
   ```bash
   lean-trellis mem recall "<feature keywords>"
   ```
4. Read relevant specs under `.trellis/spec/` or `docs/`.
5. Pre-fill known facts and repository constraints into `prd.md`.
6. Ask the single highest-value question if product intent is missing. Update `prd.md` upon user response.
7. Present the PRD summary and await user confirmation. Once confirmed:
   - Promote `prd.md` header to `**Status:** Approved`.
   - Promote `design.md` header to `**Status:** Approved`.

### Phase 2: Technical Design (`design.md`)
1. Detail component boundaries, schemas, and contract interfaces.
2. Formulate **Alternatives Considered**: document rejected options with their strongest arguments and reasons for rejection.
3. Define backward compatibility and rollback precautions.

### Phase 3: Implementation Checklist (`implement.md`)
1. Break down implementation into 3-5 distinct phases in `## 1. Ordered Implementation Checklist`.
2. Each item must have a testable task checkbox `[ ]`, files to modify, and validation commands.
3. Keep `## 3. Risk Watchlist` as plain bullet points (`- `), never checkboxes.

### Phase 4: Implementation ("Implement task `<name>`")
1. **Initial Status Update**: Immediately edit `implement.md` header to `**Status:** In Progress`.
2. Read `implement.md` to locate the current pending subtask (`[ ]`).
3. Implement code directly in the active session.
4. Validate immediately with unit tests or build commands.
5. Update `implement.md` by checking off `[x]`.
6. Provide a brief progress summary and move to the next item.
7. **Pre-Verification Git Hand-off & Verification Status**: Once all items in `## 1. Ordered Implementation Checklist` are marked `[x]`:
   - Update `implement.md` header to `**Status:** Verification`.
   - Output 2 ready-to-run Git commands:
     - `git add <file1> <file2> ...` (explicitly list only the files touched by this task; never use blind `git add .`).
     - `git commit -m "<type(scope): concise conventional commit message>"`.

### Phase 5: Verification & Completion ("Check task `<name>`")
1. Run the project verification suite (`npm test`, build check, type check).
2. Explicitly verify every Acceptance Criterion in `prd.md`.
3. **Synchronize Completed Status**:
   - Update `prd.md` header to `**Status:** Completed`.
   - Update `design.md` header to `**Status:** Completed`.
   - Update `implement.md` header to `**Status:** Completed`.
4. If durable project conventions were established, update `.trellis/spec/` using `lean-trellis-update-spec`.
5. Record the completed session in the developer journal:
   ```bash
   python3 ./.trellis/scripts/add_session.py \
     --title "Complete task: <feature-name>" \
     --summary "<Summary of implementation, key decisions, and tests passed>" \
     --topic .trellis/research/<slug>/prd.md
   ```
   (Pass `--commit <hash>` if the user executed the recommended git commit prior to verification).

---

## 4. Deterministic Status Lifecycle & Kanban Lane Mapping

Lean Trellis enforces a **concrete, single-value status** in document headers. Template placeholders with pipe options (e.g., `Draft | In Review | Approved`) are strictly forbidden.

### Canonical Status Enum

| Document | Canonical Status Values | Kanban Lane | Meaning |
| :--- | :--- | :--- | :--- |
| **`implement.md`** *(Primary Execution State)* | `Planning` | Lane 1: Planning | Task scaffolded; requirements & checklist being planned. |
| | `In Progress` | Lane 2: In Progress | Actively being coded in active chat session. |
| | `Verification` | Lane 3: Verification / Review | Code checklist 100% complete; running test suite & AC checks. |
| | `Blocked` | Lane 3: Blocked | Work halted due to blocker or external dependency. |
| | `Completed` | Lane 4: Done | Verified, tests passed, session journal recorded. |
| **`prd.md`** *(Requirement Lifecycle)* | `Draft` ➔ `In Review` ➔ `Approved` ➔ `Completed` | Planning (Draft/In Review/Approved), Done (Completed) | Tracks requirements maturity. |
| **`design.md`** *(Architecture Lifecycle)* | `Draft` ➔ `Approved` ➔ `Completed` | Planning (Draft/Approved), Done (Completed) | Tracks technical design maturity. |

### Observer Precedence Rule
For external observers (e.g., Trellis Card desktop app, scripts):
1. **Explicit Status First**: The `Status:` header in `implement.md` is the Single Source of Truth for task execution state. If absent, fallback to `prd.md`.
2. **Subtask Progress**: Percentage progress is derived **strictly** from `[x]` vs `[ ]` within `## 1. Ordered Implementation Checklist`. Checkboxes outside this section must not exist.
3. **Completion Invariant**: A task is only moved to `Done` (Lane 4) when its explicit status is `Completed` (or directory is moved to `archive/`). Checklist item completion alone triggers `Verification`, not premature completion.

---

## Detailed References
- [01-brainstorming.md](references/01-brainstorming.md): Brainstorming, evidence gathering, scope cutting, and interview protocols.
- [02-technical-design.md](references/02-technical-design.md): Contract definitions, module boundaries, and alternatives considered.
- [03-execution-guide.md](references/03-execution-guide.md): In-session execution discipline and incremental checklist tracking.
- [04-verification-remember.md](references/04-verification-remember.md): Acceptance testing, spec promotion, and session recording.
- [05-deepseek-note-discipline.md](references/05-deepseek-note-discipline.md): Fact/Hypothesis tagging, negative knowledge, and anti-rot principles.
