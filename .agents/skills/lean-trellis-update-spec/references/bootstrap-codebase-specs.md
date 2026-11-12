# Bootstrapping Project-Specific Specs from Existing Codebase

Use this single-agent workflow when creating or refreshing `.trellis/spec/` guidelines for an existing (brownfield) repository. Start from the real codebase, then let the spec structure follow.

---

## 1. Repository Architecture Analysis

1. **Inspect existing `.trellis/spec/`**: Note which files are generic templates, outdated, or already project-specific.
2. **Inspect CodeGraph summary (if cached)**: If `.trellis/.runtime/codegraph.json` exists, run `lean-trellis graph summary` to quickly identify modules, top hub files, cross-language calls, and co-change clusters before scanning directories manually.
3. **Identify packages & runtime layers**: Read `package.json`, workspace configs, build scripts, and top-level docs to determine which code is CLI, backend, frontend, worker, shared library, or tooling.
4. **Trace real source & test files**: Read representative modules and tests directly before turning any observation into a spec rule.

### What to Capture

| Area | Questions to Answer from Code |
|------|-------------------------------|
| **Package boundaries** | What does each package/module own? Which imports cross boundaries? |
| **Core abstractions** | Which types, services, stores, commands, routes, or adapters define the system shape? |
| **Data flow** | Where does external input enter, how is it validated, and where does state persist? |
| **Error handling** | How are failures represented, logged, surfaced, and tested? |
| **Configuration** | Where do defaults, environment variables, generated files, and templates live? |
| **Testing conventions** | Which test files and mocking patterns are trusted examples for new work? |

---

## 2. Writing Source-Backed Spec Files

Every important rule in `.trellis/spec/` must be backed by evidence:
- A real source file that demonstrates the preferred local pattern.
- A real test file that shows expected behavior.
- A repeated convention across multiple files.

### Content Standards

Good spec sections include:
- **When the rule applies**
- **The local pattern to follow**
- **Reference files** (exact repo-relative paths proving the pattern)
- **Common mistakes or anti-patterns** found in old code or migrations
- **Verification commands** when specific and reliable

Avoid:
- Placeholder prose (`TODO: fill`, `To be filled`, template boilerplate)
- Generic framework tutorials that do not reflect this repository
- Long copied code blocks (prefer short snippets + file path references)

### Example Shape

```markdown
## Command / Service Handlers

Keep argument parsing, validation, and side effects separate. The local pattern is:
- Parse CLI flags or request payloads at the boundary.
- Convert raw inputs into typed options before invoking core logic.
- Keep filesystem/database writes in the service layer, not in pure helpers.

Reference files:
- `lib/installer.js`
- `bin/cli.js`

Avoid passing raw `process.argv` or unvalidated objects into shared utilities.
```

---

## 3. Final Verification Pass

Before reporting completion:
1. Ensure every new or updated spec file is linked in its corresponding `.trellis/spec/.../index.md`.
2. Delete or reshape non-applicable template sections.
3. Verify zero template placeholders remain:
   ```bash
   grep -rnE "To be filled|TODO: fill|placeholder" .trellis/spec/
   ```
