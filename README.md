# AssignmentAI — Phase 0 + Phase 1 (POC)

Assignment compiler: **React → Express → FastAPI → Qwen → validated Assignment JSON.**

> Scope guard (per product spec): Phase 1 is **only** the end-to-end POC.
> No web search, no RAG/vector DB, no fine-tuning, no DOCX, no PDF. Those land in Phases 2–9.

## Layout

| Path | What |
|---|---|
| `src/` (root Vite app) | Web frontend — Phase 1 aim form + structured result view |
| `apps/api/` | Node/Express primary backend, plain JavaScript (validation, orchestration, Mongoose scaffolds) |
| `services/ai-service/` | Python/FastAPI AI service (prompt → LLM → validate) |
| `packages/shared/` | Canonical `assignment.schema.json`, JS shape helpers, `subject-profiles.json` |
| `docker-compose.yml` | `web` + `api` + `ai-service` (needs Docker; not installed on this machine) |

> Stack note: the backend is plain JavaScript (no TypeScript toolchain) by project decision — `node src/index.js`, zero build step.

The LLM generates **content only**. Layout is owned by templates/renderers (Phases 2–4).

## Prerequisites

- Node 22+, Python 3.12+, MongoDB optional in Phase 1 (API runs in-memory without it)
- LLM gateway env (college-hosted OpenAI-compatible Qwen). **Without it the AI service uses a clearly-marked deterministic stub** so the pipeline still runs end to end.

## Configure

```bash
cp .env.example .env                                   # VITE_API_URL
cp apps/api/.env.example apps/api/.env                 # PORT, AI_SERVICE_URL, MONGODB_URI (optional)
cp services/ai-service/.env.example services/ai-service/.env   # LLM_BASE_URL, LLM_API_KEY, LLM_MODEL
```

## Run (local, 3 terminals)

```bash
# 1. AI service
cd services/ai-service && python -m pip install -r requirements.txt
python -m uvicorn app.main:app --host 127.0.0.1 --port 8001

# 2. API
cd apps/api && npm install && npm start   # :4000, in-memory mode unless MONGODB_URI set

# 3. Web
npm install && npm run dev                # :5173
```

Open `:5173`, enter e.g. **"Explore subqueries in SQL"** → structured JSON with
title / aim / objectives / theory / steps / conclusion (never viva questions).

## Tests

```bash
cd services/ai-service && python tests/test_phase1.py   # schema, viva rejection, stub pipeline
cd apps/api && npm test                                 # zod input + schema tests (6 passing)
```

## Verified on 2026-10-01 (Windows, no Docker, no gateway, no Mongo)

- AI-service tests pass; API tests 6/6 pass; `vite build` succeeds
- Live E2E: `POST /api/v1/assignments/generate` with `{aim, subject: DBMS, experimentNumber: 7}`
  → `status=completed`, 3 objectives, 3 steps, `provider=stub`; empty `{}` rejected with 400
- AI service ran with `provider=stub` because no gateway env was configured (expected)

## What remains (later phases)

- Phase 2: HTML renderer from Assignment JSON (same semantics as exports)
- Phase 3: editor + per-section regeneration
- Phase 4: DOCX / LaTeX → PDF (sandboxed compile)
- Phase 5: `SearchProvider` abstraction + source tracking
- Phase 6: ingest the 50–60 PDFs → structured examples → retrieval
- Phase 7: subject validators (SQL first; sandboxed execution only)
- Phase 8: Tenant/Department/Subject/Template CRUD + versioning + PDF→template draft flow
- Phase 9: Redis/BullMQ jobs, rate-limit hardening, file storage, observability
- Frontend: Tailwind/shadcn, TanStack Query, Hook Form, Monaco (Phase 2+)
