# Sorted

Sorted is a multilingual AI operations copilot for small and medium businesses. It understands customer conversations, highlights what needs attention, recommends repeatable workflows, and helps owners safely execute them.

Built for the **Sarvam Building Hours Hackathon**.

## The idea

Business owners often manage quotes, bookings, complaints, and follow-ups across fast-moving conversations. Important context remains trapped in chat threads, and repeated manual work is easy to miss.

Sorted turns every conversation into a simple progression:

```text
Understand → Decide → Execute
   Inbox     Dashboard   Workflows
```

All three product surfaces operate on the same underlying workflows:

- **Dashboard** answers “What needs my attention?”
- **AI Inbox** answers “What is happening in customer conversations?”
- **Workflows** answer “What will Sorted do, and what did it do?”

## Sarvam-powered experience

Sorted is designed to use:

- **Saaras Speech-to-Text** for multilingual voice messages and spoken commands
- **Sarvam-105B** for intent detection, fact extraction, response drafting, and natural-language workflow creation
- **Bulbul** for natural multilingual voice previews and customer responses

The current hackathon prototype simulates these boundaries in the UI. Real Sarvam API calls and real message delivery are the next integration phase.

## Current prototype

The app includes:

- Task-oriented business Dashboard
- Three-pane multilingual AI Inbox
- Intent, confidence, known facts, and missing facts
- Recommended actions and workflow opportunities
- Reusable workflow composer available across the product
- Visual workflow canvas
- Simulated workflow execution with node progress
- Human approval step
- Business-readable notifications and logs
- Responsive desktop and mobile layouts

### Demo scenario

1. Open Rahul Sharma’s WhatsApp conversation in AI Inbox.
2. Review the detected quote and booking intents.
3. See that the AC model and exact address are missing.
4. Create the suggested information-collection workflow.
5. Activate it and open Workflows.
6. Run the workflow for Rahul and watch its execution progress toward approval.

This demonstrates that Dashboard, Inbox, and Workflows are three views of one coherent system.

## Tech stack

- Bun
- Next.js 16 App Router
- React 19 and TypeScript
- Tailwind CSS 4
- Zod
- PGlite for local development
- PostgreSQL for production
- Prisma 6 for schema documentation and client generation
- PostgreSQL-backed job queue using `LISTEN/NOTIFY` and `SKIP LOCKED`

Sorted follows a Postgres-for-everything architecture: application data and background jobs share one persistence system, avoiding extra infrastructure during the hackathon.

## Getting started

### Requirements

- [Bun](https://bun.sh/) 1.x or newer
- PostgreSQL only if running the full worker-backed mode

### Install and run

```bash
git clone git@github.com:vs4vijay/sorted.git
cd sorted
bun install
bun run db:generate
bun run dev:next
```

Open [http://localhost:7070](http://localhost:7070).

The current UI prototype does not require database initialization. To exercise the inherited local persistence APIs, initialize PGlite with:

```bash
bun run db:init
```

Local database files are ignored by Git.

## Development modes

### UI and API development

```bash
bun run dev:next
```

Uses Next.js on port `7070`. PGlite is used when `DATABASE_URL` is absent or begins with `file:`.

### Full stack with worker

```bash
DATABASE_URL="postgresql://user:password@localhost:5432/sorted" bun run dev
```

This runs Next.js and the PostgreSQL-backed worker. See [DEV_MODES.md](DEV_MODES.md) for the starter runtime details that remain applicable.

## Useful commands

```bash
bun run dev:next      # Start the web application
bun run dev           # Start web and worker processes
bun run dev:worker    # Start only the worker
bun run db:generate   # Generate the Prisma client
bun run db:init       # Initialize the local PGlite database
bun run lint          # Run ESLint
bun run build         # Create a production build
```

## Architecture

```text
Next.js UI
  ├── Dashboard
  ├── AI Inbox
  └── Workflow composer, canvas, runs, and approvals
          ↓
Sorted domain and service layer
  ├── Conversation services
  ├── Workflow services
  ├── Fixture/simulation adapters
  └── Sarvam and channel adapters
          ↓
PGlite locally / PostgreSQL in production
          ↓
PostgreSQL-backed workflow jobs
```

Application database access goes through `executeQuery()` in `src/lib/db.ts` using parameterized raw SQL so the same queries work with PGlite and PostgreSQL. Prisma model methods are not the application query interface.

## Planned domain model

- Customers and conversations
- Messages, language, transcripts, and channel metadata
- Intents, extracted facts, and missing facts
- Suggested actions and workflow recommendations
- Workflow definitions, nodes, and edges
- Workflow runs and step histories
- Human approvals
- Notifications and dashboard statistics

## Delivery phases

### Phase 1 — UI and simulated execution

- Dashboard, AI Inbox, and Workflows
- Seeded multilingual conversations
- Simulated AI interpretation and workflow execution
- Human approval
- End-to-end demo coverage

### Phase 2 — real integrations

- Saaras transcription
- Sarvam-105B reasoning and workflow generation
- Bulbul voice generation
- WhatsApp or other customer channels
- Durable workflow execution and outbound delivery

The simulation and production implementations should satisfy the same domain interfaces so integration does not require rewriting the UI.

## Data safety

Do not commit:

- `.env` files or Sarvam credentials
- PGlite, SQLite, or PostgreSQL data files
- Customer exports or raw conversation archives
- Generated customer audio

Use `.env.example` for placeholder configuration only.

## Repository

This is a private hackathon repository maintained by `vs4vijay`.
