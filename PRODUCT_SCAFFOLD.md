# Jarvis V1 Product Scaffold

This document turns the Jarvis vision into a practical V1 build blueprint.

Use this file as the product scaffold for design, engineering, prompting, and implementation decisions.

## V1 Product Definition

Jarvis V1 is an AI Chief of Staff for research and report creation.

The user gives Jarvis a request by text or voice, such as:

> Research AI receptionist startups and create a report.

Jarvis should:

1. Understand the task
2. Research the topic
3. Organize findings
4. Form opinions and recommendations
5. Generate a professional report
6. Save the output

V1 is not a general-purpose agent platform.
V1 is a focused research-to-report product.

## Core User Promise

The user should be able to go from idea to finished report in one conversation, in less than 5 minutes, without switching tools.

## Product Personality

Jarvis should feel like:

- intelligent
- sharp
- business-minded
- concise
- opinionated
- professional

Jarvis should not feel:

- robotic
- overly polite
- generic
- passive
- vague

## Main V1 Use Cases

### 1. Startup Research

Example:

> Research this startup idea and tell me if it is worth building.

### 2. Competitor Analysis

Example:

> Compare the top AI receptionist startups and create a competitor report.

### 3. Market Research

Example:

> Summarize the AI receptionist market, pricing trends, and gaps in the market.

### 4. Investment or Opportunity Review

Example:

> Research this market and tell me whether it looks attractive.

### 5. Structured Output Creation

Example:

> Create a report and save it as Markdown and PDF.

## Primary User Journey

### Step 1: User Input

The user submits a request using:

- voice
- text

### Step 2: Task Understanding

Jarvis identifies:

- the research topic
- the output type
- the depth required
- the language preference
- whether the user wants a saved document

### Step 3: Research Planning

Jarvis breaks the task into subtopics, for example:

- market overview
- top competitors
- pricing
- strengths and weaknesses
- opportunities
- risks

### Step 4: Research Collection

Jarvis gathers source material from the web and converts it into structured notes.

### Step 5: Analysis

Jarvis compares findings, identifies patterns, challenges assumptions, and forms recommendations.

### Step 6: Report Generation

Jarvis writes a polished output using a clear report format.

### Step 7: Save and Deliver

Jarvis shows the result in the app and lets the user save/export it.

## V1 Screens

These are the minimum screens/pages for V1.

### 1. Landing Page

Purpose:

- explain Jarvis clearly
- show example prompts
- drive the user into the app

Sections:

- headline
- short product explanation
- example use cases
- CTA to start

### 2. Chat Workspace

Purpose:

- main product experience
- text input and voice input
- show research progress
- display final answer and report

Core elements:

- conversation thread
- input box
- voice record button
- task status panel
- generated report preview
- save/export actions

### 3. Reports Page

Purpose:

- list all generated reports
- reopen previous outputs

Core elements:

- report cards or list
- title
- topic
- created date
- export options

### 4. Report Detail Page

Purpose:

- show full final output
- allow export or edit actions later

Core elements:

- report title
- structured report body
- source list
- export buttons

### 5. Settings/Profile Page

Purpose:

- manage user preferences

Core elements:

- name
- preferred language
- output defaults
- connected Google Docs status

## V1 Feature Modules

### Module 1: Conversation Interface

Requirements:

- text-first chat UI
- voice input button
- support follow-up questions
- show progress states during research

### Module 2: Voice Support

Requirements:

- speech-to-text input
- language-aware transcription
- text fallback always available

V1 note:

Text can be built first. Voice can be added once the core workflow is stable.

### Module 3: Research Engine

Requirements:

- search relevant web sources
- fetch source content
- extract important facts
- store structured notes
- rank useful findings

### Module 4: Analysis Engine

Requirements:

- identify key insights
- compare competitors
- identify gaps, risks, and opportunities
- generate recommendations

This is where Jarvis must feel like a Chief of Staff rather than a summarizer.

### Module 5: Report Generator

Requirements:

- use consistent templates
- generate executive summary
- generate detailed sections
- produce concise but useful outputs

### Module 6: Export and Save

Requirements:

- save in app
- export Markdown
- export text
- export PDF
- Google Docs integration if included in the first release

### Module 7: Memory

Requirements:

- store user profile
- store preferences
- store prior reports
- store project context for future requests

## Recommended V1 Information Architecture

### Core Objects

#### User

