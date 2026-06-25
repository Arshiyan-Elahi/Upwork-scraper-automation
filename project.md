# Upwork-AI-intelligence (AI-Upwork-Proposal)

**AI-Upwork-Proposal** is a personal **freelance opportunity intelligence platform** focused on Upwork job alerts. It ingests real job postings from a dedicated Gmail inbox, stores them in a local database, and presents them in a premium SaaS-style dashboard — with the long-term goal of scoring jobs, drafting proposals, and tracking pipeline outcomes using AI.

This is a **single-user local tool** today, built **cloud-ready** (env-based config, no hardcoded secrets, Postgres migration path later).

---

## Table of contents

1. [Goal and vision](#goal-and-vision)
2. [What you are trying to achieve](#what-you-are-trying-to-achieve)
3. [High-level architecture](#high-level-architecture)
4. [Technology stack](#technology-stack)
5. [Repository layout](#repository-layout)
6. [Current state vs planned](#current-state-vs-planned)
7. [Backend (FastAPI)](#backend-fastapi)
8. [Frontend (React + Vite)](#frontend-react--vite)
9. [Email ingestion pipeline](#email-ingestion-pipeline)
10. [Data: live API vs mock](#data-live-api-vs-mock)
11. [Safety and constraints](#safety-and-constraints)
12. [Environment configuration](#environment-configuration)
13. [Running the project](#running-the-project)
14. [API surface](#api-surface)
15. [Roadmap](#roadmap)

---

## Goal and vision

**Problem:** Upwork job alerts arrive by email. Manually reading every alert, judging fit, writing proposals, and tracking outcomes is slow and inconsistent.

**Goal:** Build a **read-only intelligence layer** that:

1. **Captures** job alerts automatically from a dedicated inbox  
2. **Structures** each job (title, budget, skills, client info, URL)  
3. **Scores** each job against your profile and portfolio *(planned)*  
4. **Recommends** apply / maybe / skip with clear reasoning *(planned)*  
5. **Drafts** tailored proposals *(planned)*  
6. **Tracks** pipeline from found → submitted → hired *(UI exists, mock data)*  

**Non-goals (explicit):**

- No Upwork login or browser automation  
- No auto-submitting proposals  
- No access to personal email — only one dedicated job-alert inbox  

---

## What you are trying to achieve

| Phase | Outcome | Status |
|-------|---------|--------|
| **1. Ingestion** | Gmail IMAP → parse Upwork alert emails → SQLite | **Done** |
| **2. View jobs** | Job Inbox + Email Sources wired to real backend | **Done** |
| **3. Auto-sync** | Background scheduler every N minutes | **Done** |
| **4. Intelligence** | Match score, verdict, score breakdown, portfolio match | **Planned** |
| **5. Proposals** | AI proposal drafts from job + profile + winning examples | **Planned (UI mock)** |
| **6. Analytics** | Reply rate, hire rate, revenue — from real pipeline data | **Planned (UI mock)** |
| **7. Deploy** | Run on VPS with Postgres, scheduled ingestion | **Future** |

**End state:** Open the dashboard, see new Upwork jobs within minutes of the alert email, know which ones to pursue, generate a strong proposal in one click, and track results over time — without ever giving the tool your Upwork password.

---

## High-level architecture

```text
┌─────────────────────────────────────────────────────────────────────────┐
│              React frontend (Vite, port 5173)                            │
│  Dashboard │ Job Inbox* │ Verdict queues │ Proposal Studio │ Analytics  │
│  Email Sources* │ Tracker │ Profile │ Portfolio │ Settings               │
│  * = live backend today; rest = mock data for now                        │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │ HTTP  VITE_API_URL → localhost:8000
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│              FastAPI backend (uvicorn, port 8000)                          │
│  GET /jobs │ GET /ingest/status │ POST /ingest/run │ GET /health         │
└───────┬─────────────────────────────┬───────────────────────────────────┘
        │                             │
        ▼                             ▼
┌───────────────┐            ┌────────────────────────────────────────────┐
│  SQLite       │            │  Gmail IMAP (read-only, dedicated inbox)      │
│  freelance.db │            │  Label: JOB_ALERT_LABEL (e.g. "Upwork Jobs")  │
│  jobs         │            └────────────────────────────────────────────┘
│  processed_   │
│  emails       │            Background: APScheduler → run_ingestion()
│  ingestion_   │            every INGEST_INTERVAL_MINUTES (default 5)
│  runs         │
└───────────────┘
```

**Ingestion flow:**

```text
Gmail (JobAlert emails)
  → gmail_client.py   (IMAP read-only fetch)
  → parser.py         (HTML/text → structured job fields)
  → normalizer.py     (map to Job model shape)
  → ingest.py         (dedup, store, record ProcessedEmail + IngestionRun)
  → GET /jobs         (frontend Job Inbox)
```

---

## Technology stack

### Frontend

| Layer | Choice |
|-------|--------|
| Framework | React 19 |
| Language | TypeScript (strict) |
| Build | Vite 6 |
| Routing | react-router-dom 7 |
| Styling | Tailwind CSS (design tokens in config) |
| Icons | lucide-react |
| Charts | recharts |
| State | React Context (`JobsContext`) |

**Not used:** MUI, Ant Design, heavy UI kits.

### Backend

| Layer | Choice |
|-------|--------|
| Framework | FastAPI |
| Server | Uvicorn |
| ORM | SQLAlchemy 2 |
| Database | SQLite (`freelance.db`) — Postgres-ready via `DATABASE_URL` |
| Config | pydantic-settings + python-dotenv |
| Email | imaplib (stdlib) + BeautifulSoup4 (HTML parsing) |
| Scheduler | APScheduler (background ingestion) |

**Not built yet:** LLM APIs, scoring engine, proposal generation on server.

---

## Repository layout

```text
AI-Upwork-Propsoal/
├── project.md              ← this file
├── frontend/               ← React dashboard (do not break mock pages when extending API)
│   ├── src/
│   │   ├── api/            ← client.ts, jobs.ts, ingest.ts (live backend)
│   │   ├── components/     ← ui/, jobs/, dashboard/, layout/, …
│   │   ├── context/        ← JobsContext (mock jobs + inboxJobs from API)
│   │   ├── mockData/       ← 15 sample jobs, analytics, portfolio, etc.
│   │   ├── pages/          ← 13 sidebar routes
│   │   ├── types/          ← shared TypeScript types
│   │   └── utils/
│   ├── .env.example        ← VITE_API_URL
│   └── package.json
└── backend/
    ├── app/
    │   ├── main.py         ← FastAPI app, CORS, lifespan, scheduler
    │   ├── config.py       ← settings from .env
    │   ├── db.py           ← engine, session, init_db
    │   ├── models.py       ← Job, ProcessedEmail, IngestionRun
    │   ├── schemas.py      ← Pydantic response models
    │   ├── routes/
    │   │   ├── jobs.py
    │   │   └── ingest.py
    │   └── ingestion/
    │       ├── gmail_client.py
    │       ├── parser.py
    │       ├── normalizer.py
    │       ├── ingest.py   ← run_ingestion() + CLI
    │       ├── stats.py
    │       └── scheduler.py
    ├── .env.example
    ├── requirements.txt
    ├── README.md
    └── freelance.db        ← created at runtime (gitignored)
```

---

## Current state vs planned

### Working today (real data)

- **Email ingestion** from dedicated Gmail via IMAP (read-only)
- **Automatic sync** every 5 minutes (configurable)
- **Manual sync** via Email Sources “Sync Now” or `POST /ingest/run`
- **Job Inbox** — `GET /jobs`, shows ingested jobs with “Unscored” badge
- **Email Sources** — `GET /ingest/status`, real counts and last sync
- **Job detail** from inbox — description, skills, client info from parsed email
- **Dedup** — by `job_url` or title+budget; emails by Message-ID

### UI built, still on mock data

- Dashboard metrics and recent jobs  
- Apply Queue / Maybe Jobs / Skipped Jobs (verdict filters)  
- Proposal Studio  
- Pipeline Tracker (kanban)  
- Profile Intelligence, Portfolio Library, Winning Proposals  
- Analytics, Settings  

### Not built yet

- Match scoring and apply/maybe/skip verdicts  
- Score breakdown radar chart from real logic  
- Portfolio matching  
- LLM proposal generation (backend)  
- Wiring verdict queues and tracker to real jobs  
- Postgres deployment, auth, multi-user  

---

## Backend (FastAPI)

### Database models

**Job** — one row per Upwork job extracted from email:

- `id`, `external_id` (Upwork `~…` from URL)
- `title`, `description`, `budget`, `budget_type` (`fixed` / `hourly` / `unknown`)
- `skills` (JSON array), `job_url` (unique when present)
- `posted_date`, `source` (default `email`), `raw_email_id`
- `client_rating`, `client_spend`, `client_country`, `payment_verified`
- `created_at`

**ProcessedEmail** — Message-ID dedup so the same email is never parsed twice.

**IngestionRun** — one row per ingestion attempt (manual or scheduled) for stats and `last_sync`.

### Key functions

- `run_ingestion(session)` — single entry point for CLI, API, and scheduler  
- `fetch_job_alert_emails()` — IMAP, label search with Upwork sender fallback  
- `parse_email(subject, body)` — defensive parser tuned to Upwork alert layout  

---

## Frontend (React + Vite)

### App name

`Upwork-AI-intelligence` (see `frontend/src/constants/branding.ts`)

### Sidebar routes (13)

| Route | Page | Data source |
|-------|------|-------------|
| `/` | Dashboard | Mock |
| `/job-inbox` | Job Inbox | **Live API** |
| `/jobs/:id` | Job detail | Live (inbox) or mock |
| `/apply-queue` | Apply Queue | Mock |
| `/maybe-jobs` | Maybe Jobs | Mock |
| `/skipped-jobs` | Skipped Jobs | Mock |
| `/proposal-studio` | Proposal Studio | Mock |
| `/tracker` | Pipeline Tracker | Mock |
| `/profile-intelligence` | Profile Intelligence | Mock |
| `/portfolio-library` | Portfolio Library | Mock |
| `/winning-proposals` | Winning Proposals | Mock |
| `/email-sources` | Email Sources | **Live API** |
| `/analytics` | Analytics | Mock |
| `/settings` | Settings | Mock |

### Frontend Job type vs backend

The UI expects rich fields (`matchScore`, `verdict`, `scoreBreakdown`, etc.). The API mapper (`src/api/jobs.ts`) sets scoring fields to `null` for ingested jobs and shows an **Unscored** verdict badge until intelligence is implemented.

---

## Email ingestion pipeline

### Gmail setup (your side)

1. Create or use a **dedicated Gmail inbox** for Upwork job alert forwards.  
2. In Google Account → Security → create an **App Password** for IMAP.  
3. Apply a Gmail label (e.g. `Upwork Jobs` / `Jobalert`) to incoming Upwork alerts.  
4. Put credentials in `backend/.env`.

### Parser assumptions

Upwork single-job alerts follow a line-based layout:

```text
Posted → Title → Hourly/Fixed-price → Budget → Description (…more) → Skills →
Payment verified → Rating → Spend → Country → View job details
```

Digest emails with multiple jobs are supported but less tested. Parser is defensive — missing fields become null, never crash.

### Dedup rules

- **Email:** skip if Message-ID exists in `processed_emails`  
- **Job:** skip if `job_url` already in DB; if no URL, match on `title + budget`  

---

## Data: live API vs mock

| Feature | Endpoint | Frontend page |
|---------|----------|---------------|
| List jobs | `GET /jobs` | Job Inbox |
| Ingestion stats | `GET /ingest/status` | Email Sources |
| Run ingestion | `POST /ingest/run` | Email Sources “Sync Now” |

Frontend base URL: `VITE_API_URL` (default `http://localhost:8000`).

---

## Safety and constraints

- **Read-only IMAP** — inbox opened with `readonly=True`; no delete/send.  
- **Single credential set** — only the dedicated inbox in `.env`; code never accepts alternate accounts.  
- **No Upwork automation** — no login, no apply button automation.  
- **Secrets** — `.env` gitignored; never commit Gmail app passwords.  
- **Local-first** — SQLite on disk; suitable for personal use on your PC or later a VPS.  

---

## Environment configuration

### Backend (`backend/.env`)

| Variable | Purpose | Default |
|----------|---------|---------|
| `DATABASE_URL` | SQLite path | `sqlite:///./freelance.db` |
| `GMAIL_ADDRESS` | Dedicated inbox | — |
| `GMAIL_APP_PASSWORD` | Gmail app password | — |
| `GMAIL_IMAP_HOST` | IMAP server | `imap.gmail.com` |
| `JOB_ALERT_LABEL` | Gmail label for alerts | `JobAlert` |
| `INGEST_INTERVAL_MINUTES` | Auto-sync interval | `5` |
| `CORS_ORIGINS` | Frontend dev URLs | `localhost:5173`, `5175` |

### Frontend (`frontend/.env`)

| Variable | Purpose | Default |
|----------|---------|---------|
| `VITE_API_URL` | Backend base URL | `http://localhost:8000` |

Copy from `.env.example` in each folder.

---

## Running the project

### Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows
pip install -r requirements.txt
copy .env.example .env          # then edit with Gmail credentials
uvicorn app.main:app --reload
```

- API: http://127.0.0.1:8000  
- Docs: http://127.0.0.1:8000/docs  

**One-shot ingestion (no server):**

```bash
python -m app.ingestion.ingest
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

- App: http://localhost:5173  

Both must run for Job Inbox and Email Sources to show live data.

---

## API surface

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | `{"status":"ok"}` |
| GET | `/jobs` | All jobs, newest first |
| GET | `/jobs/{id}` | Single job or 404 |
| GET | `/ingest/status` | Gmail connected, last sync, DB counts |
| POST | `/ingest/run` | Manual ingestion run → summary JSON |

**Ingest status response:**

```json
{
  "gmail_connected": true,
  "last_sync": "2026-06-15T11:44:53Z",
  "emails_scanned": 3,
  "jobs_extracted": 3,
  "failed_parses": 0,
  "duplicates_skipped": 0
}
```

`jobs_extracted` = jobs **currently in the database**.

---

## Roadmap

### Near term

- [ ] Job scoring service (niche match, budget, client quality, competition)  
- [ ] Persist verdicts on `Job` model; wire Apply/Maybe/Skip pages to API  
- [ ] Profile + portfolio upload for matching  
- [ ] Proposal generation endpoint (LLM) using winning proposal library  

### Medium term

- [ ] Pipeline stage updates persisted to backend  
- [ ] Analytics from real submission/hire data  
- [ ] Postgres + deploy to VPS with same scheduler  

### Long term

- [ ] Optional Apify/API job sources (types already include `apify`, `api`)  
- [ ] Multi-profile support for different niches  

---

## Summary

**Upwork-AI-intelligence** turns Upwork job alert emails into a structured job database and a polished dashboard. The **ingestion layer is live**; the **intelligence layer** (scoring, proposals, analytics) is the next major build. The frontend is ahead of the backend on UX — mock pages preview the full product while Job Inbox and Email Sources already run on real data.

**Project folder:** `C:\Users\ARSHIYAN-PC\Desktop\Cybrian-Qs\AI-Upwork-Propsoal`
