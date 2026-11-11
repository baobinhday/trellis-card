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

## 4. Living Documents over Fragmented Notes (Anti-Rot & Anti-Bloat)
- **Zero Scratch Clutter:** Do not generate ephemeral, one-off summary files that rot within 24 hours.
- **In-Place Updates & Zero Overwrite:** When extending an existing topic, NEVER overwrite prior work. Update living files directly (`.trellis/spec/`, `prd.md`, `design.md`, `implement.md`).
- **Clean Context Window:** Keep active notes compact. Promote lasting rules into `.trellis/spec/` and log sessions into the developer journal.

---

## 5. Document Evolution & Anti-Bloat Guardrails (Quản lý dung lượng file)
Để tránh tình trạng file tích tụ qua nhiều Phase/Iteration trở nên quá dài (Context Bloat), AI tuân thủ **3 van xả áp**:

1. **Promote to Spec (Rút tỉa quy ước bền vững):**
   - Khi một Phase đã Completed, các kiến trúc cốt lõi, API contract, hoặc quy tắc DB được chuyển thành quy ước ngắn gọn trong `.trellis/spec/`.
   - Trong `prd.md` và `design.md`, thay vì lưu lại toàn bộ chi tiết triển khai cũ, chỉ cần giữ lại 1 dòng tóm tắt và trỏ link:
     > `*Phase 1 (Completed): Core contracts codified in .trellis/spec/<domain>/...*`

2. **Compaction Threshold (< 300 dòng/file):**
   - Giữ dung lượng mỗi file tài liệu (`prd.md`, `design.md`, `implement.md`) dưới ngưỡng **300 dòng**.
   - Khi mở Phase mới trong `implement.md`, checklist chi tiết của Phase cũ được nén lại (dùng thẻ `<details>` hoặc tóm tắt) để nhường chỗ cho checklist của Phase hiện tại.

3. **Tách Sub-topic khi vượt ngưỡng Scope:**
   - Nếu tính năng mới mở rộng ra một module hoàn toàn độc lập (ví dụ từ `board-game-core` mở rộng sang `board-game-multiplayer`), AI chủ động đề xuất tạo một topic riêng rẽ thay vì nhồi nhét vào topic cũ, kèm liên kết tham chiếu:
     > `Depends on: [.trellis/research/board-game-core/prd.md](../board-game-core/prd.md)`.
