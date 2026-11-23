import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import type { Server } from 'node:http';
import { createApp } from '../server/app.js';
import {
  hashPassword,
  signAuthToken,
  verifyAuthToken,
  verifyPassword,
} from '../server/auth.js';
import { runMigrations } from '../server/db.js';
import { analyzeFeedbackLocal, detectRecurringComplaints } from '../server/nlp.js';
import { seedDatabaseIfEmpty } from '../server/seed.js';
import {
  calculateAbTestStatistics,
  calculateBusinessCaseMetrics,
  calculateRiceScore,
} from '../server/stats.js';
import { parseFeedbackCsv } from '../server/validation.js';

describe('RICE Prioritization Engine', () => {
  it('calculates (Reach * Impact * Confidence%) / Effort accurately', () => {
    expect(calculateRiceScore(3200, 2, 90, 1.5)).toBe(3840);
    expect(calculateRiceScore(1400, 3, 85, 3.0)).toBe(1190);
    expect(calculateRiceScore(1000, 0.5, 50, 2)).toBe(125);
  });

  it('rejects invalid effort or out-of-bounds confidence', () => {
    expect(() => calculateRiceScore(100, 1, 80, 0)).toThrow();
    expect(() => calculateRiceScore(100, 1, 120, 1)).toThrow();
  });
});

describe('A/B Testing Statistical Significance Engine', () => {
  it('identifies a statistically significant positive lift with large samples', () => {
    const stats = calculateAbTestStatistics(4200, 1176, 4180, 1388);
    expect(stats.sampleAdequate).toBe(true);
    expect(stats.isSignificant).toBe(true);
    expect(stats.pValue).not.toBeNull();
    expect(stats.pValue!).toBeLessThan(0.05);
    expect(stats.absoluteLift).toBeGreaterThan(4);
  });

  it('refuses to fabricate significance when sample size is too small', () => {
    const stats = calculateAbTestStatistics(20, 4, 20, 8);
    expect(stats.sampleAdequate).toBe(false);
    expect(stats.isSignificant).toBe(false);
    expect(stats.pValue).toBeNull();
    expect(stats.caveat).toMatch(/too small/i);
  });
});

describe('Business Case & Unit Economics Calculator', () => {
  it('computes MRR, ARR, LTV, CAC payback, and break-even customers', () => {
    const m = calculateBusinessCaseMetrics({
      monthlyPrice: 100,
      estimatedCustomers: 200,
      monthlyChurnPct: 2,
      cac: 400,
      grossMarginPct: 80,
      fixedMonthlyCost: 7000,
      variableCostPerUser: 10,
    });
    expect(m.mrr).toBe(20000);
    expect(m.arr).toBe(240000);
    expect(m.ltv).toBe(4000);
    expect(m.ltvCacRatio).toBe(10);
    expect(m.breakEvenCustomers).toBe(100);
  });
});

describe('Local NLP Sentiment & Clustering Engine', () => {
  it('detects negative sentiment, performance topic, and transparent explanation', () => {
    const res = analyzeFeedbackLocal(
      'Slow dashboard timeout',
      'Loading the 90-day chart is extremely slow and causes a timeout error.',
      1
    );
    expect(res.sentiment).toBe('negative');
    expect(res.sentimentScore).toBeLessThan(0);
    expect(res.topics).toContain('Performance & Latency');
    expect(res.suggestedCategory).toBe('Performance Issues');
    expect(res.explanation).toContain('Local lexicon engine');
  });

  it('handles negated positive words properly', () => {
    const res = analyzeFeedbackLocal(
      'Onboarding experience',
      'The navigation layout is not intuitive and not helpful at all.',
      2
    );
    expect(res.sentiment).toBe('negative');
  });

  it('clusters recurring negative feedback items by topic', () => {
    const sample = [
      {
        id: 1,
        title: 'Export timeout',
        content: 'Slow export',
        customerSegment: 'Enterprise',
        category: 'Performance Issues' as const,
        status: 'New' as const,
        rating: 2,
        sentiment: 'negative' as const,
        sentimentScore: -0.6,
        keywords: ['slow', 'timeout'],
        topics: ['Performance & Latency'],
        analysisMethod: 'local-nlp' as const,
        analysisExplanation: 'test',
        isSynthetic: false,
        createdBy: 'test',
        createdAt: '2026-11-23',
        updatedAt: '2026-11-23',
      },
      {
        id: 2,
        title: 'Chart lag',
        content: 'Laggy filter',
        customerSegment: 'SMB',
        category: 'Performance Issues' as const,
        status: 'New' as const,
        rating: 2,
        sentiment: 'negative' as const,
        sentimentScore: -0.5,
        keywords: ['laggy'],
        topics: ['Performance & Latency'],
        analysisMethod: 'local-nlp' as const,
        analysisExplanation: 'test',
        isSynthetic: false,
        createdBy: 'test',
        createdAt: '2026-11-23',
        updatedAt: '2026-11-23',
      },
    ];
    const clusters = detectRecurringComplaints(sample);
    expect(clusters[0].topic).toBe('Performance & Latency');
    expect(clusters[0].count).toBe(2);
  });
});

