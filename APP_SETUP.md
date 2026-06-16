# Jarvis Electron App Setup

This file defines the non-code setup for the Jarvis desktop app.

## Purpose

`Jarvis` is the Electron + React + TypeScript desktop application.

This app is responsible for:

- desktop experience
- chat interface
- voice input controls
- report viewing
- report history
- user settings
- calling the Go backend APIs

## Current Scope

This repo is being prepared as the Electron app codebase only.

Implementation has not started yet.
This setup is only for structure and planning.

## Suggested Folder Structure

```text
Jarvis/
  docs/
  electron/
  public/
  src/
    components/
    features/
    hooks/
    layouts/
    lib/
    pages/
    services/
    store/
    styles/
    types/
  tests/
  README.md
  PRODUCT_SCAFFOLD.md
  APP_SETUP.md
```

## Planned Responsibilities

### `electron/`

Desktop shell responsibilities:

- Electron main process setup
- window management
- native desktop integration
- IPC bridge layer

### `src/components/`

Reusable UI building blocks.

### `src/features/`

Feature-level modules such as:

- chat
- reports
- voice
- settings
- auth

### `src/services/`

App-facing service layer for:

- backend API requests
- auth session handling
- file export triggers

### `src/store/`

Global client state if needed.

### `src/types/`

Shared TypeScript types for app-side models.

### `docs/`

Product, design, API, and architecture notes for the app side.

## Setup Principles

- keep the app UI-focused
- avoid backend business logic here
- keep AI orchestration on the Go backend
- keep the desktop client thin and reliable

## Next Setup Steps

1. Initialize Electron + React + TypeScript tooling
2. Choose state management strategy
3. Choose UI component/style approach
4. Define backend API contract
5. Add environment variable strategy

