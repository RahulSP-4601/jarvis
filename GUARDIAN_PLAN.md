# Jarvis Guardian Plan

This document defines how we should implement the development guardian system for both codebases:

- `Jarvis` for the Electron app
- `jarvis-backend` for the Go backend

The goal is simple:

1. block bad commits locally
2. protect code quality and architecture
3. protect actual product behavior
4. run AI review after successful commits

## Core Idea

The guardian has two layers.

### Layer 1: Quality Guardian

This catches the obvious engineering mistakes before a commit is allowed.

Examples:

- type errors
- lint errors
- failing tests
- files that are too large
- functions that are too large
- missing formatting
- forbidden patterns

This is the equivalent of catching "dumb mistakes" before they land.

### Layer 2: Behavior Guardian

This checks whether the thing we are building still behaves correctly.

Examples:

- research pipeline still returns structured output
- report generator still returns required sections
- Electron app still renders key views
- backend APIs still satisfy expected contracts
- core workflows do not silently break

This protects real functionality, not just code style.

## Important Clarification About Claude

Claude can help us write and improve the guardian.

But the guardian itself should be deterministic shell scripts plus local tooling.

That means:

- Claude helps author rules
- hooks enforce rules
- commits are blocked by scripts and checks, not by manual judgment

This is important because commit hooks must be reliable and repeatable.

## High-Level Flow

The workflow should be:

1. make small changes
2. stage files
3. run `git commit`
4. pre-commit runs Quality Guardian
5. pre-commit runs Behavior Guardian
6. commit is blocked if either fails
7. if commit succeeds, run CodeRabbit on that commit
8. move to next task

## Hook Strategy

We should use Git hooks with this structure:

- `pre-commit` for local blocking checks
- `post-commit` for non-blocking AI review on the created commit

Why:

- `pre-commit` is correct for blocking
- `post-commit` is correct for review after commit exists

CodeRabbit should not block the commit unless we intentionally want a slower workflow.

For V1 team velocity, it is better to:

- block obvious issues before commit
- run AI review immediately after commit
- fix findings in the next commit

## Guardian Layout

Each repo should have its own guardian setup.

### In `Jarvis`

Suggested structure:

```text
.githooks/
  pre-commit
  post-commit

scripts/
  guardian.sh
  guardian-quality.sh
  guardian-behavior.sh
  guardian-limits.sh
```

### In `jarvis-backend`

Suggested structure:

```text
.githooks/
  pre-commit
  post-commit

scripts/
  guardian.sh
  guardian-quality.sh
  guardian-behavior.sh
  guardian-limits.sh
```

## What `guardian.sh` Should Do

`guardian.sh` should be the main entry point.

It should:

1. detect the repo type
2. run file/function size checks
3. run quality checks
4. run behavior checks
5. exit non-zero if anything fails

This gives us one command to run manually and one command for the hook to call.

Example usage:

```bash
./scripts/guardian.sh
```

## Shared Hard Rules

These rules should apply to both repos:

- max file size: 500 lines
- max function size: 50 lines
- no failing tests
- no broken formatting
- no broken type/language checks
- no committing secrets

These rules should be enforced automatically.

## Repo-Specific Checks

The checks should differ by repo.

## Guardian For `jarvis-backend`

This repo is Go, so the quality guardian should focus on Go tooling and architecture rules.

### Backend Quality Guardian

Recommended checks:

- `gofmt`
- `go vet`
- `staticcheck`
- `golangci-lint`
- unit tests
- file line limit
- function line limit
- forbidden direct dependencies in wrong layers

Examples of backend architectural protections:

- handlers should not contain heavy business logic
- AI provider code stays inside provider/service layers
- DB access stays inside data layer boundaries

### Backend Behavior Guardian

This should protect the actual backend workflows.

Recommended checks:

- API contract tests
- research pipeline smoke test
- report generation smoke test
- export workflow smoke test
- auth/session smoke test

Examples:

- can create a research task payload successfully
- report output includes required sections
- structured JSON responses still match contract

## Guardian For `Jarvis`

This repo is Electron + React + TypeScript, so the quality guardian should focus on TS safety, UI health, and desktop boundaries.

### App Quality Guardian

Recommended checks:

- `tsc --noEmit`
- ESLint
- Prettier check
- Vitest or equivalent unit tests
- file line limit
- function line limit
- forbidden import checks

Examples of app architectural protections:

- no backend logic inside UI components
- Electron-specific logic stays out of generic React components
- API access goes through service layer

### App Behavior Guardian

This should protect the real product flows.

Recommended checks:

- app shell renders
- chat workspace renders
- report detail view renders
- key user flows do not crash
- API client contracts remain valid

Examples:

- chat input accepts prompt and produces request object
- report preview renders required sections
- settings persist expected preference shape

## File And Function Limits

You specifically want:

- 500 line files max
- 50 line functions max

This is reasonable, but we should be practical about how we enforce it.

### File Limit

Easy to enforce with a shell script that scans tracked source files.

### Function Limit

Harder to enforce perfectly with shell alone.

Best approach:

- start with a heuristic script
- add language-specific AST-based checks where needed

For TypeScript:

- use ESLint complexity or max-lines-per-function rules

For Go:

- use `golangci-lint` plus function-length rules

This is better than trying to parse code with fragile regex only.

## CodeRabbit Integration

After a successful commit, we should trigger CodeRabbit against the exact commit.

Target behavior:

1. commit succeeds
2. `post-commit` gets the commit hash
3. CodeRabbit CLI reviews that commit
4. findings are shown locally or logged

Important note:

The exact CLI command depends on the installed CodeRabbit tool version.

So we should design the hook to call a wrapper script such as:

```bash
./scripts/coderabbit-review.sh
```

That wrapper should:

1. read `git rev-parse HEAD`
2. call the installed CodeRabbit CLI with that SHA
3. handle missing CLI gracefully

This is safer than hardcoding a tool command before we confirm the local installation details.

## Recommended Setup Sequence

We should implement this in order.

### Step 1

Add shared guardian docs and structure in both repos.

### Step 2

Set up Git hooks using `.githooks/` and `core.hooksPath`.

### Step 3

Implement `guardian-limits.sh` for:

- file size
- function size
- secret detection

### Step 4

Implement repo-specific `guardian-quality.sh`.

### Step 5

Implement repo-specific `guardian-behavior.sh`.

### Step 6

Add `post-commit` wrapper for CodeRabbit CLI review.

### Step 7

Tune the rules so they are strict but not annoying.

## Professional Standard

The guardian should help us move faster, not slower.

That means:

- fast checks in pre-commit
- deterministic output
- clear failure messages
- no vague AI-only blocking
- no giant scripts doing everything

We should keep the guardian modular and readable.

## What I Recommend Next

For the next implementation step, we should do only setup, not product code:

1. create `.githooks/` in both repos
2. create `scripts/guardian.sh` and companion script placeholders
3. define the exact commands for backend quality checks
4. define the exact commands for Electron quality checks
5. wire `post-commit` to a CodeRabbit wrapper script

That will give us a professional enforcement layer before heavy coding begins.