describe('CSV Validation & Parser', () => {
  it('strips UTF-8 BOM and parses quoted fields cleanly', () => {
    const csv = `\uFEFFtitle,content,customer_segment,category,rating\n"CSV timeout, urgent","Export crashes at 50k rows",Enterprise,"Bug Reports",1`;
    const parsed = parseFeedbackCsv(csv);
    expect(parsed.errors).toHaveLength(0);
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0].title).toBe('CSV timeout, urgent');
    expect(parsed.rows[0].rating).toBe(1);
  });

  it('reports invalid rating rows without crashing', () => {
    const csv = `title,content,rating\n"Bad row","Valid body",9`;
    const parsed = parseFeedbackCsv(csv);
    expect(parsed.rows).toHaveLength(0);
    expect(parsed.errors[0]).toMatch(/invalid rating/i);
  });
});

describe('Authentication Crypto & Token Verification', () => {
  it('hashes and verifies scrypt passwords', () => {
    const hash = hashPassword('SuperSecure123!');
    expect(verifyPassword('SuperSecure123!', hash)).toBe(true);
    expect(verifyPassword('WrongPassword', hash)).toBe(false);
  });

  it('signs and verifies Bearer tokens', () => {
    const token = signAuthToken({
      id: 7,
      email: 'pm@example.com',
      name: 'Taylor PM',
      role: 'admin',
      createdAt: '2026-11-23T00:00:00Z',
    });
    const decoded = verifyAuthToken(token);
    expect(decoded?.sub).toBe(7);
    expect(decoded?.role).toBe('admin');
    expect(verifyAuthToken(`${token}tampered`)).toBeNull();
  });
});

describe('Full-Stack API Integration Tests (SQLite + Express)', () => {
  let db: DatabaseSync;
  let server: Server;
  let baseUrl: string;
  let adminToken = '';
  let userToken = '';

  beforeAll(async () => {
    delete process.env.ADMIN_PASSCODE;
    db = new DatabaseSync(':memory:');
    runMigrations(db);
    seedDatabaseIfEmpty(db);
    const app = createApp(db);
    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const addr = server.address();
        if (addr && typeof addr === 'object') {
          baseUrl = `http://127.0.0.1:${addr.port}`;
        }
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    db.close();
  });

  it('serves overview KPIs calculated from seeded synthetic records', async () => {
    const res = await fetch(`${baseUrl}/api/analytics/overview?days=14`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.hasSyntheticData).toBe(true);
    expect(body.kpis.feedbackVolume).toBeGreaterThanOrEqual(16);
    expect(body.series).toHaveLength(14);
  });

  it('blocks unauthenticated mutations and locks first-run admin bootstrap after claim', async () => {
    const unauth = await fetch(`${baseUrl}/api/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Test', content: 'Should fail', rating: 4 }),
    });
    expect(unauth.status).toBe(401);

    const claim = await fetch(`${baseUrl}/api/auth/claim-admin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@productpulse.ai',
        name: 'Workspace Admin',
        password: 'AdminPassword123!',
      }),
    });
    expect(claim.status).toBe(201);
    const claimBody = await claim.json();
    adminToken = claimBody.token;
    expect(claimBody.user.role).toBe('admin');

    // Second claim attempt must be rejected
    const secondClaim = await fetch(`${baseUrl}/api/auth/claim-admin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'attacker@example.com',
        name: 'Attacker',
        password: 'Password123!',
      }),
    });
    expect(secondClaim.status).toBe(403);
  });

  it('enforces RBAC between standard user and admin', async () => {
    const reg = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'analyst@productpulse.ai',
        name: 'Standard Analyst',
        password: 'AnalystPassword123!',
      }),
    });
    expect(reg.status).toBe(201);
    const regBody = await reg.json();
    userToken = regBody.token;

    // Standard user cannot access admin audit logs
    const forbiddenLogs = await fetch(`${baseUrl}/api/admin/audit-logs`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    expect(forbiddenLogs.status).toBe(403);

    // Admin can access audit logs
    const adminLogs = await fetch(`${baseUrl}/api/admin/audit-logs`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(adminLogs.status).toBe(200);
  });

  it('creates feedback, computes RICE override with mandatory rationale, and logs audit entry', async () => {
    const fbRes = await fetch(`${baseUrl}/api/feedback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({
        title: 'Love the fast query filters',
        content: 'Filtering cohorts is super smooth and reliable.',
        rating: 5,
      }),
    });
    expect(fbRes.status).toBe(201);
    const fb = await fbRes.json();
    expect(fb.sentiment).toBe('positive');

    // Missing overrideReason must return 400
    const featuresRes = await fetch(`${baseUrl}/api/features`);
    const features = await featuresRes.json();
    const firstId = features[0].id;

    const badOverride = await fetch(`${baseUrl}/api/features/${firstId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({ manualPriorityOverride: 1, overrideReason: '' }),
    });
    expect(badOverride.status).toBe(400);

    const goodOverride = await fetch(`${baseUrl}/api/features/${firstId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        manualPriorityOverride: 1,
        overrideReason: 'Executive Q4 customer commitment',
      }),
    });
    expect(goodOverride.status).toBe(200);
    const updatedFeature = await goodOverride.json();
    expect(updatedFeature.manualPriorityOverride).toBe(1);

    const logsRes = await fetch(`${baseUrl}/api/admin/audit-logs`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const logs = await logsRes.json();
    expect(logs.some((l: { action: string }) => l.action === 'UPDATE_FEATURE')).toBe(
      true
    );
  });
});
