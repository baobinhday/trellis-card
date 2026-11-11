# Execution Guide (Single-Agent Session Execution)

Instead of spawning detached background sub-agents, the entire implementation workflow proceeds directly within the primary conversation session between developer and agent.

---

## 1. Benefits of Single-Agent Session Execution
- **Zero Context Amnesia**: The agent retains full context from brainstorming PRD and Technical Design without cold-start loss.
- **Real-Time Feedback**: Developers can intervene, provide immediate feedback, or adjust direction on the fly without waiting for sub-agent batches.
- **Maximum Token Efficiency**: Eliminates redundant token overhead spent booting sub-agents and syncing state back and forth.

---

## 2. Checklist & Status Discipline
1. **Set Initial Status**:
   - Immediately edit `implement.md` header to `**Status:** In Progress` when beginning implementation.
2. Follow `implement.md`:
   - Execute tasks step-by-step in logical order.
   - Do not skip ahead before verifying the current step.
3. Update state directly:
   - Edit `implement.md` to change `[ ]` to `[x]` as each task completes.
   - Markdown checkboxes `- [ ]` and `- [x]` are strictly confined to `## 1. Ordered Implementation Checklist`. Never use checkboxes in `## 3. Risk Watchlist` or notes.
4. Verify frequently:
   - Run unit tests or project build checks after each significant change to catch regressions immediately.

---

## 3. Optional Behavior-Slice TDD Mode
When the user requests TDD (e.g., *"Implement task `<name>` theo TDD"*) or when implementing critical domain logic, drive each checklist item as one **Behavior Slice** at a time:
1. Pick the next behavior from `implement.md`.
2. Identify the smallest public interface (user-facing or module-facing boundary) that expresses the behavior.
3. **Red**: Write one failing test that describes the expected behavior and verify it fails for the right reason.
4. **Green**: Implement the smallest code path that makes the test pass.
5. **Refactor**: Clean up only while green, re-running the focused test after each change.
6. Check off `[x]` in `implement.md` and proceed to the next behavior slice.

**Testing Guardrails**:
- Test public behavior, never private methods or internal call order.
- Mock only system boundaries (network, database, time, randomness, file system, subprocesses).

---

## 4. Smart Pre-Verification Git Hand-off & Verification Status
Once all items in `implement.md` are marked `[x]`, before prompting the user for verification or nghiệm thu:
1. Update `implement.md` header to `**Status:** Verification`.
2. Inspect repository state and commit style:
   - Run `git status --porcelain` to snapshot all dirty paths.
   - Run `git log --oneline -5` to match the repository's commit prefix (`feat:`, `fix:`, `refactor:`, etc.) and language style.
3. Classify dirty files into two groups:
   - **AI-edited this task**: Files created or modified as part of this task's execution + `.trellis/` task artifacts.
   - **Unrecognized dirty files**: Modified/untracked files NOT touched during this task (e.g., user's manual WIP or unrelated edits). **Never silently include these in `git add`.**
4. Output 2 ready-to-run Git commands for the AI-edited files:
   - `git add <file1> <file2> ...` (specifically enumerate only AI-edited files for this task; never use blind `git add .`).
   - `git commit -m "<type(scope): concise description>"` (meaningful conventional commit message).
   - *(If unrecognized dirty files exist, list them separately below the commands as a brief note so the developer is aware they were excluded).*

The developer can review and execute the commit, allowing the resulting commit hash to be passed to `add_session.py --commit <hash>` during the subsequent verification phase.
