# Proposal: Add PR Check GitHub Action

## Change ID
`pr-check-github-action`

## Status
**ExecutionCompleted**

## Overview

Add a GitHub Actions workflow to automatically validate pull requests through continuous integration checks. This workflow will run TypeScript compilation, unit tests, linting, and formatting checks on every PR targeting the `main` branch.

## Background

ducky-cli is a TypeScript/Node.js CLI tool for packaging game mods to NuGet. The project already has well-defined build scripts (`build`, `test`, `lint`, `format`) but lacks automated CI/CD enforcement. Code quality checks currently require manual execution by developers.

## Problem Statement

The current Pull Request workflow has several gaps:

1. **No automated validation** - PRs can be merged without verifying that code compiles or tests pass
2. **Code quality risk** - Lint errors or failing tests can be introduced unnoticed
3. **Manual verification burden** - Reviewers must manually run build commands to validate changes
4. **No CI feedback** - Developers don't get immediate feedback on build failures

## Proposed Solution

Create a GitHub Actions workflow file at `.github/workflows/pr-check.yml` that:

1. Triggers on `pull_request` events targeting the `main` branch
2. Sets up Node.js >=18.0.0 (matching `package.json` engines requirement)
3. Installs dependencies and runs all quality checks in sequence:
   - `npm run build` - TypeScript compilation
   - `npm test` - Vitest unit tests
   - `npm run lint` - ESLint code linting
   - `npm run format` - Prettier formatting with auto-fix and commit

### Technical Approach

- Use GitHub Actions with `actions/checkout@v4` and `actions/setup-node@v4`
- Run jobs on `ubuntu-latest` runner
- Cache `npm` dependencies for faster builds
- Fail the workflow if any check fails
- Workflow status appears directly on the PR page
- **Auto-format fix**: If formatting check fails, run Prettier with `--write` to fix issues and commit changes back to the PR branch using GitHub Actions bot

## Scope

### In Scope
- GitHub Actions workflow configuration file
- Automated TypeScript compilation check
- Automated test execution
- Automated linting
- Automated formatting validation with auto-fix and commit back to PR

### Out of Scope
- Branch protection rules (to be configured separately by repository maintainers)
- Code coverage reporting
- Release/deployment workflows
- Security scanning (Snyk, Dependabot, etc.)

## Impact Assessment

### Positive Impacts
- **Improved code quality** - CI blocks merges when compilation/tests/linting fail
- **Faster review cycle** - Automated checks reduce manual verification time
- **Immediate feedback** - Developers see build status directly on PR
- **Protected main branch** - Ensures `main` is always buildable and tested
- **Auto-format fix** - Formatting issues are automatically fixed and committed, reducing developer friction

### Risks & Mitigations
| Risk | Mitigation |
|------|------------|
| CI slows down PR workflow | Use npm caching; checks complete in ~1-2 minutes |
| False negatives from CI | Ensure consistent Node version and dependencies |
| Existing PRs fail | Can be addressed by updating PR or fixing issues identified |
| Auto-commit conflicts | Workflow only commits formatting fixes; no conflicts with code changes |
| Bot token permissions | Use minimal `contents: write` permission for PR branches only |

## Dependencies

### Prerequisite Changes
- None

### Related Specs
- This change creates a new spec: `ci-pr-check`
- No changes to existing CLI specs

## Success Criteria

1. Workflow triggers on all PRs to `main`
2. All four checks (build, test, lint, format) execute successfully on valid code
3. Failed PRs show clear workflow failure status
4. Build time completes within 3 minutes

## Open Questions

None - the proposal is straightforward and leverages existing npm scripts.

## Alternatives Considered

| Alternative | Reason for Rejection |
|-------------|---------------------|
| Use a third-party CI service (CircleCI, TravisCI) | GitHub Actions is free, integrated, and sufficient |
| Add code coverage gate | Adds complexity; can be added later if needed |
| Run on every push to any branch | PR-only is more efficient; avoids redundant runs |
| Use matrix testing across Node versions | Single version (18+) matches engines requirement |
