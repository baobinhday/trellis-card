# Brainstorming & PRD Drafting Guide

The goal of this phase is to transform raw user requirements into a rigorous, well-bounded PRD (Product Requirements Document), preventing the agent from prematurely writing code before fully understanding the problem space.

---

## 1. Evidence-First Principle
Before asking any questions to the user:
1. Search the codebase:
   - Identify existing files implementing similar features.
   - Review configurations, mock data, and unit tests.
2. Review existing specifications under `.trellis/spec/` or `docs/`.
3. Run `lean-trellis mem recall "<topic>"` to inspect whether earlier discussions or decisions already addressed this requirement.

---

## 2. User Interview Technique (1 High-Value Question per Turn)
- If business logic or scope remains ambiguous:
   - Avoid overwhelming the user with multiple concurrent questions.
   - Select the single question that has the highest architectural or UX impact.
- Standard question format:
   ```text
   To finalize the approach for [Feature X], I need to clarify:
   [Core question]?

   ➡️ My recommendation: [Proposed approach], because [technical reason / codebase consistency].
   ⚠️ Trade-off: If selecting an alternative, [potential risk or consideration].
   ```

---

## 3. Scope Cutting
- Many features fail due to unexpected scope creep.
- Every `prd.md` MUST include an explicit **❌ Out of Scope** section:
   - Explicitly list edge cases or extensions the user might assume are included, but are agreed **not to be built in this iteration**.
   - This keeps focus strictly on the MVP (Minimum Viable Product) for rapid, reliable delivery.
