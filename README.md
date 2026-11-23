# ProductPulse AI

**AI-Powered Product Analytics & Decision Intelligence Platform**

ProductPulse AI is a full-stack SaaS product management platform uniting product telemetry, explainable NLP feedback analysis, RICE prioritization, roadmapping, two-proportion z-test A/B experimentation, unit-economics modeling, UX journey templates, an AI Product Assistant, and RBAC audit governance.

---

## Key Capabilities
1. **Product Overview & Analytics**: 8 KPIs calculated from relational SQL (`node:sqlite`), interactive Recharts time-series, date window filters (`7d`, `14d`, `30d`), CSV export, and explicit separation of synthetic demo telemetry vs live snapshots.
2. **Customer Feedback & CSV Ingestion**: Searchable queue across 5 categories (`Feature Requests`, `Bug Reports`, `Usability Issues`, `Performance Issues`, `General Suggestions`) with RFC-4180 + UTF-8 BOM resilient CSV bulk import.
3. **Explainable AI Feedback Analysis**: Local deterministic NLP engine (lexicon + negation/intensifier scoring, keyword extraction, topic classification, recurring complaint clustering) plus optional server-side `Gemini 4 Hydrogen` enrichment via `@google/genai`.
4. **RICE Feature Prioritization & Roadmap**: Exact `RICE = (Reach × Impact × Confidence%) / Effort` computation, audited manual priority overrides, 5-stage Kanban board (`Backlog`, `Planned`, `In Progress`, `Testing`, `Released`), and Milestone Timeline view.
5. **A/B Testing & Experimentation**: Exact two-proportion z-test (`pValue`, `zScore`, `95% CI`) with strict sample adequacy guardrails—never fabricates statistical significance on underpowered pilots.
6. **Business Case & Pricing Analysis**: Interactive sensitivity calculator for MRR, ARR, LTV, CAC payback, break-even customers, and annual ROI.
7. **UX Journey & PM Workspace**: Editable templates for Personas, Journey Maps, Pain Points, User Stories, PRDs, OKRs, and Agile/Scrum MoSCoW planning.
8. **AI Product Assistant**: Summarizes feedback, explains analytics, drafts PRDs, generates user stories, and interprets RICE/experiment results using Gemini (when configured) or a grounded local analytical fallback.
9. **Security & Governance**: `scrypt` password hashing, HMAC-SHA256 Bearer tokens held in memory, first-run Admin bootstrap (`ADMIN_PASSCODE` override supported), RBAC (`admin` / `user`), and immutable audit logs.
10. **Portfolio Deliverables (`/docs/pm/`)**: 16 complete PM deliverables + 4 structured user research templates viewable directly inside the UI.

---

## Quick Start (Local Development)

### Prerequisites
- Node.js 22+ (`node:sqlite` built-in)
- npm 10+

### Setup & Run
```bash
npm install
npm run dev
```
The full-stack Express + Vite server starts on **http://localhost:3000** and automatically initializes `./data/productpulse.db` with the synthetic demonstration dataset on first run.

### Build & Production Start
```bash
npm run build
NODE_ENV=production npm start
```

### Verification & Automated Tests
```bash
npm run lint
npm test
```

---

## Environment Variables (`.env.example`)
- `GEMINI_API_KEY`: Optional server-side Gemini API key. When absent, local deterministic NLP and analytical assistant fallbacks operate seamlessly.
- `ADMIN_PASSCODE`: Optional server-side passcode for claiming admin access. Leave unset to use the first-run Admin claim flow in the UI.
- `DATABASE_PATH`: Optional SQLite path (defaults to `./data/productpulse.db`).

---

## Companion Python FastAPI + PostgreSQL Reference (`backend_fastapi/` & Docker)
For teams deploying in a Python + PostgreSQL stack, `backend_fastapi/` provides a companion FastAPI, Pydantic, SQLAlchemy, and Alembic schema/router layout alongside `Dockerfile` and `docker-compose.yml`.
