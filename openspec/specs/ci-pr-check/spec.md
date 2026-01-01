# ci-pr-check Specification

## Purpose
TBD - created by archiving change pr-check-github-action. Update Purpose after archive.
## Requirements
### Requirement: Workflow triggers on Pull Request events

The CI system MUST automatically trigger validation when a Pull Request is created or updated targeting the `main` branch.

#### Scenario: PR creation triggers workflow

**Given** a developer creates a Pull Request to `main`
**When** the PR is opened
**Then** the GitHub Actions workflow should automatically start

#### Scenario: PR update triggers workflow

**Given** a Pull Request exists targeting `main`
**When** new commits are pushed to the PR branch
**Then** the GitHub Actions workflow should automatically re-run

#### Scenario: Non-main branch PR ignored

**Given** a developer creates a Pull Request to a branch other than `main`
**When** the PR is opened
**Then** the workflow should NOT run (or may run optionally)

---

### Requirement: TypeScript compilation must pass

The CI workflow MUST verify that TypeScript code successfully compiles without errors.

#### Scenario: Valid code compiles

**Given** the workflow is running on a PR
**When** `npm run build` executes
**Then** the compilation step should succeed with exit code 0

#### Scenario: Invalid code fails compilation

**Given** the workflow is running on a PR with TypeScript errors
**When** `npm run build` executes
**Then** the compilation step should fail with a non-zero exit code

#### Scenario: Build artifacts not required

**Given** the workflow is running
**When** compilation succeeds
**Then** the dist/ output may be discarded (no upload needed for CI)

---

### Requirement: All unit tests must pass

The CI workflow MUST execute the full test suite and require all tests to pass.

#### Scenario: All tests pass

**Given** the workflow is running on a PR
**When** `npm test` executes
**Then** all tests should pass and the step should succeed

#### Scenario: Failing test blocks PR

**Given** the workflow is running on a PR with a failing test
**When** `npm test` executes
**Then** the step should fail and the workflow should mark the PR as failing

#### Scenario: No tests is acceptable

**Given** the project has no test files yet
**When** `npm test` executes with no tests
**Then** the step should succeed (test runner handles empty suites)

---

### Requirement: Code must pass linting rules

The CI workflow MUST enforce ESLint code quality rules.

#### Scenario: Clean code passes lint

**Given** the workflow is running on a PR
**When** `npm run lint` executes
**Then** the linting step should succeed with no errors or warnings

#### Scenario: Lint errors block PR

**Given** the workflow is running on a PR with ESLint errors
**When** `npm run lint` executes
**Then** the step should fail and display the linting issues

#### Scenario: Lint warnings may fail

**Given** the project is configured to treat warnings as errors
**When** linting finds code style issues
**Then** the step should fail to enforce code quality

---

### Requirement: Code must follow formatting standards

The CI workflow MUST verify that code matches Prettier formatting rules. When formatting issues are detected, the workflow SHOULD automatically fix them and commit the changes back to the PR branch.

#### Scenario: Formatted code passes check

**Given** the workflow is running on a PR
**When** the format check executes
**Then** properly formatted code should pass validation

#### Scenario: Unformatted code triggers auto-fix

**Given** the workflow is running on a PR with formatting issues
**When** Prettier check runs with `--check` flag and fails
**Then** the workflow should run Prettier with `--write` to fix formatting
**And** commit the changes back to the PR branch with a descriptive message

#### Scenario: Auto-fix commit appears in PR

**Given** formatting issues were auto-fixed
**When** the workflow completes
**Then** a new commit should appear in the PR from the GitHub Actions bot
**And** the commit message should indicate it was an automatic formatting fix

#### Scenario: Auto-fixed code passes on re-run

**Given** the workflow previously auto-fixed formatting
**When** the workflow re-runs after the auto-fix commit
**Then** the format check should pass without further modification

---

### Requirement: Workflow provides clear status feedback

The CI workflow MUST display pass/fail status directly on the Pull Request page.

#### Scenario: Success status displayed

**Given** all workflow steps pass
**When** the workflow completes
**Then** the PR page should show a green checkmark for the workflow

#### Scenario: Failure status displayed

**Given** any workflow step fails
**When** the workflow completes
**Then** the PR page should show a red X for the workflow with details

#### Scenario: In-progress status displayed

**Given** the workflow is currently running
**When** viewing the PR page
**Then** a yellow circle/indicator should show workflow is in progress

---

### Requirement: Workflow uses compatible Node.js version

The CI workflow MUST use Node.js version 18 or higher, matching the project's `engines` requirement.

#### Scenario: Node 18 is used

**Given** the workflow starts
**When** `actions/setup-node` runs
**Then** it should configure Node.js >=18.0.0

#### Scenario: Version matches package.json

**Given** `package.json` specifies `"node": ">=18.0.0"`
**When** the CI workflow runs
**Then** the Node version should satisfy this requirement

---

### Requirement: Workflow uses minimal permissions for auto-commit

When auto-fixing formatting, the CI workflow MUST use minimal GitHub token permissions to commit changes back to the PR branch.

#### Scenario: Contents write permission for PR branch

**Given** the workflow needs to commit formatting fixes
**When** the workflow is configured
**Then** it should request `contents: write` permission for the PR branch only

#### Scenario: Bot identity for commits

**Given** the workflow commits formatting fixes
**When** the commit is created
**Then** the commit author should be "github-actions[bot]"
**And** the commit message should include "[skip ci]" to avoid triggering another workflow run

#### Scenario: No permissions for other operations

**Given** the workflow is configured
**When** permissions are reviewed
**Then** the workflow should NOT have permissions for issues, PRs, or other repository operations

