# Execution Guide (Single-Agent Session Execution)

Instead of spawning detached background sub-agents, the entire implementation workflow proceeds directly within the primary conversation session between developer and agent.

---

## 1. Benefits of Single-Agent Session Execution
- **Zero Context Amnesia**: The agent retains full context from brainstorming PRD and Technical Design without cold-start loss.
- **Real-Time Feedback**: Developers can intervene, provide immediate feedback, or adjust direction on the fly without waiting for sub-agent batches.
- **Maximum Token Efficiency**: Eliminates redundant token overhead spent booting sub-agents and syncing state back and forth.

---

## 2. Checklist Discipline
1. Follow `implement.md`:
   - Execute tasks step-by-step in logical order.
   - Do not skip ahead before verifying the current step.
2. Update state directly:
   - Edit `implement.md` to change `[ ]` to `[x]` as each task completes.
3. Verify frequently:
   - Run unit tests or project build checks after each significant change to catch regressions immediately.
