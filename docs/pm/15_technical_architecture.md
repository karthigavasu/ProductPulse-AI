# 15. Technical Architecture Documentation

## Runtime Architecture
- **Frontend**: React 19, TypeScript, Tailwind CSS v4, Recharts, Lucide Icons, Vite bundler.
- **Primary Full-Stack Server (`server.ts`)**: Express REST API (`/api/*`) + Vite dev middleware on port 3000.
- **Database**: Relational SQLite (`node:sqlite` `DatabaseSync`) with versioned `schema_migrations`, foreign keys, and strictly parameterized SQL queries.
- **AI/ML & Analytics Engine**:
  - Local deterministic NLP (`server/nlp.ts`): lexicon + negation/intensifier sentiment scoring, TF keyword extraction, rule-based topic classification, and recurring complaint clustering.
  - Optional Gemini integration (`server/gemini.ts`): `@google/genai` SDK calling `gemini-4-hydrogen` server-side only when `GEMINI_API_KEY` is configured.
  - Statistical & Financial Engines (`server/stats.ts`): RICE scoring, two-proportion z-test, SaaS LTV/CAC/break-even calculations.
- **Companion Python Reference (`backend_fastapi/`)**: FastAPI + Pydantic + SQLAlchemy + Alembic reference implementation + Docker configuration (`Dockerfile`, `docker-compose.yml`).

## Security Controls
- `scrypt` password hashing with per-user 16-byte random salts and `timingSafeEqual` verification.
- HMAC-SHA256 Bearer tokens held in client memory (no `localStorage`/`sessionStorage` token persistence).
- First-run Admin bootstrap lock (`POST /api/auth/claim-admin`) or `ADMIN_PASSCODE` override.
- Immutable `audit_logs` table for key mutations and priority overrides.
