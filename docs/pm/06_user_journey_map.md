# 06. User Journey Map

| Stage | User Goal | Touchpoints | Potential Friction | Design Mitigation |
| --- | --- | --- | --- | --- |
| 1. Discovery | Evaluate platform fit quickly | Overview Dashboard, Synthetic Demo | Empty charts on first visit | Pre-seeded synthetic dataset clearly labeled as demo data |
| 2. Ingestion | Import existing customer feedback | Feedback Queue, CSV Importer | UTF-8 BOM or malformed CSV errors | RFC-4180 parser with BOM stripping & row-level error report |
| 3. Analysis | Identify recurring complaints | AI Insights Tab | Black-box AI tags without trust | Explicit lexicon/topic explanation on every single record |
| 4. Prioritization | Score & sequence features | RICE Engine, Roadmap Kanban | Executive overrides feel arbitrary | Preserved RICE score + mandatory audited override rationale |
| 5. Validation | Verify impact after release | A/B Testing Console | Misinterpreting tiny samples | Automatic sample adequacy check before reporting p-value |
