# ProductPulse AI — REST API Documentation

Base URL: `/api`
Authentication: `Authorization: Bearer <token>` (HMAC-SHA256 signed token issued on login/registration/admin-claim).

## 1. Health & Auth
- `GET /api/health` — Returns `{ ok: true, service: "ProductPulse AI" }`.
- `GET /api/auth/status` — Returns `{ hasAdmin, envAdminPasscodeConfigured, geminiConfigured, currentUser }`.
- `POST /api/auth/claim-admin` — First-run admin account bootstrap (or verified via `ADMIN_PASSCODE`). Body: `{ email, name, password, adminPasscode? }`.
- `POST /api/auth/register` — Creates a standard user (`role: "user"`). Body: `{ email, name, password }`.
- `POST /api/auth/login` — Authenticates credentials and returns `{ token, user }`.

## 2. Administration & Audit Logs (Admin Role Required)
- `GET /api/admin/users` — Lists workspace users without password hashes.
- `PATCH /api/admin/users/:id/role` — Updates user role (`"admin" | "user"`).
- `GET /api/admin/audit-logs` — Returns latest 100 immutable audit records.

## 3. Product Overview & Analytics
- `GET /api/analytics/overview?days=7|14|30` — Computes KPIs, prior-period deltas, time series, and feedback distributions from SQLite.
- `POST /api/analytics/metrics` *(Auth)* — Upserts a live (`is_synthetic = 0`) daily metric snapshot.

## 4. Customer Feedback & AI Analysis
- `GET /api/feedback?search=&category=&status=&sentiment=` — Filterable feedback queue.
- `GET /api/feedback/insights` — Returns recurring complaint clusters, topic breakdown, extracted keywords, and automated summary.
- `POST /api/feedback` *(Auth)* — Submits feedback and runs Gemini (if configured) or local NLP classification.
- `POST /api/feedback/import-csv` *(Auth)* — Parses RFC-4180 CSV (`{ csvText }`), runs NLP analysis per row, and stores records atomically.
- `PATCH /api/feedback/:id` *(Auth)* — Updates `category`, `status`, or `rating`.
- `POST /api/feedback/:id/reanalyze` *(Auth)* — Re-runs NLP/Gemini classification on an existing record.
- `DELETE /api/feedback/:id` *(Admin)* — Deletes a feedback record.

## 5. Feature Prioritization (RICE) & Roadmap
- `GET /api/features` — Lists features ordered by manual override rank (if set) then descending RICE score.
- `POST /api/features` *(Auth)* — Creates proposal and computes `riceScore = (reach * impact * (confidence / 100)) / effort`.
- `PATCH /api/features/:id` *(Auth)* — Updates RICE inputs, roadmap status (`Backlog | Planned | In Progress | Testing | Released`), or manual override (requires `overrideReason`).
- `DELETE /api/features/:id` *(Admin)* — Removes a feature proposal.

## 6. A/B Testing & Experimentation
- `GET /api/experiments` — Lists experiments with calculated two-proportion z-test statistics (`pValue`, `zScore`, `ci95Low`, `ci95High`, `sampleAdequate`, `isSignificant`).
- `POST /api/experiments` *(Auth)* — Creates a new experiment.
- `PATCH /api/experiments/:id` *(Auth)* — Records visitor/conversion observations, status, and outcome notes.

## 7. Business Case & Pricing
- `GET /api/business-cases` — Lists modeled scenarios with live `MRR`, `ARR`, `LTV`, `LTV:CAC`, `CAC Payback`, `Break-Even Customers`, and `Annual ROI %`.
- `POST /api/business-cases` *(Auth)* — Creates a scenario assumption.
- `PATCH /api/business-cases/:id` *(Auth)* — Updates scenario assumptions.

## 8. UX Artifacts, PM Workspace, AI Assistant & Deliverables
- `GET /api/ux-artifacts`, `POST /api/ux-artifacts` *(Auth)*, `PATCH /api/ux-artifacts/:id` *(Auth)*
- `GET /api/pm-documents`, `POST /api/pm-documents` *(Auth)*, `PATCH /api/pm-documents/:id` *(Auth)*
- `POST /api/assistant/query` — Runs grounded PM AI Assistant (`Gemini 4 Hydrogen` or `Local Analytical Fallback`).
- `GET /api/deliverables` — Lists the 16 PM Deliverables and 4 Research Templates.
