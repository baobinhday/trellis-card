# Implementation Plan: {{FEATURE_TITLE}}

**Status:** Planning
<!-- Lifecycle: Planning -> In Progress -> Verification -> Completed (or Blocked) -->
**PRD Reference:** [prd.md](./prd.md)  
**Design Reference:** [design.md](./design.md)  

---

## 1. Ordered Implementation Checklist
*(Execute directly in the active session: verify each step and tick `[x]` as progress is made)*

- [ ] **Phase 1: Types & Schema Foundation**
  - [ ] Define / update data interfaces in `path/to/types.ts`
  - [ ] Write scaffolding test fixtures
  - *Validation command:* `npm test` or equivalent

- [ ] **Phase 2: Core Domain Logic**
  - [ ] Implement core functions in `path/to/service.ts`
  - [ ] Cover boundary conditions (edge cases) identified in PRD
  - *Validation command:* `npx vitest run path/to/service.test.ts`

- [ ] **Phase 3: Integration & External Entry Points**
  - [ ] Connect domain logic to controllers / UI components
  - [ ] Handle error states and loading feedback
  - *Validation command:* `npm run build`

- [ ] **Phase 4: Full Verification & Cleanup**
  - [ ] Run full project test suite
  - [ ] Reconcile every Acceptance Criterion in `prd.md`

---

## 2. Verification Commands
```bash
# 1. Type check
npm run check

# 2. Automated test suite
npm test

# 3. Production build
npm run build
```

---

## 3. Risk Watchlist
*(Non-task reference watchlist. Use plain bullet points, never `- [ ]` checkboxes to prevent checklist confusion)*
- Watch file `path/to/sensitive/file.ts`: Maintain compatibility for dependent modules.
- Ensure credentials or secrets are not committed or exposed.
