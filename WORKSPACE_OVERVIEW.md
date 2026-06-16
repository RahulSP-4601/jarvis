# Jarvis Workspace Overview

This project is being split into two separate codebases.

## Repositories

### 1. `Jarvis`

Desktop application:

- Electron
- React
- TypeScript

Purpose:

- user-facing Jarvis experience
- chat UI
- voice UI
- report viewing and exports

### 2. `jarvis-backend`

Backend service:

- Go
- Supabase PostgreSQL
- Redis
- OpenAI
- Deepgram

Purpose:

- orchestration
- AI workflows
- research pipeline
- report generation
- persistence and exports

## High-Level Responsibility Split

### Jarvis app

- render UI
- collect user input
- display progress and outputs
- manage desktop-specific experience

### jarvis-backend

- handle APIs
- run research jobs
- generate reports
- manage data and storage integrations

## Working Style

We are intentionally setting up structure first.

Before feature coding, we should align on:

- repo structure
- naming conventions
- environment strategy
- deployment approach
- API boundaries

