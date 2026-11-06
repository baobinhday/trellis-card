# Technical Design & Alternatives Guide

The technical design document (`design.md`) serves as the architectural bridge connecting business requirements (`prd.md`) with actual source code.

---

## 1. Core Focus of `design.md`
1. **Module Boundaries**:
   - Which module handles persistence and storage?
   - Which module processes core business and calculation logic?
   - Which module renders the presentation/UI layer?
2. **Data Contracts**:
   - New types, interfaces (TypeScript, Rust, Python, etc.).
   - API endpoints, IPC command signatures, or schema definitions.

---

## 2. Documenting Alternatives Considered
Adopted from DeepSeek Harness and Trellis principles:
- When choosing Approach A over B and C:
   - Always record both rejected approaches (B and C).
   - **Highlight the strongest case for B/C**: The most compelling reason someone might consider using it.
   - **Explain the rationale for rejection**: Why that approach is suboptimal or unfeasible in the current context.
- **Value**: Prevents future AI sessions or developers from re-proposing approaches that have already been proven unfeasible or undesirable.
