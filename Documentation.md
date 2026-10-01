# AssignmentAI — Documentation

> Last audited: 2026-10-01. Covers all of Phases 0–9 as built.
> Companion file: `Utilities.md` (every external dependency/service).

## 1. What this is

AssignmentAI is an **assignment compiler** for engineering practicals. A student enters
an **aim** (plus optional description/subject/experiment number/technology) and gets a
structured academic document out — previewable in the browser and exportable as
**DOCX, LaTeX, and PDF**.

Core rule: the **LLM generates content only** (JSON). **Templates control presentation.**
Formatting is deterministic and lives in renderers, never in prompts.

```
React (:5173)
  → Express API (:4000) — validation, orchestration, templates, rendering, jobs, auth
    → FastAPI AI service (:8001) — prompt → Qwen (or stub) → validate
      → Assignment JSON → HTML / DOCX / LaTeX → (container) → PDF
```

## 2. Repository map

| Path | Purpose |
|---|---|
| `src/` | Frontend: `App.jsx` workspace board; `pages/` + `lib/api.js` are unwired reference variants |
| `apps/api/src/index.js` | Express entry: helmet, CORS, logging, auth attach, static `/assets`, rate limit, route mounts, optional Mongo |
| `apps/api/src/routes/` | `assignments.js` (generate/get/list/html/regen/PUT/docx/latex/pdf), `templates.js` (CRUD + from-pdf), `examples.js` (ingest proxy), `jobs.js`, `auth.js`, `health.js` |
| `apps/api/src/lib/` | `aiClient.js` (AI calls), `subjects.js` (profiles), `templates.js` (seed loader), `templateStore.js` (versioning), `assignmentStore.js` (records), `queue.js` (jobs), `auth.js` (JWT), `storage.js` (files), `compile.js` (PDF) |
| `apps/api/src/render/` | `html.js` (50% rule lives here), `docx.js`, `latex.js` |
| `apps/api/src/models/` | Mongoose scaffolds: User, Tenant, Department, Subject, Template, Assignment, Generation, Document, Source, PromptVersion |
| `apps/api/src/templates/` | Tenant template seeds (TCET Computer Engineering v1) |
| `apps/api/assets/` | Tenant artwork (`tcet-header.png`, `tcet-watermark.png`); runtime `generated/`, `uploads/` (gitignored) |
| `services/ai-service/app/` | `main.py` (7 endpoints), `pipeline.py`, `schemas.py`, `prompts.py`, `subjects.py`, `validators.py`, `sections.py`, `search/`, `corpus.py`, `codecheck.py`, `sandbox.py`, `llm/` |
| `services/ai-service/corpus/` | Ingested examples (runtime data, gitignored) |
| `services/ai-service/tests/` | `test_phase{1,3,5,6,7,8}.py` (run directly with python) |
| `packages/shared/` | `assignment.schema.json` (canonical), `assignment.js` shapes, `subject-profiles.json` |
| `docker-compose.yml`, `Dockerfile`, `apps/api/Dockerfile`, `services/ai-service/Dockerfile` | Container setup (untested — no Docker on Windows host; use WSL Docker) |

## 3. Setup

Prerequisites: Node 22+, Python 3.12+, WSL2 with Docker Engine (for MongoDB now;
texlive/Redis later). No Docker Desktop needed.

```bash
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp services/ai-service/.env.example services/ai-service/.env
# MongoDB (once per Windows reboot):
wsl -- sudo service docker start
wsl -- docker run -d --name mongo --restart unless-stopped -p 27017:27017 -v mongodata:/data/db mongo:7
# After reboot: wsl -- sudo service docker start; wsl -- docker start mongo
```

Run (3 terminals, keep all open):

| # | Command | Port |
|---|---|---|
| 1 | `cd services/ai-service && python -m pip install -r requirements.txt && python -m uvicorn app.main:app --host 127.0.0.1 --port 8001` | 8001 |
| 2 | `cd apps/api && npm install && node src/index.js` | 4000 |
| 3 | `npm install && npm run dev` (repo root) | 5173 |

Open `:5173`. Health checks: `:8001/health`, `:4000/api/v1/health`
(`mongo: "configured"` means Mongo is connected; otherwise in-memory mode).

## 4. Environment variables

