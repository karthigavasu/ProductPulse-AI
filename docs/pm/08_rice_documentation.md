# 08. RICE Scoring Documentation

## Mathematical Formula
$$\text{RICE Score} = \frac{\text{Reach} \times \text{Impact} \times (\text{Confidence} / 100)}{\text{Effort}}$$

## Governance & Manual Override Rules
1. **Never overwrite raw inputs**: When leadership adjusts priority manually, the original calculated RICE score remains visible.
2. **Mandatory rationale**: Any manual rank override requires a non-empty justification string stored in SQLite.
3. **Immutable Audit Trail**: Every RICE creation, input modification, and manual override records an entry in `audit_logs` with actor email, role, timestamp, and delta.
