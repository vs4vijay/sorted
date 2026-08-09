# Sorted Recruiting

Sorted is an evidence-first AI screening workspace for Indian hiring teams, built for the Sarvam Building Hours Hackathon. It helps recruiters turn inbound CVs into evidence profiles, compare candidates against an approved position rubric, collaborate on shortlisting, and move qualified candidates toward recruiter screening through approved outreach.

The product stops at the interview boundary. It does not conduct interviews, schedule them, autonomously reject candidates, or send unapproved outreach.

## Current phase

Slice 0 of [`plan.md`](./plan.md) establishes the recruiting-oriented product shell and delivery foundations:

- Dashboard, Positions, Candidates, and Outreach routes
- Synthetic `Acme India` position, panel, and candidate fixtures
- Position and candidate detail layouts
- Persistent candidate-import entry point
- Typed fixture/service contracts with Zod validation
- Server-only environment validation
- Health and database-readiness endpoints
- Correlation IDs and structured log redaction
- Bun-based CI lint and production-build checks

All AI-labelled insight in this phase is explicitly marked simulated. No Sarvam API call, CV extraction, outreach delivery, or other external action occurs yet.

## Sarvam roadmap

- **Sarvam-105B** structures job descriptions into manager-approved rubrics in Slice 2, extracts evidence profiles in Slice 4, evaluates evidence against individual rubric criteria in Slice 5, and drafts approved outreach in Slice 7.
- **Saaras** supports reviewed multilingual recruiter voice notes in Slice 9.
- **Bulbul** provides opt-in multilingual audio versions of approved candidate messages in Slice 10.

Provider clients remain server-only and return normalized Sorted domain objects. Deterministic fake providers will cover tests and demos. Never put `SARVAM_API_KEY` in browser code or commit it to Git.

## Local development

Requirements: Bun and Node-compatible PostgreSQL tooling. Local development uses PGlite by default.

```bash
cp .env.example .env.local
bun install
bun run db:generate
bun run db:init
bun run dev:next
```

Open [http://localhost:7070](http://localhost:7070).

Store the rotated Sarvam credential only in `.env.local` when a Sarvam-backed slice is implemented:

```bash
SARVAM_API_KEY="your-rotated-server-only-key"
```

## Verification

```bash
bun run lint
bun run build
curl http://localhost:7070/api/health
curl http://localhost:7070/api/ready
```

Browser validation captures are stored in [`.images`](./.images).

## Architecture

Recruiting domain contracts, fixtures, and services live under `src/features/sorted`. Pages remain Server Components unless browser interactivity is required. Database-backed services will use parameterized SQL through `executeQuery()` and preserve PGlite/PostgreSQL compatibility.

See [`AGENTS.md`](./AGENTS.md) for engineering constraints and [`plan.md`](./plan.md) for vertical-slice delivery scope.
