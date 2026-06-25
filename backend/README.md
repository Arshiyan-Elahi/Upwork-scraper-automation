# Upwork-AI-intelligence — Backend

FastAPI + SQLAlchemy + SQLite backend for job ingestion. Email parsing is not implemented yet.

## Prerequisites

- Python 3.11+

## Setup

```bash
cd backend

# 1. Create and activate a virtual environment
python -m venv .venv

# Windows
.venv\Scripts\activate

# macOS / Linux
# source .venv/bin/activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Configure environment
copy .env.example .env        # Windows
# cp .env.example .env        # macOS / Linux
# Edit .env if needed (defaults work for local dev)
```

## Run

From the `backend/` directory (with venv activated):

```bash
uvicorn app.main:app --reload
```

- API: http://127.0.0.1:8000
- Swagger docs: http://127.0.0.1:8000/docs

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check — returns `{"status":"ok"}` |
| GET | `/jobs` | List all jobs (newest first) |
| GET | `/jobs/{id}` | Get a single job by id |
| POST | `/ingest/run` | Fetch job-alert emails and ingest new jobs |
| POST | `/ingest/webhook` | Chrome extension push — ingest jobs with full descriptions |
| GET | `/ingest/status` | Real ingestion stats (DB-backed) |
| GET | `/profile` | Stored freelancer profile (or null) |
| PUT | `/profile` | Paste profile text → LLM extraction → store |
| POST | `/jobs/{id}/generate-proposal` | Run full proposal pipeline for a job |
| GET | `/generations` | List proposal generation runs |
| GET | `/generations/{id}` | Full generation run detail |
| GET | `/winning-proposals` | List winning proposal examples |
| POST | `/winning-proposals` | Add a winning proposal style reference |
| DELETE | `/winning-proposals/{id}` | Remove a winning proposal |

## LLM layer

Swappable providers behind `app/llm/router.py`:

| Method | Provider | Use case |
|--------|----------|----------|
| `analyze()` | Gemini | Structured JSON (profile extraction, scoring steps) |
| `generate()` | User-selected provider | Creative text (proposals, follow-ups) |

Supported generation providers: **gemini**, **groq**, **claude**, **openai**.

### User API keys (Settings UI)

Keys entered in the frontend Settings page are encrypted at rest with Fernet. Set a master key in `.env`:

```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

```env
ENCRYPTION_KEY=your-fernet-key-here
```

`ENCRYPTION_KEY` is required to **store** keys via `PUT /settings/llm-keys`. Without it, the app still starts; `.env` API keys continue to work as fallbacks.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/settings/llm` | Masked provider status + active generation provider |
| PUT | `/settings/llm-keys` | Encrypt and store `{ provider, api_key }` |
| DELETE | `/settings/llm-keys/{provider}` | Remove stored key |
| PUT | `/settings/llm-provider` | Set active generation provider |

### .env fallbacks (optional)

```env
GEMINI_API_KEY=your-gemini-api-key
GROQ_API_KEY=your-groq-api-key
ANTHROPIC_API_KEY=your-anthropic-api-key
OPENAI_API_KEY=your-openai-api-key
```

If no user key is stored for a provider, matching `.env` values are used automatically.

## Freelancer profile

Paste Upwork profile text; Gemini extracts niches, skills, services, strengths, ideal clients, writing tone, best-fit / avoid job types, headline, and summary.

```bash
curl -X PUT http://127.0.0.1:8000/profile \
  -H "Content-Type: application/json" \
  -d "{\"raw_text\": \"Your full Upwork profile text here...\"}"

curl http://127.0.0.1:8000/profile
```

Requires `GEMINI_API_KEY`. Returns `503` with a clear message if the key is missing.

## Proposal pipeline

Sequential Python pipeline (no LangGraph) for ingested jobs:

