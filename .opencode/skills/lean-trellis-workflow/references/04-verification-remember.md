# Verification & Durable Memory Guide

Once implementation is complete, this phase verifies acceptance criteria and persists confirmed knowledge for future agent sessions.

---

## 1. Acceptance Criteria Verification
1. Open `prd.md` under **5. Acceptance Criteria**.
2. Verify that each criterion is satisfied in code and UI behavior.
3. Run the project test suite:
   ```bash
   npm test
   npm run check
   ```

---

## 2. Synchronize Completed Status
Once all tests pass and acceptance criteria are reconciled, explicitly update the document headers:
1. `prd.md`: Set `**Status:** Completed`
2. `design.md`: Set `**Status:** Completed`
3. `implement.md`: Set `**Status:** Completed`

This provides a definitive signal to Kanban observers (e.g. Trellis Card) to transition the task card to the `Done` lane.

---

## 3. Durable Knowledge & Journaling
1. **Durable Architectural Contracts**:
   - If new conventions or rules were established, record them into `.trellis/spec/` (e.g., `.trellis/spec/frontend/` or `.trellis/spec/backend/`).
   - Use the `lean-trellis-update-spec` skill.
2. **Session Journaling**:
   ```bash
   python3 ./.trellis/scripts/add_session.py \
     --title "Complete: <Feature Name>" \
     --commit "<commit-hash-or-->" \
     --summary "Summary of implementation, core architectural choices, and key takeaways" \
     --topic .trellis/research/<feature-slug>/prd.md
   ```
   If the user executed the recommended git commit prior to verification, pass the commit hash to `--commit`. Otherwise, use `-`.
   This command logs the completed session in `.trellis/workspace/<user>/index.md` and explicitly links to the feature's `prd.md`.
