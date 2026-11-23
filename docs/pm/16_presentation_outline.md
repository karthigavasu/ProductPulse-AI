# 16. Product Presentation Outline (PM Interview Walkthrough)

## Slide 1: Product Vision & Problem
- Why product teams struggle with disconnected feedback, subjective roadmaps, and underpowered A/B tests.

## Slide 2: Live Overview & Telemetry Architecture
- Walk through the 8 calculated KPIs, date filters (`7d`/`14d`/`30d`), and transparent synthetic vs live data labeling.

## Slide 3: Voice of Customer & Explainable AI
- Demonstrate CSV bulk upload + local deterministic NLP vs Gemini 4 Hydrogen, showing explicit reasoning behind every sentiment/topic classification.

## Slide 4: From Complaints to Prioritized Roadmap
- Convert a recurring complaint cluster into a RICE proposal (`(Reach × Impact × Confidence%) / Effort`), demonstrate an audited manual override, and move cards across the 5-stage Kanban & Milestone Timeline.

## Slide 5: Statistical Rigor & Business Case
- Contrast a statistically significant experiment (`p < 0.05`) with an underpowered pilot (`Insufficient Sample`), then adjust churn/CAC in the Business Case modeler to show live break-even sensitivity.

## Slide 6: Governance, RBAC & Engineering Quality
- Review Admin audit logs, automated Vitest test coverage, and architectural documentation.