1. Extract requirements (Gemini)
2. Match profile (keyword heuristic, no LLM)
3. Detect red flags (Gemini)
4. Recommend bid + Connects spend (Gemini)
5. Generate 2–3 proposal variants (Groq → Gemini fallback, uses winning examples)
6. Score proposals (Gemini)
7. Generate 3-day follow-up (Groq → Gemini fallback)

```bash
# Requires PUT /profile first, and optional winning examples:
curl -X POST http://127.0.0.1:8000/winning-proposals \
  -H "Content-Type: application/json" \
  -d "{\"job_title\": \"Logo design\", \"text\": \"...\", \"niche\": \"branding\", \"outcome\": \"hired\"}"

curl -X POST http://127.0.0.1:8000/jobs/1/generate-proposal \
  -H "Content-Type: application/json" \
  -d "{\"n_variants\": 3}"

curl http://127.0.0.1:8000/generations
```

Each run writes a `GenerationLog` row with `PROMPT_VERSION`, providers used, latency, and full result JSON.

## Email ingestion

Requires valid `GMAIL_ADDRESS` and `GMAIL_APP_PASSWORD` in `.env` (dedicated inbox only).

**Automatic sync:** A background scheduler runs `run_ingestion()` every `INGEST_INTERVAL_MINUTES` (default 5). Started/stopped with the FastAPI app. Set `EMAIL_INGESTION_ENABLED=false` to disable the scheduler and manual email sync (`POST /ingest/run`); the Chrome extension webhook keeps working.

```bash
# Via API (server must be running)
curl http://127.0.0.1:8000/ingest/status
curl -X POST http://127.0.0.1:8000/ingest/run

# Via CLI (one-shot, no server needed)
python -m app.ingestion.ingest
```

Returns a summary: `emails_scanned`, `jobs_added`, `duplicates_skipped`, `parse_failures`, `errors`.

Ingestion opens the Gmail inbox **read-only** — nothing is modified on the mail server.
Already-processed emails (by Message-ID) and duplicate jobs (by URL or title+budget) are skipped.

## Chrome extension webhook

Push jobs from the Upwork Job Scraper extension with full descriptions (email alerts are often truncated).

```bash
curl -X POST http://127.0.0.1:8000/ingest/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "status": "success",
    "targetName": "My Search",
    "jobs": [{
      "title": "Logo design",
      "url": "https://www.upwork.com/jobs/~0123456789",
      "description": "Full job description from the extension...",
      "budget": "$500",
      "budget_type": "fixed",
      "skills": ["Logo Design"]
    }]
  }'
```

Returns `{ received, added, updated, duplicates_skipped, errors }`.

- New jobs are stored with `source='extension'`.
- If the same URL already exists (e.g. from email), fields are **updated** — longer descriptions win.
- Optional auth: set `WEBHOOK_SECRET` in `.env` and send header `X-Webhook-Secret`.

## Database

- SQLite file: `freelance.db` (created automatically on first startup)
- Tables: `jobs`, `processed_emails`, `ingestion_runs`, `profiles`, `winning_proposals`, `generation_logs`
- Configured via `DATABASE_URL` in `.env` (default `sqlite:///./freelance.db`)

## Project layout

```
backend/
  app/
    main.py       # FastAPI app, CORS, lifespan (creates tables)
    config.py     # pydantic-settings from .env
    db.py         # SQLAlchemy engine + session
    models.py     # Job, ProcessedEmail, IngestionRun ORM models
    models_profile.py  # Profile ORM model
    schemas.py    # Pydantic response models (jobs, ingest)
    schemas_profile.py  # Profile request/response schemas
    routes/
      jobs.py
      ingest.py
      profile.py  # GET/PUT /profile
    llm/
      base.py, gemini_client.py, groq_client.py, router.py
    intelligence/
      profile.py  # extract_profile()
    ingestion/
      gmail_client.py
      parser.py
      normalizer.py
      ingest.py      # run_ingestion() + CLI
  .env.example
  requirements.txt
```

## Safety

No auto-apply, no browser automation, no Upwork login. Email ingestion will be read-only IMAP when added.
