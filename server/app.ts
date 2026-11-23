import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import type {
  AuditLogEntry,
  AuthUser,
  BusinessScenario,
  DailyMetric,
  Experiment,
  ExperimentStatus,
  FeedbackCategory,
  FeedbackItem,
  FeedbackStatus,
  OverviewSummary,
  PmDocType,
  PmDocument,
  ProductFeature,
  UxArtifact,
  UxArtifactType,
} from '../src/types/productpulse.js';
import {
  type AuthenticatedRequest,
  hashPassword,
  optionalAuth,
  requireAdmin,
  requireAuth,
  signAuthToken,
  verifyEnvAdminPasscode,
  verifyPassword,
} from './auth.js';
import { writeAuditLog } from './db.js';
import {
  type AssistantTaskType,
  analyzeFeedbackWithAi,
  isGeminiConfigured,
  runProductAssistant,
} from './gemini.js';
import { detectRecurringComplaints, summarizeFeedbackLocal } from './nlp.js';
import {
  calculateAbTestStatistics,
  calculateBusinessCaseMetrics,
  calculateRiceScore,
} from './stats.js';
import {
  boundedNumber,
  FEEDBACK_CATEGORIES,
  FEEDBACK_STATUSES,
  isValidEmail,
  MOSCOW_PRIORITIES,
  nonEmptyString,
  parseFeedbackCsv,
  ROADMAP_STATUSES,
} from './validation.js';

function mapDailyMetric(row: Record<string, unknown>): DailyMetric {
  return {
    id: Number(row.id),
    date: String(row.date),
    totalUsers: Number(row.total_users),
    activeUsers: Number(row.active_users),
    newUsers: Number(row.new_users),
    retainedUsers: Number(row.retained_users),
    retentionRate: Number(row.retention_rate),
    featureAdoptionRate: Number(row.feature_adoption_rate),
    csatScore: Number(row.csat_score),
    engagementScore: Number(row.engagement_score),
    conversionRate: Number(row.conversion_rate),
    isSynthetic: Boolean(row.is_synthetic),
  };
}

