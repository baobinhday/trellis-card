# Technical Design: {{FEATURE_TITLE}}

**Status:** Draft
<!-- Lifecycle: Draft -> Approved -> Completed -->
**Topic Path:** `.trellis/research/{{FEATURE_SLUG}}/`  
**PRD Reference:** [prd.md](./prd.md)  

---

## 1. Architecture & Component Boundaries
- High-level overview of new or modified components.
- Data flow and interaction diagrams:

```
[Caller / UI] ──► [Service / Controller] ──► [Storage / State / External API]
```

---

## 2. Contracts & Interfaces

### 2.1. Schema & Data Models
```typescript
export interface ExampleDataModel {
  id: string;
  // Added fields and contracts
}
```

### 2.2. API & Function Signatures
```typescript
/**
 * Function description, inputs, and outputs
 */
export async function executeFeatureAction(param: string): Promise<Result>;
```

---

## 3. Alternatives Considered & Trade-offs
*(DeepSeek & Trellis discipline: Always state the strongest argument for a rejected option before rejecting it)*

### Option A: {{CHOSEN_APPROACH}} (CHOSEN)
- **Description:** Summary of the selected approach.
- **Why chosen:** Key benefits, fit with codebase patterns.
- **Trade-offs & Costs:** Known downsides or compromises accepted.

### Option B: {{REJECTED_APPROACH_1}} (REJECTED)
- **Description:** Alternative path evaluated.
- **Strongest argument for this option:** The most compelling reason someone would consider this.
- **Why rejected:** Root reason for not selecting (e.g., added complexity, heavy dependency, race conditions).

---

## 4. Compatibility, Migration & Rollback Strategy
- **Backward Compatibility:** Does this break existing consumers or serialized formats?
- **Key Risks:** Potential failure modes during execution.
- **Rollback Plan:** Steps to safely revert if critical issues emerge.
