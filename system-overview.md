# Markly — System Overview

> The guided tour: what happens when you click things, where data lives, and
> which file to open when you want to change something. Deep API/prompt detail
> lives in `Documentation.md`; production topology in `deployment-notes.md`.

## 1. The big picture

```
BROWSER (Vercel build: marklyai.vercel.app)
  │  fetch, Bearer JWT                localStorage: Markly_token, board cards
  ▼
Caddy :443 (EC2 host, Let's Encrypt) ── reverse_proxy ──▶ API :4000 (localhost only)
                                                            │  Express, apps/api/src
                              ┌─────────────────────────────┼─────────────────────────────┐
                              ▼                             ▼                             ▼
                     AI service :8001 (internal)   MongoDB Atlas (users/history)   texlive container (PDF)
                     FastAPI → Qwen LLM                                          via host docker.sock
```

Local dev is the same shape with different addresses: Vite `:5173` →
API `127.0.0.1:4000` → AI `127.0.0.1:8001` → local Mongo or memory.

## 2. A click's journey — Generate

1. Board card form (`src/App.jsx`) collects aim/subject/experiment/template.
2. `apiPost('/api/v1/assignments/generate')` (`src/lib/api.js`, 180s timeout)
   with `Authorization: Bearer <Markly_token>`.
3. API validates (`apps/api/src/schemas.js`), looks up the subject profile
   (`lib/subjects.js` ← `packages/shared/subject-profiles.json`) and template
   (`lib/templateStore.js`), pulls style examples (AI corpus), optionally
   researches (Tavily/SearXNG — skipped unless configured AND the subject
   needs it).
4. AI service (`services/ai-service/app/pipeline.py`): builds prompt
   (`prompts.py`) → Qwen (`llm/qwen.py`, OpenAI-compatible) → extracts JSON →
   Pydantic validation (`schemas.py`) → semantic checks (`validators.py`,
   `codecheck.py` with sqlglot; one retry on failure).
5. API re-validates (zod), saves the record (memory always, Mongo
   best-effort), returns it with `provenance` (provider, model, promptVersion).
6. UI renders sections; heading for the steps list is **Steps**.

## 3. A click's journey — PDF download

1. `POST /api/v1/assignments/:id/pdf` → preflight (`checkCompiler`: is the
   texlive image present? if not, an explicit "pull it" 502 — never a hang).
2. Renderer (`render/latex.js`) turns content + template seed into `doc.tex`.
3. `compileLatexToPdf` (`lib/compile.js`) writes a temp dir under `$TMPDIR`
   and runs **two** pdflatex passes (tikz overlays need pass 2) in a one-shot
   `texlive/texlive:latest` container. In production `$TMPDIR` is
   `/opt/markly/data/tex`, bind-mounted at the same host path so the host
   dockerd can see it.
4. The PDF streams back (`application/pdf`) and a copy lands in
   `assets/generated/assignment-<id>.pdf`.
5. The compile command comes from `PDF_COMPILE_CMD`, with platform flavors:
   Windows dev uses `wsl docker … "{wslDir}"`, the server uses native
   `docker … "{dir}"`. Empty/unset falls back to the native default.

## 4. A click's journey — auth

Register/login (`routes/auth.js`, bcrypt + JWT) → `{token}` → browser stores
`Markly_token` (`lib/api.js`) and attaches it as `Bearer` on every call.
With `AUTH_REQUIRED=1` all data routes reject missing/invalid tokens (401).
Note: users live in server memory (Mongo mirror is write-only), so an API
restart means everyone logs in again.

## 5. Where state lives

| State | Where | Survives restart? |
|---|---|---|
| Board cards, token, UI prefs | Browser `localStorage` (`Markly_*`) | Yes (per browser) |
| Assignment records, users, templates | API process memory | **No** — restart wipes |
| Users (copy), assignments, templates | MongoDB Atlas `markly` | Yes (but list/history reads memory today) |
| Uploaded PDFs, generated PDFs, artwork | `apps/api/assets/` (+ `data/` in prod) | Yes (disk, gitignored) |
| Ingested examples | `services/ai-service/corpus/` | Yes (disk, gitignored) |
| Template versions | `templateStore` memory + Mongo upsert | Code seeds always re-load as v1 |

## 6. "I want to change X" cheat sheet

| Change | File(s) |
|---|---|
| Steps heading / section titles | `src/App.jsx`, `apps/api/src/render/{html,docx,latex}.js` |
| What the LLM is asked / output shape | `services/ai-service/app/prompts.py`, `schemas.py` |
| Subject behavior (needs research? tech?) | `packages/shared/subject-profiles.json` |
| PDF layout | `apps/api/src/render/latex.js` (+ `compile.js` for the command) |
| HTML preview layout, 50% watermark rule | `apps/api/src/render/html.js` |
| DOCX layout | `apps/api/src/render/docx.js` |
| Tenant template seed / faculty table | `apps/api/src/templates/*.json` |
| API routes / validation | `apps/api/src/routes/*.js`, `src/schemas.js` |
| Auth rules | `apps/api/src/routes/auth.js`, `lib/auth.js`, `AUTH_REQUIRED` |
| Timeouts (UI stalls) | `src/lib/api.js` (180s AbortSignal) |

## 7. Environments compared

| | Local dev | Production |
|---|---|---|
| Frontend | `npm run dev` :5173 | Vercel build, `VITE_API_URL` baked in |
| API | `node src/index.js` :4000 | container, `127.0.0.1:4000` behind Caddy |
| AI | `uvicorn …` :8001 | internal container, no public port |
| DB | local mongo / memory | Atlas (restart-safe for the copy) |
| PDF | WSL docker + texlive | host dockerd + texlive |
| HTTPS | none (http localhost) | Caddy + Let's Encrypt via nip.io |

## 8. Gotchas that already bit once

- Frontend env vars bake at **build** time — changing `VITE_API_URL` needs a
  cache-off redeploy, not just a save.
- Compose `restart` ignores `.env` changes — use `--force-recreate`; code
  changes need `--build`.
- Mongo passwords with `@ : / ? #` must be percent-encoded in the URI.
- An empty `PDF_COMPILE_CMD` now means "use default" (was: crash).
- API restart = everyone logged out (memory users) + in-memory history gone.
- PDF temp dirs under `data/tex/` accumulate — clean old ones if disk fills.
