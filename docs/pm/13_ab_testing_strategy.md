# 13. A/B Testing Strategy

## Hypothesis Structure
Every experiment must follow:
> *If we [specific product change], then [primary metric] will change by [expected direction] because [customer/behavioral rationale].*

## Statistical Guardrails
1. **Two-Proportion Z-Test**: Used to compare binary conversion rates between Control and Variant arms.
2. **Minimum Sample Adequacy**: Before reporting a p-value or significance badge, both arms must have `n >= 30` visitors and at least `5` expected conversions and `5` expected non-conversions under the pooled rate.
3. **Two-Tailed Alpha = 0.05**: Results with `p < 0.05` are flagged statistically significant alongside 95% confidence intervals for absolute lift.
4. **Zero Fabrication Policy**: Underpowered experiments display *"Insufficient Sample"* and recommend continuing data collection rather than declaring a winner.