function mapFeedbackRow(row: Record<string, unknown>): FeedbackItem {
  return {
    id: Number(row.id),
    title: String(row.title),
    content: String(row.content),
    customerSegment: String(row.customer_segment),
    category: row.category as FeedbackCategory,
    status: row.status as FeedbackStatus,
    rating: Number(row.rating),
    sentiment: row.sentiment as FeedbackItem['sentiment'],
    sentimentScore: Number(row.sentiment_score),
    keywords: JSON.parse(String(row.keywords_json || '[]')) as string[],
    topics: JSON.parse(String(row.topics_json || '[]')) as string[],
    analysisMethod: (row.analysis_method === 'gemini'
      ? 'gemini'
      : 'local-nlp') as FeedbackItem['analysisMethod'],
    analysisExplanation: String(row.analysis_explanation),
    isSynthetic: Boolean(row.is_synthetic),
    createdBy: String(row.created_by),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapFeatureRow(row: Record<string, unknown>): ProductFeature {
  return {
    id: Number(row.id),
    title: String(row.title),
    description: String(row.description),
    category: String(row.category),
    reach: Number(row.reach),
    impact: Number(row.impact),
    confidence: Number(row.confidence),
    effort: Number(row.effort),
    riceScore: Number(row.rice_score),
    manualPriorityOverride:
      row.manual_priority_override !== null &&
      row.manual_priority_override !== undefined
        ? Number(row.manual_priority_override)
        : null,
    overrideReason: String(row.override_reason ?? ''),
    moscowPriority: row.moscow_priority as ProductFeature['moscowPriority'],
    roadmapStatus: row.roadmap_status as ProductFeature['roadmapStatus'],
    initiative: String(row.initiative),
    targetReleaseDate: String(row.target_release_date),
    milestone: String(row.milestone),
    sprint: String(row.sprint),
    owner: String(row.owner),
    isSynthetic: Boolean(row.is_synthetic),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapExperimentRow(row: Record<string, unknown>): Experiment {
  const controlVisitors = Number(row.control_visitors);
  const controlConversions = Number(row.control_conversions);
  const variantVisitors = Number(row.variant_visitors);
  const variantConversions = Number(row.variant_conversions);
  return {
    id: Number(row.id),
    name: String(row.name),
    hypothesis: String(row.hypothesis),
    metricName: String(row.metric_name),
    status: row.status as ExperimentStatus,
    controlName: String(row.control_name),
    controlVisitors,
    controlConversions,
    variantName: String(row.variant_name),
    variantVisitors,
    variantConversions,
    outcomeNotes: String(row.outcome_notes ?? ''),
    nextStepRecommendation: String(row.next_step_recommendation ?? ''),
    isSynthetic: Boolean(row.is_synthetic),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    statistics: calculateAbTestStatistics(
      controlVisitors,
      controlConversions,
      variantVisitors,
      variantConversions
    ),
  };
}

function mapBusinessRow(row: Record<string, unknown>): BusinessScenario {
  return {
    id: Number(row.id),
    name: String(row.name),
    tierName: String(row.tier_name),
    monthlyPrice: Number(row.monthly_price),
    estimatedCustomers: Number(row.estimated_customers),
    monthlyChurnPct: Number(row.monthly_churn_pct),
    cac: Number(row.cac),
    grossMarginPct: Number(row.gross_margin_pct),
    fixedMonthlyCost: Number(row.fixed_monthly_cost),
    variableCostPerUser: Number(row.variable_cost_per_user),
    notes: String(row.notes ?? ''),
    isAssumption: Boolean(row.is_assumption),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function computeOverview(db: DatabaseSync, rangeDays: number): OverviewSummary {
  const allRows = (
    db
      .prepare('SELECT * FROM daily_metrics ORDER BY date ASC')
      .all() as Array<Record<string, unknown>>
  ).map(mapDailyMetric);

  const clampedDays = Math.max(2, Math.min(90, rangeDays));
  const series = allRows.slice(-clampedDays);
  const prior = allRows.slice(-clampedDays * 2, -clampedDays);

  const latest = series[series.length - 1];
  const avg = (arr: DailyMetric[], fn: (m: DailyMetric) => number): number =>
    arr.length > 0 ? arr.reduce((acc, m) => acc + fn(m), 0) / arr.length : 0;

  const feedbackCountRow = db
    .prepare('SELECT COUNT(*) as cnt FROM feedback_items')
    .get() as { cnt: number };

  const catRows = db
    .prepare(
      'SELECT category, COUNT(*) as count FROM feedback_items GROUP BY category ORDER BY count DESC'
    )
    .all() as Array<{ category: string; count: number }>;

  const sentRows = db
    .prepare(
      'SELECT sentiment, COUNT(*) as count FROM feedback_items GROUP BY sentiment ORDER BY count DESC'
    )
    .all() as Array<{ sentiment: string; count: number }>;

  const activeAvg = avg(series, (m) => m.activeUsers);
  const priorActiveAvg = prior.length > 0 ? avg(prior, (m) => m.activeUsers) : activeAvg;
  const activeUsersPct =
    priorActiveAvg > 0
      ? Number((((activeAvg - priorActiveAvg) / priorActiveAvg) * 100).toFixed(1))
      : 0;

  const retAvg = avg(series, (m) => m.retentionRate);
  const priorRet = prior.length > 0 ? avg(prior, (m) => m.retentionRate) : retAvg;

  const adoptAvg = avg(series, (m) => m.featureAdoptionRate);
  const priorAdopt =
    prior.length > 0 ? avg(prior, (m) => m.featureAdoptionRate) : adoptAvg;

  const csatAvg = avg(series, (m) => m.csatScore);
  const priorCsat = prior.length > 0 ? avg(prior, (m) => m.csatScore) : csatAvg;

  const engAvg = avg(series, (m) => m.engagementScore);
  const priorEng =
    prior.length > 0 ? avg(prior, (m) => m.engagementScore) : engAvg;

  const convAvg = avg(series, (m) => m.conversionRate);
  const priorConv =
    prior.length > 0 ? avg(prior, (m) => m.conversionRate) : convAvg;

  const totalUsers = latest?.totalUsers ?? 0;
  const latestActive = latest?.activeUsers ?? 0;
  const dauMauRatio =
    totalUsers > 0 ? Number(((latestActive / totalUsers) * 100).toFixed(1)) : 0;

  return {
    rangeDays: clampedDays,
    latestDate: latest?.date ?? '',
    hasSyntheticData: series.some((s) => s.isSynthetic),
    kpis: {
      totalUsers,
      activeUsers: Math.round(activeAvg),
      dauMauRatio,
      customerRetention: Number(retAvg.toFixed(1)),
      featureAdoption: Number(adoptAvg.toFixed(1)),
      customerSatisfaction: Number(csatAvg.toFixed(2)),
      feedbackVolume: Number(feedbackCountRow.cnt),
      productEngagement: Number(engAvg.toFixed(1)),
      conversionRate: Number(convAvg.toFixed(2)),
    },
    deltas: {
      activeUsersPct,
      retentionDelta: Number((retAvg - priorRet).toFixed(2)),
      adoptionDelta: Number((adoptAvg - priorAdopt).toFixed(2)),
      csatDelta: Number((csatAvg - priorCsat).toFixed(2)),
      engagementDelta: Number((engAvg - priorEng).toFixed(1)),
      conversionDelta: Number((convAvg - priorConv).toFixed(2)),
    },
    series,
    feedbackByCategory: catRows,
    feedbackBySentiment: sentRows,
  };
}

export function createApp(db: DatabaseSync): express.Express {
  const app = express();

  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  app.use(express.json({ limit: '2mb' }));

  // ---------------------------------------------------------------------------
  // Health & Status
  // ---------------------------------------------------------------------------
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'ProductPulse AI' });
  });

  // ---------------------------------------------------------------------------
  // Auth & RBAC
  // ---------------------------------------------------------------------------
  app.get('/api/auth/status', optionalAuth, (req: AuthenticatedRequest, res) => {
    const adminRow = db
      .prepare("SELECT COUNT(*) as cnt FROM users WHERE role = 'admin'")
      .get() as { cnt: number };

    let currentUser: AuthUser | null = null;
    if (req.authUser) {
      const u = db
        .prepare('SELECT id, email, name, role, created_at FROM users WHERE id = ?')
        .get(req.authUser.sub) as Record<string, unknown> | undefined;
      if (u) {
        currentUser = {
          id: Number(u.id),
          email: String(u.email),
          name: String(u.name),
          role: u.role as AuthUser['role'],
          createdAt: String(u.created_at),
        };
      }
    }

    res.json({
      hasAdmin: adminRow.cnt > 0,
      envAdminPasscodeConfigured: Boolean(process.env.ADMIN_PASSCODE?.trim()),
      geminiConfigured: isGeminiConfigured(),
      currentUser,
    });
  });

  app.post('/api/auth/claim-admin', (req, res) => {
    const { email, name, password, adminPasscode } = req.body ?? {};
    if (!isValidEmail(email)) {
      res.status(400).json({ error: 'Please provide a valid email address.' });
      return;
    }
    const cleanName = nonEmptyString(name, 2, 100);
    if (!cleanName) {
      res.status(400).json({ error: 'Name must be between 2 and 100 characters.' });
      return;
    }
    const cleanPassword = nonEmptyString(password, 8, 128);
    if (!cleanPassword) {
      res.status(400).json({ error: 'Password must be at least 8 characters.' });
      return;
    }

    const envPasscodeConfigured = Boolean(process.env.ADMIN_PASSCODE?.trim());
    const adminCount = (
      db.prepare("SELECT COUNT(*) as cnt FROM users WHERE role = 'admin'").get() as {
        cnt: number;
      }
    ).cnt;

    if (envPasscodeConfigured) {
      if (typeof adminPasscode !== 'string' || !verifyEnvAdminPasscode(adminPasscode)) {
        res.status(403).json({ error: 'Invalid server ADMIN_PASSCODE.' });
        return;
      }
    } else if (adminCount > 0) {
      res.status(403).json({
        error:
          'An administrator account has already been claimed. Please sign in with existing credentials.',
      });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existing = db
      .prepare('SELECT id FROM users WHERE email = ?')
      .get(normalizedEmail) as { id: number } | undefined;

    const nowIso = new Date().toISOString();
    const passwordHash = hashPassword(cleanPassword);

    let userId: number;
    if (existing) {
      db.prepare(
        "UPDATE users SET name = ?, role = 'admin', password_hash = ? WHERE id = ?"
      ).run(cleanName, passwordHash, existing.id);
      userId = existing.id;
    } else {
      const info = db
        .prepare(
          "INSERT INTO users (email, name, role, password_hash, created_at) VALUES (?, ?, 'admin', ?, ?)"
        )
        .run(normalizedEmail, cleanName, passwordHash, nowIso);
      userId = Number(info.lastInsertRowid);
    }

    const user: AuthUser = {
      id: userId,
      email: normalizedEmail,
      name: cleanName,
      role: 'admin',
      createdAt: nowIso,
    };

    writeAuditLog(db, user.email, user.role, 'CLAIM_ADMIN', 'user', user.id, {
      method: envPasscodeConfigured ? 'env_passcode' : 'first_run_bootstrap',
    });

    res.status(201).json({ token: signAuthToken(user), user });
  });

  app.post('/api/auth/register', (req, res) => {
    const { email, name, password } = req.body ?? {};
    if (!isValidEmail(email)) {
      res.status(400).json({ error: 'Please provide a valid email address.' });
      return;
    }
    const cleanName = nonEmptyString(name, 2, 100);
    if (!cleanName) {
      res.status(400).json({ error: 'Name must be 2–100 characters.' });
      return;
    }
    const cleanPassword = nonEmptyString(password, 8, 128);
    if (!cleanPassword) {
      res.status(400).json({ error: 'Password must be at least 8 characters.' });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existing = db
      .prepare('SELECT id FROM users WHERE email = ?')
      .get(normalizedEmail);
    if (existing) {
      res.status(409).json({ error: 'An account with this email already exists.' });
      return;
    }

    const nowIso = new Date().toISOString();
    const info = db
      .prepare(
        "INSERT INTO users (email, name, role, password_hash, created_at) VALUES (?, ?, 'user', ?, ?)"
      )
      .run(normalizedEmail, cleanName, hashPassword(cleanPassword), nowIso);

    const user: AuthUser = {
      id: Number(info.lastInsertRowid),
      email: normalizedEmail,
      name: cleanName,
      role: 'user',
      createdAt: nowIso,
    };

    writeAuditLog(db, user.email, user.role, 'REGISTER_USER', 'user', user.id);
    res.status(201).json({ token: signAuthToken(user), user });
  });

  app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body ?? {};
    if (!isValidEmail(email) || typeof password !== 'string') {
      res.status(400).json({ error: 'Valid email and password are required.' });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    const row = db
      .prepare('SELECT * FROM users WHERE email = ?')
      .get(normalizedEmail) as Record<string, unknown> | undefined;

    if (!row || !verifyPassword(password, String(row.password_hash))) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    const user: AuthUser = {
      id: Number(row.id),
      email: String(row.email),
      name: String(row.name),
      role: row.role as AuthUser['role'],
      createdAt: String(row.created_at),
    };

    writeAuditLog(db, user.email, user.role, 'LOGIN', 'user', user.id);
    res.json({ token: signAuthToken(user), user });
  });

  app.get('/api/admin/users', requireAuth, requireAdmin, (_req, res) => {
    const rows = db
      .prepare('SELECT id, email, name, role, created_at FROM users ORDER BY id ASC')
      .all() as Array<Record<string, unknown>>;
    res.json(
      rows.map((u) => ({
        id: Number(u.id),
        email: String(u.email),
        name: String(u.name),
        role: u.role,
        createdAt: String(u.created_at),
      }))
    );
  });

  app.patch(
    '/api/admin/users/:id/role',
    requireAuth,
    requireAdmin,
    (req: AuthenticatedRequest, res) => {
      const targetId = Number(req.params.id);
      const { role } = req.body ?? {};
      if (!Number.isInteger(targetId) || (role !== 'admin' && role !== 'user')) {
        res.status(400).json({ error: 'Invalid user ID or role.' });
        return;
      }
      if (req.authUser && targetId === req.authUser.sub && role !== 'admin') {
        res.status(400).json({ error: 'You cannot demote your own admin role.' });
        return;
      }

      const existing = db
        .prepare('SELECT id, email FROM users WHERE id = ?')
        .get(targetId) as { id: number; email: string } | undefined;
      if (!existing) {
        res.status(404).json({ error: 'User not found.' });
        return;
      }

      db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, targetId);
      writeAuditLog(
        db,
        req.authUser!.email,
        req.authUser!.role,
        'UPDATE_USER_ROLE',
        'user',
        targetId,
        { targetEmail: existing.email, newRole: role }
      );
      res.json({ id: targetId, role });
    }
  );

  app.get('/api/admin/audit-logs', requireAuth, requireAdmin, (_req, res) => {
    const rows = db
      .prepare('SELECT * FROM audit_logs ORDER BY id DESC LIMIT 100')
      .all() as Array<Record<string, unknown>>;
    const entries: AuditLogEntry[] = rows.map((r) => ({
      id: Number(r.id),
      actorEmail: String(r.actor_email),
      actorRole: String(r.actor_role),
      action: String(r.action),
      entityType: String(r.entity_type),
      entityId: String(r.entity_id),
      details: JSON.parse(String(r.details_json || '{}')),
      createdAt: String(r.created_at),
    }));
    res.json(entries);
  });

  // ---------------------------------------------------------------------------
  // Product Overview & Analytics
  // ---------------------------------------------------------------------------
  app.get('/api/analytics/overview', (req, res) => {
    const days = Number(req.query.days ?? 14);
    const validDays = Number.isFinite(days) ? days : 14;
    res.json(computeOverview(db, validDays));
  });

  app.post(
    '/api/analytics/metrics',
    requireAuth,
    (req: AuthenticatedRequest, res) => {
      const body = req.body ?? {};
      const date = nonEmptyString(body.date, 10, 10);
      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        res.status(400).json({ error: 'Date must be formatted YYYY-MM-DD.' });
        return;
      }
      const totalUsers = boundedNumber(body.totalUsers, 1, 10_000_000);
      const activeUsers = boundedNumber(body.activeUsers, 0, 10_000_000);
      const newUsers = boundedNumber(body.newUsers, 0, 1_000_000);
      const retentionRate = boundedNumber(body.retentionRate, 0, 100);
      const featureAdoptionRate = boundedNumber(body.featureAdoptionRate, 0, 100);
      const csatScore = boundedNumber(body.csatScore, 1, 5);
      const engagementScore = boundedNumber(body.engagementScore, 0, 100);
      const conversionRate = boundedNumber(body.conversionRate, 0, 100);

      if (
        totalUsers === null ||
        activeUsers === null ||
        newUsers === null ||
        retentionRate === null ||
        featureAdoptionRate === null ||
        csatScore === null ||
        engagementScore === null ||
        conversionRate === null
      ) {
        res.status(400).json({ error: 'One or more metric values are out of range.' });
        return;
      }

      const retainedUsers = Math.round(activeUsers * (retentionRate / 100));

      db.prepare(
        `INSERT INTO daily_metrics (
          date, total_users, active_users, new_users, retained_users,
          retention_rate, feature_adoption_rate, csat_score, engagement_score,
          conversion_rate, is_synthetic
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
        ON CONFLICT(date) DO UPDATE SET
          total_users = excluded.total_users,
          active_users = excluded.active_users,
          new_users = excluded.new_users,
          retained_users = excluded.retained_users,
          retention_rate = excluded.retention_rate,
          feature_adoption_rate = excluded.feature_adoption_rate,
          csat_score = excluded.csat_score,
          engagement_score = excluded.engagement_score,
          conversion_rate = excluded.conversion_rate,
          is_synthetic = 0`
      ).run(
        date,
        Math.round(totalUsers),
        Math.round(activeUsers),
        Math.round(newUsers),
        retainedUsers,
        retentionRate,
        featureAdoptionRate,
        csatScore,
        engagementScore,
        conversionRate
      );

      writeAuditLog(
        db,
        req.authUser!.email,
        req.authUser!.role,
        'UPSERT_METRIC_SNAPSHOT',
        'daily_metric',
        date
      );
      res.status(201).json({ ok: true, date });
    }
  );

  // ---------------------------------------------------------------------------
  // Customer Feedback & AI NLP Analysis
  // ---------------------------------------------------------------------------
  app.get('/api/feedback', (req, res) => {
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const category =
      typeof req.query.category === 'string' ? req.query.category.trim() : '';
    const status = typeof req.query.status === 'string' ? req.query.status.trim() : '';
    const sentiment =
      typeof req.query.sentiment === 'string' ? req.query.sentiment.trim() : '';

    const clauses: string[] = [];
    const params: Array<string | number> = [];

    if (search) {
      clauses.push('(title LIKE ? OR content LIKE ? OR keywords_json LIKE ?)');
      const like = `%${search}%`;
      params.push(like, like, like);
    }
    if (category && category !== 'All') {
      clauses.push('category = ?');
      params.push(category);
    }
    if (status && status !== 'All') {
      clauses.push('status = ?');
      params.push(status);
    }
    if (sentiment && sentiment !== 'All') {
      clauses.push('sentiment = ?');
      params.push(sentiment);
    }

    const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
    const rows = db
      .prepare(`SELECT * FROM feedback_items ${where} ORDER BY created_at DESC, id DESC`)
      .all(...params) as Array<Record<string, unknown>>;

    res.json(rows.map(mapFeedbackRow));
  });

  app.get('/api/feedback/insights', (_req, res) => {
    const rows = db
      .prepare('SELECT * FROM feedback_items ORDER BY created_at DESC')
      .all() as Array<Record<string, unknown>>;
    const items = rows.map(mapFeedbackRow);
    const recurringComplaints = detectRecurringComplaints(items);
    const summary = summarizeFeedbackLocal(items);

    const kwCount = new Map<string, number>();
    const topicCount = new Map<string, number>();
    for (const item of items) {
      for (const kw of item.keywords) {
        kwCount.set(kw, (kwCount.get(kw) ?? 0) + 1);
      }
      for (const tp of item.topics) {
        topicCount.set(tp, (topicCount.get(tp) ?? 0) + 1);
      }
    }

    res.json({
      geminiConfigured: isGeminiConfigured(),
      totalAnalyzed: items.length,
      summary: summary.summary,
      topFeatureRequests: summary.topFeatureRequests,
      recurringComplaints,
      topKeywords: Array.from(kwCount.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 12)
        .map(([keyword, count]) => ({ keyword, count })),
      topicBreakdown: Array.from(topicCount.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([topic, count]) => ({ topic, count })),
    });
  });

  app.post('/api/feedback', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const body = req.body ?? {};
      const title = nonEmptyString(body.title, 3, 180);
      const content = nonEmptyString(body.content, 5, 2000);
      const rating = boundedNumber(body.rating ?? 3, 1, 5);
      const customerSegment = nonEmptyString(body.customerSegment ?? 'Mid-Market', 2, 60);

      if (!title || !content || rating === null || !customerSegment) {
        res.status(400).json({
          error: 'Title (3+ chars), content (5+ chars), segment, and rating (1-5) are required.',
        });
        return;
      }

      const analysis = await analyzeFeedbackWithAi(title, content, Math.round(rating));
      const category = FEEDBACK_CATEGORIES.includes(body.category)
        ? (body.category as FeedbackCategory)
        : analysis.suggestedCategory;
      const status = FEEDBACK_STATUSES.includes(body.status)
        ? (body.status as FeedbackStatus)
        : 'New';

      const nowIso = new Date().toISOString();
      const info = db
        .prepare(
          `INSERT INTO feedback_items (
            title, content, customer_segment, category, status, rating,
            sentiment, sentiment_score, keywords_json, topics_json,
            analysis_method, analysis_explanation, is_synthetic, created_by, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`
        )
        .run(
          title,
          content,
          customerSegment,
          category,
          status,
          Math.round(rating),
          analysis.sentiment,
          analysis.sentimentScore,
          JSON.stringify(analysis.keywords),
          JSON.stringify(analysis.topics),
          analysis.analysisMethod,
          analysis.explanation,
          req.authUser!.email,
          nowIso,
          nowIso
        );

      const created = db
        .prepare('SELECT * FROM feedback_items WHERE id = ?')
        .get(Number(info.lastInsertRowid)) as Record<string, unknown>;

      writeAuditLog(
        db,
        req.authUser!.email,
        req.authUser!.role,
        'CREATE_FEEDBACK',
        'feedback',
        Number(info.lastInsertRowid),
        { category, sentiment: analysis.sentiment }
      );
      res.status(201).json(mapFeedbackRow(created));
    } catch (err) {
      res.status(502).json({
        error:
          err instanceof Error
            ? `Feedback analysis failed: ${err.message}`
            : 'Feedback creation failed.',
      });
    }
  });

  app.post(
    '/api/feedback/import-csv',
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const csvText = nonEmptyString(req.body?.csvText, 10, 500_000);
        if (!csvText) {
          res.status(400).json({ error: 'Valid CSV text payload is required.' });
          return;
        }

        const parsed = parseFeedbackCsv(csvText);
        if (parsed.rows.length === 0) {
          res.status(400).json({
            error: parsed.errors[0] ?? 'No valid rows found in CSV.',
            details: parsed.errors,
          });
          return;
        }

        const nowIso = new Date().toISOString();
        const insertStmt = db.prepare(
          `INSERT INTO feedback_items (
            title, content, customer_segment, category, status, rating,
            sentiment, sentiment_score, keywords_json, topics_json,
            analysis_method, analysis_explanation, is_synthetic, created_by, created_at, updated_at
          ) VALUES (?, ?, ?, ?, 'New', ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`
        );

        const insertedIds: number[] = [];
        db.exec('BEGIN TRANSACTION;');
        try {
          for (const row of parsed.rows) {
            const analysis = await analyzeFeedbackWithAi(
              row.title,
              row.content,
              row.rating
            );
            const info = insertStmt.run(
              row.title,
              row.content,
              row.customerSegment,
              row.category ?? analysis.suggestedCategory,
              row.rating,
              analysis.sentiment,
              analysis.sentimentScore,
              JSON.stringify(analysis.keywords),
              JSON.stringify(analysis.topics),
              analysis.analysisMethod,
              analysis.explanation,
              req.authUser!.email,
              nowIso,
              nowIso
            );
            insertedIds.push(Number(info.lastInsertRowid));
          }
          db.exec('COMMIT;');
        } catch (innerErr) {
          db.exec('ROLLBACK;');
          throw innerErr;
        }

        writeAuditLog(
          db,
          req.authUser!.email,
          req.authUser!.role,
          'IMPORT_FEEDBACK_CSV',
          'feedback',
          'bulk',
          { importedCount: insertedIds.length, skippedErrors: parsed.errors.length }
        );

        res.status(201).json({
          importedCount: insertedIds.length,
          errors: parsed.errors,
        });
      } catch (err) {
        res.status(500).json({
          error: err instanceof Error ? err.message : 'CSV import failed.',
        });
      }
    }
  );

  app.patch(
    '/api/feedback/:id',
    requireAuth,
    (req: AuthenticatedRequest, res) => {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) {
        res.status(400).json({ error: 'Invalid feedback ID.' });
        return;
      }
      const existing = db
        .prepare('SELECT * FROM feedback_items WHERE id = ?')
        .get(id) as Record<string, unknown> | undefined;
      if (!existing) {
        res.status(404).json({ error: 'Feedback item not found.' });
        return;
      }

      const category =
        req.body?.category && FEEDBACK_CATEGORIES.includes(req.body.category)
          ? req.body.category
          : existing.category;
      const status =
        req.body?.status && FEEDBACK_STATUSES.includes(req.body.status)
          ? req.body.status
          : existing.status;
      const rating =
        req.body?.rating !== undefined
          ? boundedNumber(req.body.rating, 1, 5)
          : Number(existing.rating);

      if (rating === null) {
        res.status(400).json({ error: 'Rating must be between 1 and 5.' });
        return;
      }

      const nowIso = new Date().toISOString();
      db.prepare(
        'UPDATE feedback_items SET category = ?, status = ?, rating = ?, updated_at = ? WHERE id = ?'
      ).run(String(category), String(status), Math.round(rating), nowIso, id);

      writeAuditLog(
        db,
        req.authUser!.email,
        req.authUser!.role,
        'UPDATE_FEEDBACK',
        'feedback',
        id,
        { category, status, rating }
      );

      const updated = db
        .prepare('SELECT * FROM feedback_items WHERE id = ?')
        .get(id) as Record<string, unknown>;
      res.json(mapFeedbackRow(updated));
    }
  );

  app.post(
    '/api/feedback/:id/reanalyze',
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      const id = Number(req.params.id);
      const existing = db
        .prepare('SELECT * FROM feedback_items WHERE id = ?')
        .get(id) as Record<string, unknown> | undefined;
      if (!existing) {
        res.status(404).json({ error: 'Feedback item not found.' });
        return;
      }

      try {
        const analysis = await analyzeFeedbackWithAi(
          String(existing.title),
          String(existing.content),
          Number(existing.rating)
        );
        const nowIso = new Date().toISOString();
        db.prepare(
          `UPDATE feedback_items
           SET sentiment = ?, sentiment_score = ?, keywords_json = ?, topics_json = ?,
               analysis_method = ?, analysis_explanation = ?, updated_at = ?
           WHERE id = ?`
        ).run(
          analysis.sentiment,
          analysis.sentimentScore,
          JSON.stringify(analysis.keywords),
          JSON.stringify(analysis.topics),
          analysis.analysisMethod,
          analysis.explanation,
          nowIso,
          id
        );

        const updated = db
          .prepare('SELECT * FROM feedback_items WHERE id = ?')
          .get(id) as Record<string, unknown>;
        res.json(mapFeedbackRow(updated));
      } catch (err) {
        res.status(502).json({
          error:
            err instanceof Error ? err.message : 'AI reanalysis request failed.',
        });
      }
    }
  );

  app.delete(
    '/api/feedback/:id',
    requireAuth,
    requireAdmin,
    (req: AuthenticatedRequest, res) => {
      const id = Number(req.params.id);
      const info = db.prepare('DELETE FROM feedback_items WHERE id = ?').run(id);
      if (info.changes === 0) {
        res.status(404).json({ error: 'Feedback item not found.' });
        return;
      }
      writeAuditLog(
        db,
        req.authUser!.email,
        req.authUser!.role,
        'DELETE_FEEDBACK',
        'feedback',
        id
      );
      res.json({ deleted: true, id });
    }
  );

  // ---------------------------------------------------------------------------
  // Feature Prioritization (RICE) & Product Roadmap
  // ---------------------------------------------------------------------------
  app.get('/api/features', (_req, res) => {
    const rows = db
      .prepare(
        `SELECT * FROM features
         ORDER BY CASE WHEN manual_priority_override IS NULL THEN 1 ELSE 0 END ASC,
                  manual_priority_override ASC,
                  rice_score DESC`
      )
      .all() as Array<Record<string, unknown>>;
    res.json(rows.map(mapFeatureRow));
  });

  app.post('/api/features', requireAuth, (req: AuthenticatedRequest, res) => {
    const b = req.body ?? {};
    const title = nonEmptyString(b.title, 3, 180);
    const description = nonEmptyString(b.description, 3, 2000);
    const category = nonEmptyString(b.category ?? 'Core Product', 2, 60);
    const reach = boundedNumber(b.reach, 0, 10_000_000);
    const impact = boundedNumber(b.impact, 0.25, 3);
    const confidence = boundedNumber(b.confidence, 1, 100);
    const effort = boundedNumber(b.effort, 0.1, 100);

    if (
      !title ||
      !description ||
      !category ||
      reach === null ||
      impact === null ||
      confidence === null ||
      effort === null
    ) {
      res.status(400).json({
        error:
          'Title, description, reach (>=0), impact (0.25-3), confidence (1-100%), and effort (>0) are required.',
      });
      return;
    }

    const riceScore = calculateRiceScore(reach, impact, confidence, effort);
    const moscow = MOSCOW_PRIORITIES.includes(b.moscowPriority)
      ? b.moscowPriority
      : 'Should Have';
    const roadmapStatus = ROADMAP_STATUSES.includes(b.roadmapStatus)
      ? b.roadmapStatus
      : 'Backlog';
    const initiative = nonEmptyString(b.initiative ?? 'Core Platform', 2, 80) ?? 'Core Platform';
    const targetReleaseDate =
      typeof b.targetReleaseDate === 'string' ? b.targetReleaseDate.slice(0, 10) : '';
    const milestone = typeof b.milestone === 'string' ? b.milestone.slice(0, 80) : '';
    const sprint = typeof b.sprint === 'string' ? b.sprint.slice(0, 40) : '';
    const owner = typeof b.owner === 'string' && b.owner.trim() ? b.owner.trim().slice(0, 80) : 'Product Team';

    const nowIso = new Date().toISOString();
    const info = db
      .prepare(
        `INSERT INTO features (
          title, description, category, reach, impact, confidence, effort, rice_score,
          manual_priority_override, override_reason, moscow_priority, roadmap_status,
          initiative, target_release_date, milestone, sprint, owner, is_synthetic,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, '', ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`
      )
      .run(
        title,
        description,
        category,
        Math.round(reach),
        impact,
        Math.round(confidence),
        effort,
        riceScore,
        moscow,
        roadmapStatus,
        initiative,
        targetReleaseDate,
        milestone,
        sprint,
        owner,
        nowIso,
        nowIso
      );

    const created = db
      .prepare('SELECT * FROM features WHERE id = ?')
      .get(Number(info.lastInsertRowid)) as Record<string, unknown>;

    writeAuditLog(
      db,
      req.authUser!.email,
      req.authUser!.role,
      'CREATE_FEATURE',
      'feature',
      Number(info.lastInsertRowid),
      { title, riceScore }
    );
    res.status(201).json(mapFeatureRow(created));
  });

  app.patch('/api/features/:id', requireAuth, (req: AuthenticatedRequest, res) => {
    const id = Number(req.params.id);
    const existing = db
      .prepare('SELECT * FROM features WHERE id = ?')
      .get(id) as Record<string, unknown> | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Feature not found.' });
      return;
    }

    const b = req.body ?? {};
    const reach =
      b.reach !== undefined ? boundedNumber(b.reach, 0, 10_000_000) : Number(existing.reach);
    const impact =
      b.impact !== undefined ? boundedNumber(b.impact, 0.25, 3) : Number(existing.impact);
    const confidence =
      b.confidence !== undefined
        ? boundedNumber(b.confidence, 1, 100)
        : Number(existing.confidence);
    const effort =
      b.effort !== undefined ? boundedNumber(b.effort, 0.1, 100) : Number(existing.effort);

    if (reach === null || impact === null || confidence === null || effort === null) {
      res.status(400).json({ error: 'Invalid RICE scoring input values.' });
      return;
    }

    const riceScore = calculateRiceScore(reach, impact, confidence, effort);
    const title =
      b.title !== undefined ? nonEmptyString(b.title, 3, 180) : String(existing.title);
    const description =
      b.description !== undefined
        ? nonEmptyString(b.description, 3, 2000)
        : String(existing.description);
    if (!title || !description) {
      res.status(400).json({ error: 'Title and description cannot be empty.' });
      return;
    }

    let manualOverride: number | null =
      existing.manual_priority_override !== null
        ? Number(existing.manual_priority_override)
        : null;
    let overrideReason = String(existing.override_reason ?? '');

    if ('manualPriorityOverride' in b) {
      if (b.manualPriorityOverride === null || b.manualPriorityOverride === '') {
        manualOverride = null;
        overrideReason = '';
      } else {
        const parsedRank = boundedNumber(b.manualPriorityOverride, 1, 100);
        const reasonText = nonEmptyString(b.overrideReason ?? '', 4, 300);
        if (parsedRank === null || !reasonText) {
          res.status(400).json({
            error:
              'Manual priority overrides require a valid rank (1-100) and a written explanation.',
          });
          return;
        }
        manualOverride = Math.round(parsedRank);
        overrideReason = reasonText;
      }
    }

    const moscow = MOSCOW_PRIORITIES.includes(b.moscowPriority)
      ? b.moscowPriority
      : existing.moscow_priority;
    const roadmapStatus = ROADMAP_STATUSES.includes(b.roadmapStatus)
      ? b.roadmapStatus
      : existing.roadmap_status;
    const initiative =
      typeof b.initiative === 'string' && b.initiative.trim()
        ? b.initiative.trim().slice(0, 80)
        : String(existing.initiative);
    const targetReleaseDate =
      typeof b.targetReleaseDate === 'string'
        ? b.targetReleaseDate.slice(0, 10)
        : String(existing.target_release_date);
    const milestone =
      typeof b.milestone === 'string'
        ? b.milestone.slice(0, 80)
        : String(existing.milestone);
    const sprint =
      typeof b.sprint === 'string' ? b.sprint.slice(0, 40) : String(existing.sprint);
    const owner =
      typeof b.owner === 'string' && b.owner.trim()
        ? b.owner.trim().slice(0, 80)
        : String(existing.owner);

    const nowIso = new Date().toISOString();
    db.prepare(
      `UPDATE features SET
        title = ?, description = ?, reach = ?, impact = ?, confidence = ?, effort = ?,
        rice_score = ?, manual_priority_override = ?, override_reason = ?,
        moscow_priority = ?, roadmap_status = ?, initiative = ?,
        target_release_date = ?, milestone = ?, sprint = ?, owner = ?, updated_at = ?
       WHERE id = ?`
    ).run(
      title,
      description,
      Math.round(reach),
      impact,
      Math.round(confidence),
      effort,
      riceScore,
      manualOverride,
      overrideReason,
      String(moscow),
      String(roadmapStatus),
      initiative,
      targetReleaseDate,
      milestone,
      sprint,
      owner,
      nowIso,
      id
    );

    writeAuditLog(
      db,
      req.authUser!.email,
      req.authUser!.role,
      'UPDATE_FEATURE',
      'feature',
      id,
      { riceScore, roadmapStatus, manualOverride, overrideReason }
    );

    const updated = db
      .prepare('SELECT * FROM features WHERE id = ?')
      .get(id) as Record<string, unknown>;
    res.json(mapFeatureRow(updated));
  });

  app.delete(
    '/api/features/:id',
    requireAuth,
    requireAdmin,
    (req: AuthenticatedRequest, res) => {
      const id = Number(req.params.id);
      const info = db.prepare('DELETE FROM features WHERE id = ?').run(id);
      if (info.changes === 0) {
        res.status(404).json({ error: 'Feature not found.' });
        return;
      }
      writeAuditLog(
        db,
        req.authUser!.email,
        req.authUser!.role,
        'DELETE_FEATURE',
        'feature',
        id
      );
      res.json({ deleted: true, id });
    }
  );

  // ---------------------------------------------------------------------------
  // A/B Testing & Experimentation
  // ---------------------------------------------------------------------------
  app.get('/api/experiments', (_req, res) => {
    const rows = db
      .prepare('SELECT * FROM experiments ORDER BY id DESC')
      .all() as Array<Record<string, unknown>>;
    res.json(rows.map(mapExperimentRow));
  });

  app.post('/api/experiments', requireAuth, (req: AuthenticatedRequest, res) => {
    const b = req.body ?? {};
    const name = nonEmptyString(b.name, 3, 180);
    const hypothesis = nonEmptyString(b.hypothesis, 5, 1000);
    const metricName = nonEmptyString(b.metricName, 2, 100);
    const controlVisitors = boundedNumber(b.controlVisitors ?? 0, 0, 10_000_000);
    const controlConversions = boundedNumber(
      b.controlConversions ?? 0,
      0,
      10_000_000
    );
    const variantVisitors = boundedNumber(b.variantVisitors ?? 0, 0, 10_000_000);
    const variantConversions = boundedNumber(
      b.variantConversions ?? 0,
      0,
      10_000_000
    );

    if (
      !name ||
      !hypothesis ||
      !metricName ||
      controlVisitors === null ||
      controlConversions === null ||
      variantVisitors === null ||
      variantConversions === null
    ) {
      res.status(400).json({ error: 'Invalid experiment definition or sample counts.' });
      return;
    }

    if (
      controlConversions > controlVisitors ||
      variantConversions > variantVisitors
    ) {
      res.status(400).json({
        error: 'Conversions cannot exceed total visitors in an experiment arm.',
      });
      return;
    }

    const validStatuses: ExperimentStatus[] = ['Draft', 'Running', 'Concluded', 'Paused'];
    const status = validStatuses.includes(b.status) ? b.status : 'Draft';
    const nowIso = new Date().toISOString();

    const info = db
      .prepare(
        `INSERT INTO experiments (
          name, hypothesis, metric_name, status,
          control_name, control_visitors, control_conversions,
          variant_name, variant_visitors, variant_conversions,
          outcome_notes, next_step_recommendation, is_synthetic, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`
      )
      .run(
        name,
        hypothesis,
        metricName,
        status,
        nonEmptyString(b.controlName ?? 'Control', 1, 80) ?? 'Control',
        Math.round(controlVisitors),
        Math.round(controlConversions),
        nonEmptyString(b.variantName ?? 'Variant B', 1, 80) ?? 'Variant B',
        Math.round(variantVisitors),
        Math.round(variantConversions),
        typeof b.outcomeNotes === 'string' ? b.outcomeNotes.slice(0, 1000) : '',
        typeof b.nextStepRecommendation === 'string'
          ? b.nextStepRecommendation.slice(0, 500)
          : '',
        nowIso,
        nowIso
      );

    const created = db
      .prepare('SELECT * FROM experiments WHERE id = ?')
      .get(Number(info.lastInsertRowid)) as Record<string, unknown>;

    writeAuditLog(
      db,
      req.authUser!.email,
      req.authUser!.role,
      'CREATE_EXPERIMENT',
      'experiment',
      Number(info.lastInsertRowid),
      { name, status }
    );
    res.status(201).json(mapExperimentRow(created));
  });

  app.patch(
    '/api/experiments/:id',
    requireAuth,
    (req: AuthenticatedRequest, res) => {
      const id = Number(req.params.id);
      const existing = db
        .prepare('SELECT * FROM experiments WHERE id = ?')
        .get(id) as Record<string, unknown> | undefined;
      if (!existing) {
        res.status(404).json({ error: 'Experiment not found.' });
        return;
      }

      const b = req.body ?? {};
      const cVis =
        b.controlVisitors !== undefined
          ? boundedNumber(b.controlVisitors, 0, 10_000_000)
          : Number(existing.control_visitors);
      const cConv =
        b.controlConversions !== undefined
          ? boundedNumber(b.controlConversions, 0, 10_000_000)
          : Number(existing.control_conversions);
      const vVis =
        b.variantVisitors !== undefined
          ? boundedNumber(b.variantVisitors, 0, 10_000_000)
          : Number(existing.variant_visitors);
      const vConv =
        b.variantConversions !== undefined
          ? boundedNumber(b.variantConversions, 0, 10_000_000)
          : Number(existing.variant_conversions);

      if (cVis === null || cConv === null || vVis === null || vConv === null) {
        res.status(400).json({ error: 'Invalid visitor or conversion count.' });
        return;
      }
      if (cConv > cVis || vConv > vVis) {
        res.status(400).json({ error: 'Conversions cannot exceed visitors.' });
        return;
      }

      const validStatuses: ExperimentStatus[] = ['Draft', 'Running', 'Concluded', 'Paused'];
      const status = validStatuses.includes(b.status) ? b.status : existing.status;
      const outcomeNotes =
        typeof b.outcomeNotes === 'string'
          ? b.outcomeNotes.slice(0, 1000)
          : String(existing.outcome_notes ?? '');
      const nextStep =
        typeof b.nextStepRecommendation === 'string'
          ? b.nextStepRecommendation.slice(0, 500)
          : String(existing.next_step_recommendation ?? '');

      const nowIso = new Date().toISOString();
      db.prepare(
        `UPDATE experiments SET
          status = ?, control_visitors = ?, control_conversions = ?,
          variant_visitors = ?, variant_conversions = ?,
          outcome_notes = ?, next_step_recommendation = ?, updated_at = ?
         WHERE id = ?`
      ).run(
        String(status),
        Math.round(cVis),
        Math.round(cConv),
        Math.round(vVis),
        Math.round(vConv),
        outcomeNotes,
        nextStep,
        nowIso,
        id
      );

      writeAuditLog(
        db,
        req.authUser!.email,
        req.authUser!.role,
        'UPDATE_EXPERIMENT',
        'experiment',
        id,
        { status, cVis, cConv, vVis, vConv }
      );

      const updated = db
        .prepare('SELECT * FROM experiments WHERE id = ?')
        .get(id) as Record<string, unknown>;
      res.json(mapExperimentRow(updated));
    }
  );

  // ---------------------------------------------------------------------------
  // Business Case & Pricing Analysis
  // ---------------------------------------------------------------------------
  app.get('/api/business-cases', (_req, res) => {
    const rows = db
      .prepare('SELECT * FROM business_scenarios ORDER BY id ASC')
      .all() as Array<Record<string, unknown>>;
    res.json(
      rows.map((r) => {
        const scenario = mapBusinessRow(r);
        return {
          ...scenario,
          metrics: calculateBusinessCaseMetrics(scenario),
        };
      })
    );
  });

  app.post(
    '/api/business-cases',
    requireAuth,
    (req: AuthenticatedRequest, res) => {
      const b = req.body ?? {};
      const name = nonEmptyString(b.name, 2, 120);
      const tierName = nonEmptyString(b.tierName, 2, 80);
      const monthlyPrice = boundedNumber(b.monthlyPrice, 1, 100_000);
      const estimatedCustomers = boundedNumber(b.estimatedCustomers, 0, 1_000_000);
      const monthlyChurnPct = boundedNumber(b.monthlyChurnPct, 0.1, 100);
      const cac = boundedNumber(b.cac, 0, 500_000);
      const grossMarginPct = boundedNumber(b.grossMarginPct, 1, 100);
      const fixedMonthlyCost = boundedNumber(b.fixedMonthlyCost, 0, 10_000_000);
      const variableCostPerUser = boundedNumber(b.variableCostPerUser, 0, 10_000);

      if (
        !name ||
        !tierName ||
        monthlyPrice === null ||
        estimatedCustomers === null ||
        monthlyChurnPct === null ||
        cac === null ||
        grossMarginPct === null ||
        fixedMonthlyCost === null ||
        variableCostPerUser === null
      ) {
        res.status(400).json({ error: 'Invalid business scenario assumptions.' });
        return;
      }

      const nowIso = new Date().toISOString();
      const info = db
        .prepare(
          `INSERT INTO business_scenarios (
            name, tier_name, monthly_price, estimated_customers,
            monthly_churn_pct, cac, gross_margin_pct, fixed_monthly_cost,
            variable_cost_per_user, notes, is_assumption, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`
        )
        .run(
          name,
          tierName,
          monthlyPrice,
          Math.round(estimatedCustomers),
          monthlyChurnPct,
          cac,
          grossMarginPct,
          fixedMonthlyCost,
          variableCostPerUser,
          typeof b.notes === 'string' ? b.notes.slice(0, 600) : '',
          nowIso,
          nowIso
        );

      const created = mapBusinessRow(
        db
          .prepare('SELECT * FROM business_scenarios WHERE id = ?')
          .get(Number(info.lastInsertRowid)) as Record<string, unknown>
      );
      writeAuditLog(
        db,
        req.authUser!.email,
        req.authUser!.role,
        'CREATE_BUSINESS_SCENARIO',
        'business_scenario',
        created.id,
        { name }
      );
      res.status(201).json({
        ...created,
        metrics: calculateBusinessCaseMetrics(created),
      });
    }
  );

  app.patch(
    '/api/business-cases/:id',
    requireAuth,
    (req: AuthenticatedRequest, res) => {
      const id = Number(req.params.id);
      const existing = db
        .prepare('SELECT * FROM business_scenarios WHERE id = ?')
        .get(id) as Record<string, unknown> | undefined;
      if (!existing) {
        res.status(404).json({ error: 'Business scenario not found.' });
        return;
      }

      const b = req.body ?? {};
      const monthlyPrice =
        b.monthlyPrice !== undefined
          ? boundedNumber(b.monthlyPrice, 1, 100_000)
          : Number(existing.monthly_price);
      const estimatedCustomers =
        b.estimatedCustomers !== undefined
          ? boundedNumber(b.estimatedCustomers, 0, 1_000_000)
          : Number(existing.estimated_customers);
      const monthlyChurnPct =
        b.monthlyChurnPct !== undefined
          ? boundedNumber(b.monthlyChurnPct, 0.1, 100)
          : Number(existing.monthly_churn_pct);
      const cac =
        b.cac !== undefined ? boundedNumber(b.cac, 0, 500_000) : Number(existing.cac);
      const grossMarginPct =
        b.grossMarginPct !== undefined
          ? boundedNumber(b.grossMarginPct, 1, 100)
          : Number(existing.gross_margin_pct);
      const fixedMonthlyCost =
        b.fixedMonthlyCost !== undefined
          ? boundedNumber(b.fixedMonthlyCost, 0, 10_000_000)
          : Number(existing.fixed_monthly_cost);
      const variableCostPerUser =
        b.variableCostPerUser !== undefined
          ? boundedNumber(b.variableCostPerUser, 0, 10_000)
          : Number(existing.variable_cost_per_user);

      if (
        monthlyPrice === null ||
        estimatedCustomers === null ||
        monthlyChurnPct === null ||
        cac === null ||
        grossMarginPct === null ||
        fixedMonthlyCost === null ||
        variableCostPerUser === null
      ) {
        res.status(400).json({ error: 'Invalid assumption value.' });
        return;
      }

      const nowIso = new Date().toISOString();
      db.prepare(
        `UPDATE business_scenarios SET
          monthly_price = ?, estimated_customers = ?, monthly_churn_pct = ?,
          cac = ?, gross_margin_pct = ?, fixed_monthly_cost = ?,
          variable_cost_per_user = ?, notes = ?, updated_at = ?
         WHERE id = ?`
      ).run(
        monthlyPrice,
        Math.round(estimatedCustomers),
        monthlyChurnPct,
        cac,
        grossMarginPct,
        fixedMonthlyCost,
        variableCostPerUser,
        typeof b.notes === 'string' ? b.notes.slice(0, 600) : String(existing.notes ?? ''),
        nowIso,
        id
      );

      writeAuditLog(
        db,
        req.authUser!.email,
        req.authUser!.role,
        'UPDATE_BUSINESS_SCENARIO',
        'business_scenario',
        id
      );

      const updated = mapBusinessRow(
        db
          .prepare('SELECT * FROM business_scenarios WHERE id = ?')
          .get(id) as Record<string, unknown>
      );
      res.json({
        ...updated,
        metrics: calculateBusinessCaseMetrics(updated),
      });
    }
  );

  // ---------------------------------------------------------------------------
  // UX & Customer Journey Artifacts
  // ---------------------------------------------------------------------------
  app.get('/api/ux-artifacts', (_req, res) => {
    const rows = db
      .prepare('SELECT * FROM ux_artifacts ORDER BY id ASC')
      .all() as Array<Record<string, unknown>>;
    const items: UxArtifact[] = rows.map((r) => ({
      id: Number(r.id),
      type: r.type as UxArtifactType,
      title: String(r.title),
      subtitle: String(r.subtitle),
      content: JSON.parse(String(r.content_json || '{}')),
      status: String(r.status),
      isTemplate: Boolean(r.is_template),
      createdAt: String(r.created_at),
      updatedAt: String(r.updated_at),
    }));
    res.json(items);
  });

  app.post('/api/ux-artifacts', requireAuth, (req: AuthenticatedRequest, res) => {
    const b = req.body ?? {};
    const validTypes: UxArtifactType[] = [
      'persona',
      'journey_stage',
      'pain_point',
      'user_story',
    ];
    if (!validTypes.includes(b.type)) {
      res.status(400).json({ error: 'Invalid UX artifact type.' });
      return;
    }
    const title = nonEmptyString(b.title, 3, 180);
    if (!title) {
      res.status(400).json({ error: 'Title is required.' });
      return;
    }

    const nowIso = new Date().toISOString();
    const info = db
      .prepare(
        `INSERT INTO ux_artifacts (type, title, subtitle, content_json, status, is_template, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 0, ?, ?)`
      )
      .run(
        b.type,
        title,
        typeof b.subtitle === 'string' ? b.subtitle.slice(0, 180) : '',
        JSON.stringify(b.content ?? {}),
        typeof b.status === 'string' ? b.status.slice(0, 40) : 'Active',
        nowIso,
        nowIso
      );

    const row = db
      .prepare('SELECT * FROM ux_artifacts WHERE id = ?')
      .get(Number(info.lastInsertRowid)) as Record<string, unknown>;
    writeAuditLog(
      db,
      req.authUser!.email,
      req.authUser!.role,
      'CREATE_UX_ARTIFACT',
      'ux_artifact',
      Number(info.lastInsertRowid)
    );

    res.status(201).json({
      id: Number(row.id),
      type: row.type,
      title: String(row.title),
      subtitle: String(row.subtitle),
      content: JSON.parse(String(row.content_json || '{}')),
      status: String(row.status),
      isTemplate: Boolean(row.is_template),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    });
  });

  app.patch(
    '/api/ux-artifacts/:id',
    requireAuth,
    (req: AuthenticatedRequest, res) => {
      const id = Number(req.params.id);
      const existing = db
        .prepare('SELECT * FROM ux_artifacts WHERE id = ?')
        .get(id) as Record<string, unknown> | undefined;
      if (!existing) {
        res.status(404).json({ error: 'UX artifact not found.' });
        return;
      }

      const b = req.body ?? {};
      const title =
        b.title !== undefined ? nonEmptyString(b.title, 2, 180) : String(existing.title);
      if (!title) {
        res.status(400).json({ error: 'Title cannot be empty.' });
        return;
      }

      const nowIso = new Date().toISOString();
      db.prepare(
        'UPDATE ux_artifacts SET title = ?, subtitle = ?, content_json = ?, status = ?, is_template = 0, updated_at = ? WHERE id = ?'
      ).run(
        title,
        typeof b.subtitle === 'string'
          ? b.subtitle.slice(0, 180)
          : String(existing.subtitle),
        b.content ? JSON.stringify(b.content) : String(existing.content_json),
        typeof b.status === 'string' ? b.status.slice(0, 40) : String(existing.status),
        nowIso,
        id
      );

      const updated = db
        .prepare('SELECT * FROM ux_artifacts WHERE id = ?')
        .get(id) as Record<string, unknown>;
      res.json({
        id: Number(updated.id),
        type: updated.type,
        title: String(updated.title),
        subtitle: String(updated.subtitle),
        content: JSON.parse(String(updated.content_json || '{}')),
        status: String(updated.status),
        isTemplate: Boolean(updated.is_template),
        createdAt: String(updated.created_at),
        updatedAt: String(updated.updated_at),
      });
    }
  );

  // ---------------------------------------------------------------------------
  // PM Workspace Documents
  // ---------------------------------------------------------------------------
  app.get('/api/pm-documents', (_req, res) => {
    const rows = db
      .prepare('SELECT * FROM pm_documents ORDER BY updated_at DESC')
      .all() as Array<Record<string, unknown>>;
    const docs: PmDocument[] = rows.map((r) => ({
      id: Number(r.id),
      docType: r.doc_type as PmDocType,
      title: String(r.title),
      status: String(r.status),
      moscow: r.moscow as PmDocument['moscow'],
      sprint: String(r.sprint),
      owner: String(r.owner),
      content: String(r.content),
      createdAt: String(r.created_at),
      updatedAt: String(r.updated_at),
    }));
    res.json(docs);
  });

  app.post('/api/pm-documents', requireAuth, (req: AuthenticatedRequest, res) => {
    const b = req.body ?? {};
    const validTypes: PmDocType[] = [
      'prd',
      'goal',
      'strategy',
      'sprint_note',
      'release_note',
    ];
    if (!validTypes.includes(b.docType)) {
      res.status(400).json({ error: 'Invalid PM document type.' });
      return;
    }
    const title = nonEmptyString(b.title, 3, 180);
    const content = nonEmptyString(b.content, 5, 15000);
    if (!title || !content) {
      res.status(400).json({ error: 'Title and content are required.' });
      return;
    }

    const moscow = MOSCOW_PRIORITIES.includes(b.moscow) ? b.moscow : 'Must Have';
    const nowIso = new Date().toISOString();
    const info = db
      .prepare(
        `INSERT INTO pm_documents (doc_type, title, status, moscow, sprint, owner, content, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        b.docType,
        title,
        typeof b.status === 'string' ? b.status.slice(0, 40) : 'Draft',
        moscow,
        typeof b.sprint === 'string' ? b.sprint.slice(0, 40) : 'Sprint 14',
        typeof b.owner === 'string' && b.owner.trim()
          ? b.owner.trim().slice(0, 80)
          : req.authUser!.name,
        content,
        nowIso,
        nowIso
      );

    writeAuditLog(
      db,
      req.authUser!.email,
      req.authUser!.role,
      'CREATE_PM_DOCUMENT',
      'pm_document',
      Number(info.lastInsertRowid),
      { title, docType: b.docType }
    );

    const row = db
      .prepare('SELECT * FROM pm_documents WHERE id = ?')
      .get(Number(info.lastInsertRowid)) as Record<string, unknown>;
    res.status(201).json({
      id: Number(row.id),
      docType: row.doc_type,
      title: String(row.title),
      status: String(row.status),
      moscow: row.moscow,
      sprint: String(row.sprint),
      owner: String(row.owner),
      content: String(row.content),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    });
  });

  app.patch(
    '/api/pm-documents/:id',
    requireAuth,
    (req: AuthenticatedRequest, res) => {
      const id = Number(req.params.id);
      const existing = db
        .prepare('SELECT * FROM pm_documents WHERE id = ?')
        .get(id) as Record<string, unknown> | undefined;
      if (!existing) {
        res.status(404).json({ error: 'Document not found.' });
        return;
      }

      const b = req.body ?? {};
      const title =
        b.title !== undefined ? nonEmptyString(b.title, 3, 180) : String(existing.title);
      const content =
        b.content !== undefined
          ? nonEmptyString(b.content, 5, 15000)
          : String(existing.content);
      if (!title || !content) {
        res.status(400).json({ error: 'Title and content cannot be empty.' });
        return;
      }

      const moscow = MOSCOW_PRIORITIES.includes(b.moscow)
        ? b.moscow
        : existing.moscow;
      const nowIso = new Date().toISOString();

      db.prepare(
        `UPDATE pm_documents SET title = ?, status = ?, moscow = ?, sprint = ?, content = ?, updated_at = ?
         WHERE id = ?`
      ).run(
        title,
        typeof b.status === 'string' ? b.status.slice(0, 40) : String(existing.status),
        String(moscow),
        typeof b.sprint === 'string' ? b.sprint.slice(0, 40) : String(existing.sprint),
        content,
        nowIso,
        id
      );

      writeAuditLog(
        db,
        req.authUser!.email,
        req.authUser!.role,
        'UPDATE_PM_DOCUMENT',
        'pm_document',
        id
      );

      const updated = db
        .prepare('SELECT * FROM pm_documents WHERE id = ?')
        .get(id) as Record<string, unknown>;
      res.json({
        id: Number(updated.id),
        docType: updated.doc_type,
        title: String(updated.title),
        status: String(updated.status),
        moscow: updated.moscow,
        sprint: String(updated.sprint),
        owner: String(updated.owner),
        content: String(updated.content),
        createdAt: String(updated.created_at),
        updatedAt: String(updated.updated_at),
      });
    }
  );

  // ---------------------------------------------------------------------------
  // AI Product Assistant
  // ---------------------------------------------------------------------------
  app.post('/api/assistant/query', optionalAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const task = (req.body?.task ?? 'general') as AssistantTaskType;
      const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt.slice(0, 2000) : '';

      const overview = computeOverview(db, 14);
      const feedback = (
        db
          .prepare('SELECT * FROM feedback_items ORDER BY created_at DESC LIMIT 40')
          .all() as Array<Record<string, unknown>>
      ).map(mapFeedbackRow);
      const features = (
        db
          .prepare('SELECT * FROM features ORDER BY rice_score DESC')
          .all() as Array<Record<string, unknown>>
      ).map(mapFeatureRow);
      const experiments = (
        db
          .prepare('SELECT * FROM experiments ORDER BY id DESC')
          .all() as Array<Record<string, unknown>>
      ).map(mapExperimentRow);

      const result = await runProductAssistant(task, prompt, {
        overview,
        feedback,
        features,
        experiments,
      });

      if (req.authUser) {
        writeAuditLog(
          db,
          req.authUser.email,
          req.authUser.role,
          'AI_ASSISTANT_QUERY',
          'assistant',
          task,
          { mode: result.mode }
        );
      }

      res.json(result);
    } catch (err) {
      res.status(502).json({
        error:
          err instanceof Error
            ? `AI Assistant error: ${err.message}`
            : 'AI Assistant request failed.',
      });
    }
  });

  // ---------------------------------------------------------------------------
  // PM Deliverables & Research Templates (Served Safely from docs/pm/)
  // ---------------------------------------------------------------------------
  app.get('/api/deliverables', (_req, res) => {
    const docsDir = path.resolve(process.cwd(), 'docs', 'pm');
    if (!fs.existsSync(docsDir)) {
      res.json([]);
      return;
    }

    const files = fs
      .readdirSync(docsDir)
      .filter((f) => f.endsWith('.md'))
      .sort();

    const deliverables = files.map((filename) => {
      const safePath = path.resolve(docsDir, filename);
      if (!safePath.startsWith(docsDir + path.sep)) {
        return null;
      }
      const content = fs.readFileSync(safePath, 'utf8');
      const firstLine = content.split('\n')[0]?.replace(/^#\s*/, '').trim() || filename;
      const isTemplate = filename.startsWith('template_');
      return {
        filename,
        title: firstLine,
        category: isTemplate ? 'Research Template' : 'PM Deliverable',
        content,
      };
    });

    res.json(deliverables.filter(Boolean));
  });

  return app;
}
