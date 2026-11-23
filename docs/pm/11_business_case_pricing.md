# 11. Business Case and Pricing Model

> **Financial Modeling Notice**: All figures below represent modeled sensitivity assumptions for strategic planning, clearly distinguished from audited accounting actuals.

## Subscription Pricing Architecture
| Tier | Target Audience | Monthly Price | Assumed Churn | Modeled CAC | Gross Margin |
| --- | --- | --- | --- | --- | --- |
| Starter | Early-stage startup PMs | $49/mo | 4.5%/mo | $165 | 82% |
| Growth | Scaling mid-market product teams | $149/mo | 2.4%/mo | $540 | 84% |
| Enterprise | Multi-squad regulated orgs | $499/mo | 1.1%/mo | $2,400 | 86% |

## Core Unit Economics Formulas
- **MRR** = `Monthly Price × Active Paying Accounts`
- **LTV** = `(Monthly Price × Gross Margin%) / Monthly Churn%`
- **CAC Payback (Months)** = `CAC / (Monthly Price × Gross Margin% - Variable Cost/User)`
- **Break-Even Accounts** = `ceil(Fixed Monthly Operating Cost / Contribution per User)`
- **Annual ROI (%)** = `((ARR × Gross Margin% - Annual Operating & Acquisition Cost) / Annual Investment) × 100`
