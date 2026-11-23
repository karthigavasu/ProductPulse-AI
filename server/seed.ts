import type { DatabaseSync } from 'node:sqlite';
import { analyzeFeedbackLocal } from './nlp.js';
import { calculateRiceScore } from './stats.js';

export function seedDatabaseIfEmpty(db: DatabaseSync): void {
  const countRow = db
    .prepare('SELECT COUNT(*) as cnt FROM daily_metrics')
    .get() as { cnt: number };

  if (countRow.cnt > 0) {
    return;
  }

  const now = new Date('2026-11-23T12:00:00.000Z');
  const nowIso = now.toISOString();

  db.exec('BEGIN TRANSACTION;');
  try {
    // 1. Seed 30 days of synthetic product metrics
    const insertMetric = db.prepare(`
      INSERT INTO daily_metrics (
        date, total_users, active_users, new_users, retained_users,
        retention_rate, feature_adoption_rate, csat_score, engagement_score,
        conversion_rate, is_synthetic
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `);

    let totalUsers = 11420;
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setUTCDate(now.getUTCDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const dayIndex = 29 - i;
      const weekendDip = d.getUTCDay() === 0 || d.getUTCDay() === 6 ? -240 : 120;
      const newUsers = 42 + ((dayIndex * 7) % 28);
      totalUsers += newUsers;
      const activeUsers = Math.round(3250 + dayIndex * 34 + weekendDip);
      const retainedUsers = Math.round(activeUsers * (0.74 + (dayIndex % 5) * 0.006));
      const retentionRate = Number((73.8 + dayIndex * 0.14 + ((dayIndex % 3) - 1) * 0.3).toFixed(2));
      const featureAdoptionRate = Number((54.2 + dayIndex * 0.28 + ((dayIndex % 4) - 1.5) * 0.4).toFixed(2));
      const csatScore = Number((4.18 + dayIndex * 0.009 + ((dayIndex % 3) - 1) * 0.03).toFixed(2));
      const engagementScore = Number((68.4 + dayIndex * 0.24 + ((dayIndex % 5) - 2) * 0.6).toFixed(1));
      const conversionRate = Number((3.62 + dayIndex * 0.025 + ((dayIndex % 4) - 1.5) * 0.05).toFixed(2));

      insertMetric.run(
        dateStr,
        totalUsers,
        activeUsers,
        newUsers,
        retainedUsers,
        retentionRate,
        featureAdoptionRate,
        csatScore,
        engagementScore,
        conversionRate
      );
    }

    // 2. Seed synthetic customer feedback items across all 5 categories
    const seedFeedback: Array<{
      title: string;
      content: string;
      segment: string;
      category: string;
      status: string;
      rating: number;
      daysAgo: number;
    }> = [
      {
        title: 'CSV export times out on 50k+ rows',
        content: 'Whenever our analytics team exports quarterly retention tables above 50,000 rows, the request fails with a timeout after 30 seconds. Very frustrating during board prep.',
        segment: 'Enterprise',
        category: 'Performance Issues',
        status: 'Planned',
        rating: 2,
        daysAgo: 1,
      },
      {
        title: 'Love the clean RICE prioritization breakdown',
        content: 'The RICE scoring table is fast, clear, and super helpful for aligning engineering and product leads during sprint planning.',
        segment: 'Mid-Market',
        category: 'General Suggestions',
        status: 'Resolved',
        rating: 5,
        daysAgo: 2,
      },
      {
        title: 'Add Slack alerts when A/B test reaches significance',
        content: 'Would love a webhook or Slack integration so our growth team gets notified immediately when a running experiment hits p < 0.05.',
        segment: 'Mid-Market',
        category: 'Feature Requests',
        status: 'Under Review',
        rating: 4,
        daysAgo: 2,
      },
      {
        title: 'Cohort retention chart filters reset on tab switch',
        content: 'Bug report: switching from Analytics back to Overview clears my selected 14-day date filter and forces me to re-apply segments.',
        segment: 'Startup',
        category: 'Bug Reports',
        status: 'In Progress' === 'In Progress' ? 'Under Review' : 'New',
        rating: 2,
        daysAgo: 3,
      },
      {
        title: 'Onboarding checklist feels cluttered on smaller laptops',
        content: 'New analysts find the initial navigation layout confusing on 13-inch screens. Labels overlap slightly and finding the CSV import button takes too many clicks.',
        segment: 'SMB',
        category: 'Usability Issues',
        status: 'New',
        rating: 3,
        daysAgo: 4,
      },
      {
        title: 'Support SAML SSO for enterprise workspaces',
        content: 'Security requires SAML SSO and role-based permissions before we can onboard 40 additional business analysts.',
        segment: 'Enterprise',
        category: 'Feature Requests',
        status: 'Planned',
        rating: 4,
        daysAgo: 5,
      },
      {
        title: 'Dashboard loading lag when switching to 90-day range',
        content: 'Rendering multi-series charts feels slow and laggy when comparing 90-day retention curves. Improving query speed would save us minutes every morning.',
        segment: 'Enterprise',
        category: 'Performance Issues',
        status: 'Under Review',
        rating: 2,
        daysAgo: 6,
      },
      {
        title: 'Smooth experiment calculator saved hours of spreadsheet work',
        content: 'Reliable two-proportion z-test calculation with clear sample adequacy warnings. Great improvement over manual spreadsheets.',
        segment: 'Mid-Market',
        category: 'General Suggestions',
        status: 'Resolved',
        rating: 5,
        daysAgo: 7,
      },
      {
        title: 'Mobile table view clips conversion rate column',
        content: 'On mobile browsers the experimentation comparison table cuts off the right-most conversion column unless you scroll carefully.',
        segment: 'Startup',
        category: 'Usability Issues',
        status: 'New',
        rating: 3,
        daysAgo: 8,
      },
      {
        title: 'Jira two-way sync for planned roadmap items',
        content: 'Please add Jira synchronization so features moved to In Progress on the roadmap automatically create linked engineering epics.',
        segment: 'Mid-Market',
        category: 'Feature Requests',
        status: 'Planned',
        rating: 4,
        daysAgo: 9,
      },
      {
        title: 'CSV import throws silent error on UTF-8 BOM headers',
        content: 'Files exported from Excel with a UTF-8 BOM fail to match the title column and crash the import preview.',
        segment: 'SMB',
        category: 'Bug Reports',
        status: 'Resolved',
        rating: 2,
        daysAgo: 10,
      },
      {
        title: 'Excellent break-even and LTV sensitivity model',
        content: 'Adjusting churn and CAC assumptions immediately updates break-even customers and payback months. Very clear for founder reviews.',
        segment: 'Startup',
        category: 'General Suggestions',
        status: 'Resolved',
        rating: 5,
        daysAgo: 12,
      },
      {
        title: 'PDF export for monthly executive product review',
        content: 'Allow exporting the Overview dashboard and roadmap milestones as a formatted executive report for monthly stakeholder meetings.',
        segment: 'Enterprise',
        category: 'Feature Requests',
        status: 'New',
        rating: 4,
        daysAgo: 14,
      },
      {
        title: 'Search bar does not match partial topic keywords',
        content: 'Searching for "auth" fails to return items tagged with "authentication" or "SSO". Partial prefix matching would make triage faster.',
        segment: 'Mid-Market',
        category: 'Usability Issues',
        status: 'Under Review',
        rating: 3,
        daysAgo: 15,
      },
      {
        title: 'Slow bulk reclassification on 200+ feedback rows',
        content: 'Batch tagging feedback takes 12 seconds and freezes the table scroll until completion.',
        segment: 'Enterprise',
        category: 'Performance Issues',
        status: 'New',
        rating: 2,
        daysAgo: 18,
      },
      {
        title: 'API webhook audit log details are very helpful',
        content: 'Having immutable audit entries for RICE priority overrides makes governance reviews seamless and reliable.',
        segment: 'Enterprise',
        category: 'General Suggestions',
        status: 'Resolved',
        rating: 5,
        daysAgo: 20,
      },
    ];

    const insertFeedback = db.prepare(`
      INSERT INTO feedback_items (
        title, content, customer_segment, category, status, rating,
        sentiment, sentiment_score, keywords_json, topics_json,
        analysis_method, analysis_explanation, is_synthetic, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'local-nlp', ?, 1, 'synthetic-seed@productpulse.local', ?, ?)
    `);

    for (const item of seedFeedback) {
      const analysis = analyzeFeedbackLocal(item.title, item.content, item.rating);
      const created = new Date(now);
      created.setUTCDate(now.getUTCDate() - item.daysAgo);
      const iso = created.toISOString();
      insertFeedback.run(
        item.title,
        item.content,
        item.segment,
        item.category,
        item.status,
        item.rating,
        analysis.sentiment,
        analysis.sentimentScore,
        JSON.stringify(analysis.keywords),
        JSON.stringify(analysis.topics),
        analysis.explanation,
        iso,
        iso
      );
    }

    // 3. Seed synthetic feature proposals (RICE + Roadmap)
    const seedFeatures: Array<{
      title: string;
      description: string;
      category: string;
      reach: number;
      impact: number;
      confidence: number;
      effort: number;
      override: number | null;
      overrideReason: string;
      moscow: string;
      status: string;
      initiative: string;
      targetDate: string;
      milestone: string;
      sprint: string;
      owner: string;
    }> = [
      {
        title: 'Async Streaming CSV & Parquet Export',
        description: 'Move large analytics exports (>10k rows) to background streaming jobs with progress tracking to eliminate 30s timeouts.',
        category: 'Performance',
        reach: 3200,
        impact: 2,
        confidence: 90,
        effort: 1.5,
        override: null,
        overrideReason: '',
        moscow: 'Must Have',
        status: 'In Progress',
        initiative: 'Platform Reliability',
        targetDate: '2026-12-12',
        milestone: 'Q4 Reliability Release',
        sprint: 'Sprint 14',
        owner: 'Backend Platform Squad',
      },
      {
        title: 'SAML 2.0 SSO & Granular RBAC',
        description: 'Enterprise identity federation with role-based permissions for Admin, PM, and Analyst roles.',
        category: 'Enterprise Security',
        reach: 1400,
        impact: 3,
        confidence: 85,
        effort: 3.0,
        override: 2,
        overrideReason: 'Required contractual blocker for 3 enterprise renewals in Q4.',
        moscow: 'Must Have',
        status: 'Planned',
        initiative: 'Enterprise Readiness',
        targetDate: '2027-01-18',
        milestone: 'v2.1 Enterprise Gate',
        sprint: 'Sprint 15',
        owner: 'Identity Squad',
      },
      {
        title: 'Slack & Webhook Experiment Alerts',
        description: 'Real-time notifications when A/B experiments cross sample adequacy and p < 0.05 thresholds.',
        category: 'Integrations',
        reach: 2600,
        impact: 1,
        confidence: 90,
        effort: 0.75,
        override: null,
        overrideReason: '',
        moscow: 'Should Have',
        status: 'Testing',
        initiative: 'Growth Loop Automation',
        targetDate: '2026-12-04',
        milestone: 'Q4 Growth Drop',
        sprint: 'Sprint 14',
        owner: 'Growth Squad',
      },
      {
        title: 'Persistent URL & Workspace Filter State',
        description: 'Preserve selected date windows and customer segments across Analytics, Overview, and Feedback tabs.',
        category: 'Usability',
        reach: 4100,
        impact: 1,
        confidence: 95,
        effort: 0.5,
        override: null,
        overrideReason: '',
        moscow: 'Must Have',
        status: 'Released',
        initiative: 'Core UX Polish',
        targetDate: '2026-11-15',
        milestone: 'v2.0 Core Launch',
        sprint: 'Sprint 13',
        owner: 'Frontend Core',
      },
      {
        title: 'Jira Two-Way Roadmap Synchronization',
        description: 'Sync Planned and In Progress ProductPulse initiatives directly to Jira Epics and Sprint statuses.',
        category: 'Integrations',
        reach: 1900,
        impact: 2,
        confidence: 75,
        effort: 2.5,
        override: null,
        overrideReason: '',
        moscow: 'Should Have',
        status: 'Backlog',
        initiative: 'Ecosystem Integrations',
        targetDate: '2027-02-10',
        milestone: 'Q1 Ecosystem Release',
        sprint: 'Sprint 16',
        owner: 'Integrations Team',
      },
      {
        title: 'Executive PDF & Board Deck Snapshot',
        description: 'One-click printable brief combining Overview KPIs, top RICE items, and concluded experiment summaries.',
        category: 'Reporting',
        reach: 2100,
        impact: 1,
        confidence: 80,
        effort: 1.0,
        override: null,
        overrideReason: '',
        moscow: 'Could Have',
        status: 'Backlog',
        initiative: 'Executive Reporting',
        targetDate: '2027-02-24',
        milestone: 'Q1 Ecosystem Release',
        sprint: 'Sprint 17',
        owner: 'Analytics UI',
      },
      {
        title: 'Cohort Query Caching & Indexed Rollups',
        description: 'Pre-aggregate 30-day and 90-day retention metrics to reduce P95 dashboard latency below 180ms.',
        category: 'Performance',
        reach: 3800,
        impact: 2,
        confidence: 85,
        effort: 2.0,
        override: null,
        overrideReason: '',
        moscow: 'Must Have',
        status: 'In Progress',
        initiative: 'Platform Reliability',
        targetDate: '2026-12-19',
        milestone: 'Q4 Reliability Release',
        sprint: 'Sprint 14',
        owner: 'Data Engineering',
      },
      {
        title: 'UTF-8 BOM Resilient CSV Importer',
        description: 'Normalize BOM headers, quoted newlines, and flexible column mapping during customer feedback imports.',
        category: 'Data Ingestion',
        reach: 1600,
        impact: 1,
        confidence: 95,
        effort: 0.4,
        override: null,
        overrideReason: '',
        moscow: 'Must Have',
        status: 'Released',
        initiative: 'Core UX Polish',
        targetDate: '2026-11-10',
        milestone: 'v2.0 Core Launch',
        sprint: 'Sprint 13',
        owner: 'Ingestion Squad',
      },
    ];

    const insertFeature = db.prepare(`
      INSERT INTO features (
        title, description, category, reach, impact, confidence, effort,
        rice_score, manual_priority_override, override_reason, moscow_priority,
        roadmap_status, initiative, target_release_date, milestone, sprint, owner,
        is_synthetic, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    `);

    for (const f of seedFeatures) {
      const rice = calculateRiceScore(f.reach, f.impact, f.confidence, f.effort);
      insertFeature.run(
        f.title,
        f.description,
        f.category,
        f.reach,
        f.impact,
        f.confidence,
        f.effort,
        rice,
        f.override,
        f.overrideReason,
        f.moscow,
        f.status,
        f.initiative,
        f.targetDate,
        f.milestone,
        f.sprint,
        f.owner,
        nowIso,
        nowIso
      );
    }

    // 4. Seed synthetic A/B experiments
    const insertExp = db.prepare(`
      INSERT INTO experiments (
        name, hypothesis, metric_name, status,
        control_name, control_visitors, control_conversions,
        variant_name, variant_visitors, variant_conversions,
        outcome_notes, next_step_recommendation, is_synthetic, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    `);

    insertExp.run(
      'Guided 3-Step Onboarding Flow',
      'Replacing the open blank workspace with a guided 3-step checklist will increase Day-1 activation rate.',
      'Day-1 Activation Rate',
      'Concluded',
      'Control (Blank Workspace)',
      4200,
      1176,
      'Variant B (Guided Checklist)',
      4180,
      1388,
      'Observed consistent +5.2 percentage point lift across SMB and Mid-Market cohorts without increasing time-to-first-chart.',
      'Ship Variant B to 100% of new workspaces and monitor 14-day retention.',
      nowIso,
      nowIso
    );

    insertExp.run(
      'Annual Billing Toggle Default on Pricing Page',
      'Defaulting the pricing matrix to annual billing with transparent savings breakdown will lift annual plan share.',
      'Annual Checkout Conversion',
      'Running',
      'Monthly Default',
      1850,
      89,
      'Annual Default',
      1840,
      106,
      'Interim observation window active; monitor until 2,500 visitors per arm.',
      'Hold rollout until full sample target is reached.',
      nowIso,
      nowIso
    );

    insertExp.run(
      'AI Feedback Auto-Tagging Banner',
      'Surfacing inline NLP topic explanations next to new feedback rows will increase triage completion rate.',
      'Triage Completion Rate',
      'Running',
      'Standard Table Row',
      28,
      9,
      'Inline Topic Explanation',
      26,
      12,
      'Early internal pilot only; sample size is below statistical adequacy threshold.',
      'Continue collecting observations before drawing any statistical conclusion.',
      nowIso,
      nowIso
    );

    // 5. Seed Business Case & Pricing Scenarios (labeled as assumptions)
    const insertBiz = db.prepare(`
      INSERT INTO business_scenarios (
        name, tier_name, monthly_price, estimated_customers,
        monthly_churn_pct, cac, gross_margin_pct, fixed_monthly_cost,
        variable_cost_per_user, notes, is_assumption, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    `);

    insertBiz.run(
      'Starter Self-Serve Assumption',
      'Starter ($49/mo)',
      49,
      420,
      4.5,
      165,
      82,
      8500,
      4.5,
      'Modeled PLG baseline for early-stage startup product teams (assumption, not actual ledger data).',
      nowIso,
      nowIso
    );
    insertBiz.run(
      'Growth Team Plan Assumption',
      'Growth ($149/mo)',
      149,
      260,
      2.4,
      540,
      84,
      14000,
      9.0,
      'Core mid-market SaaS tier assuming 5 seats and automated feedback integrations.',
      nowIso,
      nowIso
    );
    insertBiz.run(
      'Enterprise Annualized Assumption',
      'Enterprise ($499/mo)',
      499,
      65,
      1.1,
      2400,
      86,
      19500,
      24.0,
      'High-touch enterprise model including SAML SSO, audit logs, and dedicated onboarding.',
      nowIso,
      nowIso
    );

    // 6. Seed Editable UX & Journey Templates (explicitly labeled as editable templates)
    const insertUx = db.prepare(`
      INSERT INTO ux_artifacts (type, title, subtitle, content_json, status, is_template, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 1, ?, ?)
    `);

    insertUx.run(
      'persona',
      'Persona Template A: Maya — Growth Product Manager',
      'B2B SaaS · 50–250 employees · Editable Template',
      JSON.stringify({
        goals: [
          'Synthesize weekly NPS and support tickets without manual spreadsheet tagging',
          'Defend roadmap trade-offs to leadership with transparent RICE scores',
        ],
        frustrations: [
          'Feedback scattered across Slack, CSV exports, and support tools',
          'Unclear whether A/B experiments have sufficient sample size before shipping',
        ],
        toolsUsed: ['ProductPulse AI', 'Jira', 'Slack', 'Figma'],
        notes: 'Replace template fields with findings from actual customer interviews.',
      }),
      'Template',
      nowIso,
      nowIso
    );
    insertUx.run(
      'persona',
      'Persona Template B: Devon — Senior Product Analyst',
      'Mid-Market Analytics · Data-Focused · Editable Template',
      JSON.stringify({
        goals: [
          'Track DAU/MAU stickiness, cohort retention, and conversion trends by segment',
          'Audit statistical significance and confidence intervals on live experiments',
        ],
        frustrations: [
          'Stakeholders misreading noisy short-term conversion spikes as wins',
          'Slow bulk data exports during quarterly executive reviews',
        ],
        toolsUsed: ['SQL', 'ProductPulse AI', 'Python', 'Looker'],
        notes: 'Editable research template; do not treat placeholder attributes as empirical field data.',
      }),
      'Template',
      nowIso,
      nowIso
    );

    const journeyStages = [
      {
        stage: '01. Discovery & Evaluation',
        subtitle: 'User Goal: Assess analytics & feedback consolidation fit',
        touchpoints: 'Product overview, interactive demo workspace, pricing calculator',
        emotions: 'Curious, cautious about setup overhead',
        opportunities: 'Provide synthetic demo dataset clearly separated from live data',
      },
      {
        stage: '02. Onboarding & Data Ingestion',
        subtitle: 'User Goal: Import first feedback CSV and connect metrics',
        touchpoints: 'CSV importer, schema validator, automatic NLP tagging',
        emotions: 'Focused; frustrated if encoding/header errors occur',
        opportunities: 'UTF-8 BOM resilience and inline column preview',
      },
      {
        stage: '03. Insight & Prioritization',
        subtitle: 'User Goal: Turn recurring complaints into scored RICE items',
        touchpoints: 'AI Insights clusters, RICE scoring table, MoSCoW workspace',
        emotions: 'Empowered when scores align with team intuition',
        opportunities: 'One-click conversion of recurring complaint clusters into feature proposals',
      },
      {
        stage: '04. Experimentation & Rollout',
        subtitle: 'User Goal: Validate hypothesis before full engineering commitment',
        touchpoints: 'A/B testing console, z-test significance calculator, Roadmap Kanban',
        emotions: 'Confident when statistical power and caveats are explicit',
        opportunities: 'Automated sample adequacy warnings and audit trail',
      },
    ];

    for (const j of journeyStages) {
      insertUx.run(
        'journey_stage',
        j.stage,
        j.subtitle,
        JSON.stringify({
          touchpoints: j.touchpoints,
          emotions: j.emotions,
          opportunities: j.opportunities,
        }),
        'Template',
        nowIso,
        nowIso
      );
    }

    insertUx.run(
      'pain_point',
      'Pain Point Template: Fragmented Feedback Triage',
      'High Frequency · Discovery & Analysis Stage',
      JSON.stringify({
        severity: 'High',
        affectedSegment: 'Product Managers (Editable)',
        workaround: 'Manual copy-pasting from Intercom/CSV into spreadsheets',
        proposedMitigation: 'Unified CSV import + transparent local NLP topic clustering',
      }),
      'Template',
      nowIso,
      nowIso
    );

    insertUx.run(
      'user_story',
      'US-101: Triage & Categorize Imported CSV Feedback',
      'Sprint 14 · Must Have · Template Story',
      JSON.stringify({
        asA: 'Product Manager',
        iWant: 'to upload a CSV of customer feedback and automatically classify sentiment and topics',
        soThat: 'I can quantify recurring bugs and feature requests in minutes',
        acceptanceCriteria: [
          'Supports UTF-8 CSV with title, content, category, and rating columns',
          'Displays transparent explanation for every automated sentiment classification',
          'Allows manual category and status overrides persisted to SQLite',
        ],
      }),
      'Ready',
      nowIso,
      nowIso
    );

    insertUx.run(
      'user_story',
      'US-102: Override RICE Priority with Mandatory Rationale',
      'Sprint 14 · Should Have · Template Story',
      JSON.stringify({
        asA: 'Product Lead',
        iWant: 'to record a manual priority override alongside a written justification',
        soThat: 'executive stakeholders understand strategic exceptions during roadmap reviews',
        acceptanceCriteria: [
          'System preserves calculated RICE score alongside manual rank',
          'Writes an immutable audit log entry capturing actor, rank, and reason',
        ],
      }),
      'In Progress',
      nowIso,
      nowIso
    );

    // 7. Seed PM Workspace Documents
    const insertDoc = db.prepare(`
      INSERT INTO pm_documents (doc_type, title, status, moscow, sprint, owner, content, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertDoc.run(
      'prd',
      'PRD-01: Unified Feedback Intelligence & RICE Bridge',
      'Approved',
      'Must Have',
      'Sprint 14',
      'Lead Product Manager',
      `## Problem Statement\nProduct teams lose 4–6 hours weekly manually tagging customer feedback before sprint prioritization.\n\n## Goals & Success Metrics\n- Reduce triage cycle time by >= 50%\n- Maintain transparent explainability for all automated NLP classifications\n\n## Scope\n1. CSV bulk ingestion with validation\n2. Deterministic local NLP + optional Gemini 4 Hydrogen enrichment\n3. Direct link from complaint clusters to RICE feature proposals`,
      nowIso,
      nowIso
    );
    insertDoc.run(
      'goal',
      'Q4 OKR: Improve Day-30 Retention & Enterprise Readiness',
      'Active',
      'Must Have',
      'Q4 2026',
      'VP of Product',
      `## Objective\nStrengthen core workflow reliability and governance so mid-market and enterprise teams standardize on ProductPulse AI.\n\n## Key Results\n- KR1: Raise 30-day cohort retention from 74% to 78%\n- KR2: Eliminate >30s export timeouts via async streaming\n- KR3: Ship SAML SSO & full RBAC audit logging`,
      nowIso,
      nowIso
    );
    insertDoc.run(
      'strategy',
      'Product Vision & FY27 Decision Intelligence Strategy',
      'Active',
      'Must Have',
      'FY27',
      'Head of Product',
      `## Vision\nBecome the single source of truth connecting customer voice, empirical product telemetry, RICE prioritization, and statistical experimentation.\n\n## Strategic Pillars\n1. Evidence-linked roadmaps (every initiative tied to feedback + analytics)\n2. Honest statistics & explainable AI (never black-box hype)\n3. Executive business case clarity (LTV, CAC, break-even visibility)`,
      nowIso,
      nowIso
    );
    insertDoc.run(
      'sprint_note',
      'Sprint 14 Planning & Release Readiness Notes',
      'In Progress',
      'Must Have',
      'Sprint 14',
      'Scrum Master',
      `## Sprint 14 Focus\n- Complete Async CSV Export (Backend Platform Squad)\n- QA Slack & Webhook Experiment Alerts (Growth Squad)\n- Maintain <200ms P95 API latency on overview dashboard endpoints`,
      nowIso,
      nowIso
    );

    // 8. Seed initial audit entry
    db.prepare(
      `INSERT INTO audit_logs (actor_email, actor_role, action, entity_type, entity_id, details_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      'system@productpulse.local',
      'system',
      'SEED_SYNTHETIC_DATASET',
      'workspace',
      'demo',
      JSON.stringify({
        note: 'Seeded synthetic demonstration metrics, feedback, features, experiments, and templates.',
      }),
      nowIso
    );

    db.exec('COMMIT;');
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }
}