- id
- name
- email
- preferred_language
- created_at

#### Conversation

- id
- user_id
- title
- status
- created_at

#### Message

- id
- conversation_id
- role
- content
- language
- created_at

#### ResearchTask

- id
- conversation_id
- prompt
- topic
- status
- output_format
- created_at

#### Source

- id
- research_task_id
- title
- url
- source_type
- extracted_notes
- credibility_score

#### Report

- id
- research_task_id
- user_id
- title
- summary
- body_markdown
- export_pdf_url
- export_doc_url
- created_at

## Suggested App Structure

If we build this in Next.js, a simple V1 structure could look like this:

```text
/app
  /page.tsx
  /chat/page.tsx
  /reports/page.tsx
  /reports/[id]/page.tsx
  /settings/page.tsx
  /api/chat/route.ts
  /api/research/route.ts
  /api/reports/route.ts
  /api/export/route.ts

/components
  /chat
  /report
  /layout
  /voice

/lib
  /ai
  /research
  /reports
  /memory
  /export
  /db
  /utils
```

## Core API Responsibilities

### `/api/chat`

Handles:

- incoming user prompt
- context loading
- routing to research workflow

### `/api/research`

Handles:

- query planning
- search
- source retrieval
- extraction of structured findings

### `/api/reports`

Handles:

- report creation
- report retrieval
- report history

### `/api/export`

Handles:

- Markdown export
- text export
- PDF export
- Google Docs export when connected

## V1 Report Format

Each report should default to this structure:

1. Title
2. Executive Summary
3. Key Findings
4. Market Overview
5. Competitor Analysis
6. Risks and Weaknesses
7. Opportunities
8. Recommendations
9. Action Plan
10. Sources

## Core Prompting Rules

These rules matter for product quality.

Jarvis should:

- answer like a smart business partner
- give direct recommendations
- challenge weak assumptions
- avoid filler
- avoid generic chatbot language
- keep outputs structured
- prioritize usefulness over length

Jarvis should not:

- over-explain simple points
- hide behind neutral language
- give shallow summaries when analysis is needed

## V1 Workflow Logic

The main system flow should look like this:

1. Receive prompt
2. Detect research intent
3. Extract topic and output request
4. Build research plan
5. Run source discovery
6. Pull relevant source content
7. Generate structured notes
8. Run analysis and recommendations
9. Generate final report
10. Save report
11. Return result to user

## Build Order

This is the recommended order for implementation.

### Phase 1: Text-Only Core

Build first:

- landing page
- chat workspace
- text prompt input
- research pipeline
- report generation
- Markdown save

Goal:

Prove the research-to-report experience works.

### Phase 2: Report Persistence

Build next:

- database models
- report history
- report detail page
- saved conversations

Goal:

Make Jarvis feel like a real work product, not a one-time answer box.

### Phase 3: Exports

Build next:

- text export
- PDF export
- optional Google Docs export

Goal:

Turn Jarvis outputs into deliverables the user can actually use.

### Phase 4: Voice + Memory

Build after the core is working:

- speech-to-text
- language preference
- lightweight memory

Goal:

Increase convenience without harming reliability.

## V1 Non-Goals

Do not expand into these during V1:

- browser automation
- email sending
- calendar workflows
- general assistant actions
- CRM integrations
- coding workflows
- mobile apps
- multi-agent orchestration

## Product Success Checklist

Before calling V1 ready, confirm:

- the user can request research naturally
- the system understands the task correctly
- the output feels useful and professional
- the report includes recommendations
- exports work reliably
- the full flow completes quickly
- the product saves real time

## Engineering Checklist

### Frontend

- landing page
- auth flow
- chat UI
- report preview UI
- report history UI
- settings UI

### Backend

- prompt ingestion
- research orchestration
- source extraction
- report generation
- persistence
- export handling

### AI Quality

- system prompt for Jarvis tone
- research prompt templates
- report prompt templates
- evaluation prompts for output quality

### Data

- user storage
- conversation storage
- report storage
- source storage

## Suggested Deliverables For This Repo

As the project grows, the repo should include:

- `README.md` for product vision
- `PRODUCT_SCAFFOLD.md` for system and product structure
- `PRD.md` for detailed requirements
- `TASKS.md` for implementation tracking
- app code for the first prototype

## Final Principle

V1 should feel focused, fast, and valuable.

If a feature does not strengthen the core research-to-report workflow, it should wait.
