# Tasks: Add PR Check GitHub Action

## Implementation Tasks

### 1. Create GitHub Actions workflow file
Create `.github/workflows/pr-check.yml` with:
- Trigger on `pull_request` events targeting `main` branch
- Job configuration using `ubuntu-latest` runner
- Node.js >=18.0.0 setup via `actions/setup-node@v4`
- npm dependency caching for performance
- Four sequential steps: build, test, lint, format check

**Validation**: Workflow file is valid YAML and follows GitHub Actions syntax

**Dependencies**: None

---

### 2. Configure auto-fix formatting
Set up a two-step formatting process:
1. First, run Prettier with `--check` flag to detect formatting issues
2. If check fails, run Prettier with `--write` to fix issues and commit back to PR

**Implementation**:
- Use conditional step in workflow (if format check fails)
- Configure git user for GitHub Actions bot
- Commit with message like "style: auto-fix formatting [skip ci]"
- Push changes back to PR branch using `GITHUB_TOKEN`

**Validation**: Workflow auto-fixes formatting and commits to PR branch

**Dependencies**: Task 1

---

### 3. Create spec delta for CI capability
Create `openspec/changes/add-pr-check-workflow/specs/ci-pr-check/spec.md` defining requirements for:
- Workflow triggers on PR events
- All quality checks must pass
- Clear failure reporting

**Validation**: Spec follows OpenSpec format with ADDED requirements and scenarios

**Dependencies**: None

---

### 4. Validate proposal
Run `openspec validate add-pr-check-workflow --strict` to ensure:
- All required files are present
- Proposal and tasks are properly formatted
- Spec deltas follow conventions

**Validation**: No validation errors; all checks pass

**Dependencies**: Task 3

---

### 5. Manual testing verification (post-apply)
After implementation, verify by:
1. Creating a test PR with formatting issues
2. Confirming workflow runs and auto-fixes formatting
3. Verifying the auto-fix commit appears in the PR
4. Confirming workflow passes after auto-fix

**Validation**: Workflow auto-fixes formatting issues and commits to PR

**Dependencies**: Task 1, 2

---

## Task Dependencies

```
Task 1 (Create workflow) ─┐
                        ├─> Task 5 (Manual test)
Task 2 (Format check)   ─┤
                        │
Task 3 (Spec delta) ────> Task 4 (Validate)
```

## Parallelizable Work

- **Task 1** and **Task 3** can be done in parallel
- **Task 2** must follow **Task 1**
- **Task 4** must follow **Task 3**
- **Task 5** must follow **Task 1** and **Task 2**

## Definition of Done

- [x] Workflow file created at `.github/workflows/pr-check.yml`
- [x] Auto-fix formatting configured with commit back to PR
- [x] Spec delta created for `ci-pr-check` capability
- [x] `openspec validate --strict` passes with no errors
- [ ] (Post-apply) Workflow runs successfully on a PR
- [ ] (Post-apply) Formatting issues are auto-fixed and committed
