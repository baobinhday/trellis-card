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

## 3. Pre-Verification Git Hand-off & Verification Status
Once all items in `implement.md` are marked `[x]`, before prompting the user for verification or nghiệm thu:
1. Update `implement.md` header to `**Status:** Verification`.
2. Output 2 ready-to-run Git commands:
   - `git add <file1> <file2> ...` (specifically enumerate all files touched by this task; never use blind `git add .`).
   - `git commit -m "<type(scope): concise description>"` (meaningful conventional commit message).

The developer can review and execute the commit, allowing the resulting commit hash to be passed to `add_session.py --commit <hash>` during the subsequent verification phase.