API (`apps/api/.env`): `PORT` (4000), `AI_SERVICE_URL` (http://127.0.0.1:8001),
`MONGODB_URI` (unset = in-memory), `RATE_LIMIT_PER_MIN` (60),
`JWT_SECRET` (set in production), `AUTH_REQUIRED` (`1` enforces tokens, default open),
`REDIS_URL` + `BULLMQ_ENABLED=1` (unset = in-process jobs), `PDF_COMPILE_CMD` (default `docker run … texlive…`;
on Windows-with-WSL-Docker use `wsl docker run --rm -v "$(wslpath '{dir}'):/work" -w /work texlive/texlive:latest …`).

AI (`services/ai-service/.env`): `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL`
(all three or stub mode), `PORT` (8001), `TAVILY_API_KEY` / `SEARXNG_URL`
(either activates research), `SANDBOX_DOCKER` (`docker`; bogus value = graceful skip).

Frontend (`.env`): `VITE_API_URL` (http://127.0.0.1:4000; baked at `vite build` time).
Login token persists in `localStorage` (`assignmentai_token`).

## 5. Generation pipeline (where each step lives)

1. Input validation — `apps/api/src/schemas.js` (`generateInputSchema`; aim mandatory)
2. Subject profile lookup — `lib/subjects.js` ← `packages/shared/subject-profiles.json`
3. Template lookup — `lib/templateStore.js` (requested id or active default)
4. Example retrieval — AI `corpus.retrieve_examples()` (style guidance only)
5. Research planning + web search + extraction — AI `search/research.py` (skipped unless the subject needs it AND a provider is configured; failures never break generation)
6. Context assembly — `pipeline.py` (research context + example shape appended, marked UNTRUSTED)
7. LLM generation — `llm/qwen.py` (OpenAI-compatible gateway) or `llm/stub.py` (clearly marked placeholder when unconfigured)
8. JSON extraction + Pydantic validation — `pipeline._extract_json`, `schemas.AssignmentContent`
9. Semantic validation — `validators.py` (no viva, sequential steps) + `codecheck.py` (sqlglot parse; failures raise → one retry)
10. API-side re-validation (zod) → record saved (memory always; Mongo best-effort) → response with `provenance` + `sources`

## 6. API reference (`/api/v1`)

- `GET /health` — service status, mongo state, AI URL
- `POST /auth/register|login` → `{token}`; `GET /auth/me` (Bearer)
- `POST /assignments/generate` → full record (sync)
- `GET /assignments` → history summaries; `GET /assignments/:id` → full record
- `POST /assignments/:id/regenerate-section` `{section, additionalInstructions?}` → updated record
- `PUT /assignments/:id` `{content}` → validated save (marks `editedByUser`)
- `GET /assignments/:id/html` → printable document (header + 50% watermark every page)
- `GET /assignments/:id/docx` → .docx download; `GET /:id/latex` → `{latex, edited}`; `PUT /:id/latex` → save override; `POST /:id/pdf` → compiled PDF or explicit 502
- `GET /templates`, `GET /templates/:id[?version=N]`, `POST /templates`, `PUT /templates/:id` (forks new version), `POST /templates/from-pdf`
- `POST /examples/ingest` (multipart PDF), `GET /examples?subject=&q=&k=`
- `POST /jobs` `{type:"generate", input}` → 202 `{job}`; `GET /jobs/:id` → status + assignment when done
- `GET /assets/*` — tenant artwork + generated PDFs

AI service: `GET /health`, `POST /v1/generate`, `POST /v1/regenerate-section`,
`POST /v1/ingest`, `GET /v1/examples`, `POST /v1/analyze-template`.
`sandbox.run_in_sandbox()` is intentionally **not** exposed over HTTP.

## 7. Data & templates

- Assignment record: `id, status, input, subjectProfile, template{id,version}, content, sources[], provenance{provider,model,promptVersion,validation,researchProvider}, createdAt/updatedAt, editedByUser?, latexOverride?`
- Templates are tenant **data**, never code. Seeds (`src/templates/*.json`) load as v1;
  `updateTemplate()` always forks a new immutable version; old versions stay readable,
  so historical assignments never change. Mongo `Template` upserts are best-effort.
- Watermark 50% rule: enforced in HTML (`WATERMARK_OPACITY`) and LaTeX
  (tikz node at exact page center, `opacity=0.5`). DOCX has no opacity flag — the PNG
  itself must be saved at 50% transparency (both PNGs are committed in `assets/`).
- Page frame + faculty table: every renderer draws a border on all sides and prints
  the static `facultyTable` ("For Faculty Use" / "Marks Obtained") last, flushed to
  the bottom (`\vfill` in LaTeX). Table content is template data — edit the seed or
  `PUT /templates/:id` (new version), never the code. No viva section is generated
  (product rule), regardless of sample layouts.
- Jobs: `pending → researching → generating → validating → completed/failed`
  (+ `rendering` reserved). In-process queue by default; BullMQ transport when
  `REDIS_URL` + `BULLMQ_ENABLED=1` is set (status map stays in-process — move to Redis/Mongo for multi-instance).
- Auth: bcrypt + JWT, open dev mode unless `AUTH_REQUIRED=1`.

## 8. Frontend (Jira-style workspace board)

Single-page board in `src/App.jsx` (no router): To Do / In Progress / Done columns
backed by `localStorage` (keys `…v2`; bump the suffix to invalidate stale shapes),
create modal (aim, subject, experiment, technology, difficulty, template dropdown
from `GET /templates`), detail drawer (metadata, sections, sources, preview iframe,
raw JSON), per-section editing + regeneration + save, LaTeX view/edit, DOCX/PDF/HTML
export with error surfacing, Templates manager (create + sample-PDF import),
server History (import records onto the board), Login (JWT stored and attached),
toasts, retry/delete. Every server call carries a
180s `AbortSignal` timeout so stalls become errors, never infinite spinners.

`src/pages/*` (router + Query + Monaco variants) are reference implementations kept
for reuse but currently unwired — nothing imports them.

## 9. Testing

```bash
cd services/ai-service && python tests/test_phase1.py  # also test_phase3/5/6/7/8.py
cd apps/api && npm test                                # 27 passing
```
Covered: schemas, viva rejection, regen, renderer, exports, SQL gate, sandbox/proven-fail paths,
templates/versioning, auth, queue. Live-verified (isolated ports): full generate→export chain,
jobs, ingest, template-from-PDF. Deliberately live-only (need runtimes): texlive compile success,
Redis/BullMQ transport, Mongo persistence, real search providers.

## 10. Security model

Never trusted: uploaded PDFs/templates, LLM text (HTML-escaped on render, LaTeX-escaped
on export), generated code (parsed, never executed on host; sandbox containers only,
network-isolated, capped), retrieved webpages (text-only, size-capped, scripts dropped,
marked UNTRUSTED in prompts). Enforced caps: 1MB JSON, 25MB uploads, 200KB LaTeX,
120s compile timeout. Helmet headers; CORS is open (`*`) for local dev — lock down in
production along with `JWT_SECRET`, `AUTH_REQUIRED=1`, and Redis rate limiting.

## 11. Troubleshooting

| Symptom | Cause → fix |
|---|---|
| `502 Generation failed: fetch failed` | AI service not running → start terminal 1; check `:8001/health` |
| Same, but health loads | Proxy env hijacking localhost → unset `HTTP_PROXY/HTTPS_PROXY` in API terminal, set `NO_PROXY=127.0.0.1,localhost` |
| `EADDRINUSE :4000/:8001` | Orphan from a dead session → find PID via `Get-NetTCPConnection -LocalPort 4000,8001` and `Stop-Process` it |
| Empty `{}` → 400 | Expected: aim is mandatory |
| PDF export 502 | No compiler (expected until texlive setup); error body carries the log tail |
| `opacity` looks wrong in Word | Expected: DOCX uses PNG-native transparency (see §7) |
| Board shows stale "default v1" template | Pre-template record in localStorage → clear site data (keys are now `…v2`) |
| History empties on restart | Expected without Mongo (memory store); set `MONGODB_URI` |

## 12. Known gaps (audit 2026-10-01; owner in brackets)

- [you] Pull texlive once (`docker pull texlive/texlive:latest` in WSL) + set `PDF_COMPILE_CMD` for Windows→WSL path mapping
- [you] Set `TAVILY_API_KEY` or `SEARXNG_URL` to activate research (silently skipped today)
- [you] Production secrets/CORS/rate-limit tightening when deploying (`JWT_SECRET`, `AUTH_REQUIRED=1`, CORS origins, Redis limiter)
- [me, next] Mongo-backed history/list (list reads memory today; restart wipes it even with Mongo connected) + persist regen/PUT/template edits to Mongo
- [me, next] Route-level tests for examples/jobs/auth/templates-from-pdf proxies (live-verified only)
- [me, next] `packages/shared` is load-bearing for nothing (profiles loaded by path) — either wire it as a real dependency or fold it
- [later] Qdrant embeddings behind `retrieve_examples()` (keyword retrieval is fine at current corpus size)
- [later] "Explain this assignment" tutoring UI (records already carry content + sources)
- [later] Full shadcn set (hand-rolled Button/Card/Input today), 404 page, frontend error boundaries, list pagination, AI request logging
- [later] `docker-compose.yml` needs real `.env` files present (only `.example`s are committed) and has never been run (no Docker on Windows host)
