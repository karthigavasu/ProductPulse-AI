import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

let dbInstance: DatabaseSync | null = null;

export function getDb(customPath?: string): DatabaseSync {
  if (dbInstance && !customPath) {
    return dbInstance;
  }

  const dbPath =
    customPath ??
    process.env.DATABASE_PATH ??
    path.resolve(process.cwd(), 'data', 'productpulse.db');

  if (dbPath !== ':memory:') {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA foreign_keys = ON;');
  runMigrations(db);

  if (!customPath) {
    dbInstance = db;
  }
  return db;
}

export function resetDbInstanceForTests(db: DatabaseSync): void {
  dbInstance = db;
}

export function runMigrations(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);

  const applied = new Set<string>(
    (
      db.prepare('SELECT version FROM schema_migrations').all() as Array<{
        version: string;
      }>
    ).map((r) => r.version)
  );

  const migrations: Array<{ version: string; sql: string }> = [
    {
      version: '001_initial_schema',
      sql: `
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          email TEXT NOT NULL UNIQUE,
          name TEXT NOT NULL,
          role TEXT NOT NULL CHECK (role IN ('admin', 'user')),
          password_hash TEXT NOT NULL,
          created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS daily_metrics (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          date TEXT NOT NULL UNIQUE,
          total_users INTEGER NOT NULL,
          active_users INTEGER NOT NULL,
          new_users INTEGER NOT NULL,
          retained_users INTEGER NOT NULL,
          retention_rate REAL NOT NULL,
          feature_adoption_rate REAL NOT NULL,
          csat_score REAL NOT NULL,
          engagement_score REAL NOT NULL,
          conversion_rate REAL NOT NULL,
          is_synthetic INTEGER NOT NULL DEFAULT 1
        );

        CREATE TABLE IF NOT EXISTS feedback_items (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          content TEXT NOT NULL,
          customer_segment TEXT NOT NULL DEFAULT 'Mid-Market',
          category TEXT NOT NULL CHECK (category IN (
            'Feature Requests',
            'Bug Reports',
            'Usability Issues',
            'Performance Issues',
            'General Suggestions'
          )),
          status TEXT NOT NULL DEFAULT 'New' CHECK (status IN (
            'New',
            'Under Review',
            'Planned',
            'Resolved',
            'Archived'
          )),
          rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
          sentiment TEXT NOT NULL CHECK (sentiment IN ('positive', 'neutral', 'negative')),
          sentiment_score REAL NOT NULL,
          keywords_json TEXT NOT NULL,
          topics_json TEXT NOT NULL,
          analysis_method TEXT NOT NULL DEFAULT 'local-nlp',
          analysis_explanation TEXT NOT NULL,
          is_synthetic INTEGER NOT NULL DEFAULT 0,
          created_by TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS features (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          description TEXT NOT NULL,
          category TEXT NOT NULL,
          reach INTEGER NOT NULL,
          impact REAL NOT NULL,
          confidence INTEGER NOT NULL,
          effort REAL NOT NULL,
          rice_score REAL NOT NULL,
          manual_priority_override INTEGER,
          override_reason TEXT NOT NULL DEFAULT '',
          moscow_priority TEXT NOT NULL DEFAULT 'Should Have' CHECK (moscow_priority IN (
            'Must Have', 'Should Have', 'Could Have', 'Won''t Have'
          )),
          roadmap_status TEXT NOT NULL DEFAULT 'Backlog' CHECK (roadmap_status IN (
            'Backlog', 'Planned', 'In Progress', 'Testing', 'Released'
          )),
          initiative TEXT NOT NULL DEFAULT 'Core Platform',
          target_release_date TEXT NOT NULL DEFAULT '',
          milestone TEXT NOT NULL DEFAULT '',
          sprint TEXT NOT NULL DEFAULT '',
          owner TEXT NOT NULL DEFAULT 'Product Team',
          is_synthetic INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS experiments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          hypothesis TEXT NOT NULL,
          metric_name TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'Draft' CHECK (status IN (
            'Draft', 'Running', 'Concluded', 'Paused'
          )),
          control_name TEXT NOT NULL DEFAULT 'Control',
          control_visitors INTEGER NOT NULL DEFAULT 0,
          control_conversions INTEGER NOT NULL DEFAULT 0,
          variant_name TEXT NOT NULL DEFAULT 'Variant B',
          variant_visitors INTEGER NOT NULL DEFAULT 0,
          variant_conversions INTEGER NOT NULL DEFAULT 0,
          outcome_notes TEXT NOT NULL DEFAULT '',
          next_step_recommendation TEXT NOT NULL DEFAULT '',
          is_synthetic INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS business_scenarios (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          tier_name TEXT NOT NULL,
          monthly_price REAL NOT NULL,
          estimated_customers INTEGER NOT NULL,
          monthly_churn_pct REAL NOT NULL,
          cac REAL NOT NULL,
          gross_margin_pct REAL NOT NULL,
          fixed_monthly_cost REAL NOT NULL,
          variable_cost_per_user REAL NOT NULL,
          notes TEXT NOT NULL DEFAULT '',
          is_assumption INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS ux_artifacts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          type TEXT NOT NULL CHECK (type IN ('persona', 'journey_stage', 'pain_point', 'user_story')),
          title TEXT NOT NULL,
          subtitle TEXT NOT NULL DEFAULT '',
          content_json TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'Template',
          is_template INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS pm_documents (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          doc_type TEXT NOT NULL CHECK (doc_type IN ('prd', 'goal', 'strategy', 'sprint_note', 'release_note')),
          title TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'Draft',
          moscow TEXT NOT NULL DEFAULT 'Must Have' CHECK (moscow IN (
            'Must Have', 'Should Have', 'Could Have', 'Won''t Have'
          )),
          sprint TEXT NOT NULL DEFAULT '',
          owner TEXT NOT NULL DEFAULT 'Product Manager',
          content TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS audit_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          actor_email TEXT NOT NULL,
          actor_role TEXT NOT NULL,
          action TEXT NOT NULL,
          entity_type TEXT NOT NULL,
          entity_id TEXT NOT NULL,
          details_json TEXT NOT NULL,
          created_at TEXT NOT NULL
        );
      `,
    },
  ];

  const insertMigration = db.prepare(
    'INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)'
  );

  for (const m of migrations) {
    if (!applied.has(m.version)) {
      db.exec('BEGIN TRANSACTION;');
      try {
        db.exec(m.sql);
        insertMigration.run(m.version, new Date().toISOString());
        db.exec('COMMIT;');
      } catch (err) {
        db.exec('ROLLBACK;');
        throw err;
      }
    }
  }
}

export function writeAuditLog(
  db: DatabaseSync,
  actorEmail: string,
  actorRole: string,
  action: string,
  entityType: string,
  entityId: string | number,
  details: Record<string, unknown> = {}
): void {
  db.prepare(
    `INSERT INTO audit_logs (actor_email, actor_role, action, entity_type, entity_id, details_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    actorEmail,
    actorRole,
    action,
    entityType,
    String(entityId),
    JSON.stringify(details),
    new Date().toISOString()
  );
}
