# 12. Product Analytics Measurement Plan

## North Star & Supporting KPIs
1. **North Star Metric**: Weekly Active Decision Cycles (workspaces reviewing analytics + triaging feedback or updating roadmap priorities).
2. **Acquisition & Activation**: New signups, Trial-to-Paid Conversion Rate (%).
3. **Engagement & Stickiness**: DAU, MAU proxy, DAU/Total Ratio, Composite Engagement Index (0–100).
4. **Retention & Satisfaction**: Day-30 Retention Rate (%), CSAT (1–5 scale), Feature Adoption (%).
5. **Voice of Customer**: Feedback volume by category, sentiment score trend (-1.0 to +1.0).

## Instrumentation Standards
- All telemetry timestamps stored in ISO-8601 UTC (`YYYY-MM-DD`).
- Synthetic demonstration rows explicitly marked `is_synthetic = 1` in SQLite.
- Live snapshots recorded via `POST /api/analytics/metrics` set `is_synthetic = 0`.
