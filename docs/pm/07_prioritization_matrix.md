# 07. Feature Prioritization Matrix (RICE + MoSCoW)

## Scoring Rubric
- **Reach**: Estimated unique users affected per quarter.
- **Impact**: `3.0` Massive, `2.0` High, `1.0` Medium, `0.5` Low, `0.25` Minimal.
- **Confidence**: `10%–100%` certainty based on evidence quality.
- **Effort**: Person-months across engineering, design, and QA.

## Representative Matrix (Seeded Demo Baseline)
| Initiative | Reach | Impact | Conf | Effort | RICE Score | MoSCoW | Target Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Persistent Workspace Filter State | 4100 | 1.0 | 95% | 0.5 | 7790.00 | Must Have | Released |
| Async Streaming CSV Export | 3200 | 2.0 | 90% | 1.5 | 3840.00 | Must Have | In Progress |
| UTF-8 BOM Resilient CSV Importer | 1600 | 1.0 | 95% | 0.4 | 3800.00 | Must Have | Released |
| Cohort Query Caching | 3800 | 2.0 | 85% | 2.0 | 3230.00 | Must Have | In Progress |
| Slack Experiment Alerts | 2600 | 1.0 | 90% | 0.75 | 3120.00 | Should Have | Testing |
| Executive PDF Snapshot | 2100 | 1.0 | 80% | 1.0 | 1680.00 | Could Have | Backlog |
| SAML 2.0 SSO & RBAC | 1400 | 3.0 | 85% | 3.0 | 1190.00 | Must Have | Planned (Override #2) |
| Jira Two-Way Sync | 1900 | 2.0 | 75% | 2.5 | 1140.00 | Should Have | Backlog |
