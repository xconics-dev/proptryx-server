# GitHub Automation, Protection, and Dependency Update Guide

This project now includes GitHub automation for:
- dependency update bots (Dependabot)
- branch protection checks
- dependency risk review on dependency PRs
- stricter validation for Dependabot PRs

## Files Added

- `.github/dependabot.yml`
- `.github/workflows/branch-protection-checks.yml`
- `.github/workflows/dependency-review.yml`
- `.github/workflows/dependabot-validate.yml`
- `.github/workflows/pr-title-check.yml`

## What Each Automation Does

1. Dependabot (`.github/dependabot.yml`)
- Updates npm packages in workspace
- Updates GitHub Actions versions
- Updates Docker base image dependencies in each service
- Runs weekly

2. Branch Protection Checks (`branch-protection-checks.yml`)
- Runs on PRs and pushes to `main`
- Runs: install, lint, type-check, build
- Main required status check name: `quality-gate`

3. Dependency Review (`dependency-review.yml`)
- Runs on dependency PRs
- Fails PR for high-severity vulnerable changes
- Denies AGPL licenses

4. Dependabot Validation (`dependabot-validate.yml`)
- Runs only for Dependabot PRs
- Runs deeper validation: `pnpm check`, `pnpm type-check`, `pnpm build`

5. PR Title Validation (`pr-title-check.yml`)
- Enforces semantic PR titles (Conventional Commit style)
- Keeps PR history consistent with your commit-msg policy

## Configure Branch Protection in GitHub

In GitHub:
1. Open repository `Settings`.
2. Open `Branches`.
3. Add/edit branch protection rule for `main`.
4. Enable:
- Require a pull request before merging
- Require status checks to pass before merging
- Require branches to be up to date before merging
5. Mark these checks as required:
- `quality-gate`
- `semantic-pr-title`
- `dependency-review` (recommended)
- `validate-dependency-update` (recommended)

## Dependency Bump Commands

Use these root scripts from `package.json`:

- Check available updates everywhere (root + all workspaces):
```bash
pnpm deps:check
```

- Apply latest updates everywhere, then install:
```bash
pnpm deps:bump
```

These commands use `npm-check-updates` with workspace-aware flags.

## Recommended Update Workflow

1. Run:
```bash
pnpm deps:check
```
2. Run:
```bash
pnpm deps:bump
```
3. Validate locally:
```bash
pnpm check
pnpm type-check
pnpm build
```
4. Commit with a conventional message, for example:
```bash
git commit -m "chore(deps): bump workspace dependencies"
```
5. Push and open PR.

## Notes

- Dependabot PRs are validated automatically by workflows.
- `commit-msg` and `pre-commit` Husky hooks remain active locally.
