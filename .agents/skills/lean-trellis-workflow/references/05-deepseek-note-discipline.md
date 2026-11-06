# DeepSeek Note & Thinking Discipline

This reference codifies the engineering and note-taking principles inspired by DeepSeek's internal research harness (`write-notes-like-deepseek`), governing how AI coding agents formulate thoughts, document findings, and prevent context rot.

---

## 1. Negative Knowledge is Paramount
Standard agents only document what they *plan* to do. DeepSeek discipline prioritizes **what NOT to do and why**:
- **Dead Ends & Pitfalls:** When an approach fails, log the exact failure mode (stack trace, benchmark drop, lock contention, race condition).
- **The Seductive Trap:** Explicitly state the most appealing aspect of the rejected path (e.g., *"Seems simpler because it requires no migration"*), followed by the definitive reason it was rejected (*"Breaks concurrency invariant under high load"*).
- **Outcome:** Prevents subsequent AI sessions from looping back into previously discredited approaches.

---

## 2. Fact vs. Hypothesis vs. Decision Tagging
Never blur speculative reasoning with verified reality:
- **`[Observed Fact]`**: Directly verified via code inspection, test results, or CLI execution (cite file and line number or command output).
- **`[Hypothesis]`**: Plausible deduction that has NOT yet been measured or verified in runtime.
- **`[User Decision]`**: Explicit choice finalized and confirmed by the human developer.
- **`[Rejected / Dead End]`**: Evaluated and discarded; must not be proposed again under the same preconditions.

---

## 3. Evidence-First Principle
- Never ask the user a question that the codebase already answers.
- Inspect configs, existing tests, module boundaries, and git history before framing requirements.
- Frame unavoidable questions around trade-offs, providing an opinionated recommendation based on repository patterns.

---

## 4. Living Documents over Fragmented Notes (Anti-Rot)
- **Zero Scratch Clutter:** Do not generate ephemeral, one-off summary files that rot within 24 hours.
- **In-Place Updates:** Update living files directly (`.trellis/spec/`, `prd.md`, `design.md`, root `README.md`).
- **Clean Context Window:** Keep active notes compact. Promote lasting rules into `.trellis/spec/` and log sessions into the developer journal.
