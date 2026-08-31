/**
 * Persistence layer with graceful fallback.
 *
 * When a Postgres connection (`POSTGRES_URL`) is configured and reachable we use
 * Vercel Postgres for durable storage. Otherwise we degrade to lightweight
 * in-memory stores so the dashboard never breaks (project failover philosophy).
 *
 * IMPORTANT: in-memory state does NOT survive serverless cold starts or scale to
 * multiple instances — it is a local-dev / no-secrets fallback only.
 */
import { sql as pg } from "@vercel/postgres";

const DB_CONFIGURED = !!process.env.POSTGRES_URL;

type Prim = string | number | boolean | undefined | null;
/** Coerce an unknown value from a loose record into a SQL primitive. */
const p = (v: unknown): Prim =>
  v === undefined || v === null ? v : (v as string | number | boolean);

let pgHealthy: boolean | null = null;
let lastProbe = 0;

async function dbAvailable(): Promise<boolean> {
  if (!DB_CONFIGURED) return false;
  // Cache health probe for 30s to avoid a query on every request.
  if (pgHealthy !== null && Date.now() - lastProbe < 30_000) return pgHealthy;
  try {
    await pg`SELECT 1`;
    pgHealthy = true;
  } catch {
    pgHealthy = false;
  }
  lastProbe = Date.now();
  return pgHealthy;
}

export async function isPersistent(): Promise<boolean> {
  return dbAvailable();
}

export async function initSchema(): Promise<boolean> {
  if (!(await dbAvailable())) return false;
  const fs = await import("fs");
  const path = await import("path");
  const sqlPath = path.join(process.cwd(), "db", "schema.sql");
  const script = fs.readFileSync(sqlPath, "utf8");
  // Strip `--` line comments, then split into individual statements. Each DDL
  // statement is executed separately (schema uses CREATE ... IF NOT EXISTS so
  // re-running is safe). Neon serverless does not allow multiple statements in
  // a single query, hence the loop.
  const statements = script
    .split("\n")
    .map((l) => l.split("--")[0])
    .join("\n")
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
  for (const stmt of statements) {
    await pg.query(stmt);
  }
  return true;
}

// ---------------------------------------------------------------------------
// In-memory fallback stores
// ---------------------------------------------------------------------------

export interface UsageEvent {
  kind: string;
  actor: string;
  tokens?: number;
  costUnits?: number;
}

interface FilingInput {
  id: unknown;
  type: unknown;
  company: unknown;
  cik?: unknown;
  date?: unknown;
  description?: unknown;
  url?: unknown;
  impactScore?: unknown;
  keywords?: unknown;
  source?: unknown;
}

interface AnalysisInput {
  company?: unknown;
  formType?: unknown;
  filedDate?: unknown;
  entities?: unknown;
  sentiment?: unknown;
  sentimentLabel?: unknown;
  riskScore?: unknown;
  materialityScore?: unknown;
  keyFindings?: unknown;
  financialSignals?: unknown;
  regulatorySignals?: unknown;
  marketMovingEvents?: unknown;
}

interface MarketInput {
  id?: unknown;
  filingId?: unknown;
  generatedFrom?: unknown;
  question?: unknown;
  category?: unknown;
  yesInitial?: unknown;
  noInitial?: unknown;
  timeHorizon?: unknown;
  resolutionSource?: unknown;
  reasoning?: unknown;
  relatedEntities?: unknown;
  confidenceFromFiling?: unknown;
  sentiment?: unknown;
}

interface AlertInput {
  id?: unknown;
  type?: unknown;
  severity?: unknown;
  title?: unknown;
  body?: unknown;
  filingId?: unknown;
  filingType?: unknown;
  filingCompany?: unknown;
  impactScore?: unknown;
  matchedQuestion?: unknown;
  matchScore?: unknown;
  direction?: unknown;
}

const memFilings = new Map<string, unknown>();
const memAnalyses = new Map<string, unknown>();
const memMarkets = new Map<string, unknown>();
const memAlerts = new Map<string, unknown>();
const memUsage: UsageEvent[] = [];

// ---------------------------------------------------------------------------
// Filings
// ---------------------------------------------------------------------------

export async function upsertFiling(f: FilingInput): Promise<void> {
  if (await dbAvailable()) {
    await pg`
      INSERT INTO filings (id, type, company, cik, date, description, url, impact_score, keywords, source)
      VALUES (${p(f.id)}, ${p(f.type)}, ${p(f.company)}, ${p(f.cik)}, ${p(f.date)}, ${p(f.description)}, ${p(f.url)}, ${p(f.impactScore)}, ${JSON.stringify(f.keywords)}, ${p(f.source ?? "edgar")})
      ON CONFLICT (id) DO NOTHING
    `;
    return;
  }
  memFilings.set(f.id as string, f);
}

export async function upsertFilings(filings: FilingInput[]): Promise<void> {
  for (const f of filings) await upsertFiling(f);
}

// ---------------------------------------------------------------------------
// Analyses
// ---------------------------------------------------------------------------

export async function upsertAnalysis(id: string, a: AnalysisInput): Promise<void> {
  if (await dbAvailable()) {
    await pg`
      INSERT INTO analyses (
        filing_id, company, form_type, filed_date, entities, sentiment, sentiment_label,
        risk_score, materiality_score, key_findings, financial_signals, regulatory_signals,
        market_moving_events, raw
      )
      VALUES (
        ${p(id)}, ${p(a.company)}, ${p(a.formType)}, ${p(a.filedDate)}, ${JSON.stringify(a.entities ?? [])},
        ${p(a.sentiment ?? 0.5)}, ${p(a.sentimentLabel ?? "neutral")}, ${p(a.riskScore ?? 30)},
        ${p(a.materialityScore ?? 40)}, ${JSON.stringify(a.keyFindings ?? [])},
        ${JSON.stringify(a.financialSignals ?? [])}, ${JSON.stringify(a.regulatorySignals ?? [])},
        ${JSON.stringify(a.marketMovingEvents ?? [])}, ${JSON.stringify(a)}
      )
      ON CONFLICT (filing_id) DO UPDATE SET
        analyzed_at = now(),
        raw = EXCLUDED.raw
    `;
    return;
  }
  memAnalyses.set(id, a);
}

export async function recentAnalyses(limit = 20): Promise<Record<string, unknown>[]> {
  if (await dbAvailable()) {
    const rows = await pg`
      SELECT * FROM analyses ORDER BY analyzed_at DESC LIMIT ${limit}
    `;
    return (rows.rows as Array<Record<string, unknown>>).map((r) => ({
      filingId: r.filing_id,
      company: r.company,
      formType: r.form_type,
      filedDate: r.filed_date,
      entities: r.entities,
      sentiment: r.sentiment,
      sentimentLabel: r.sentiment_label,
      riskScore: r.risk_score,
      materialityScore: r.materiality_score,
      keyFindings: r.key_findings,
      financialSignals: r.financial_signals,
      regulatorySignals: r.regulatory_signals,
      marketMovingEvents: r.market_moving_events,
    }));
  }
  return [...memAnalyses.values()].slice(-limit) as Record<string, unknown>[];
}

// ---------------------------------------------------------------------------
// Markets
// ---------------------------------------------------------------------------

export async function upsertMarkets(markets: MarketInput[]): Promise<void> {
  if (await dbAvailable()) {
    for (const m of markets) {
      await pg`
        INSERT INTO markets (
          id, filing_id, generated_from, question, category, yes_initial, no_initial,
          time_horizon, resolution_source, reasoning, related_entities, confidence, sentiment
        )
        VALUES (
          ${p(m.id)}, ${p(m.filingId)}, ${p(m.generatedFrom)}, ${p(m.question)}, ${p(m.category)},
          ${p(m.yesInitial)}, ${p(m.noInitial)}, ${p(m.timeHorizon)}, ${p(m.resolutionSource)},
          ${p(m.reasoning)}, ${JSON.stringify(m.relatedEntities ?? [])}, ${p(m.confidenceFromFiling)},
          ${p(m.sentiment ?? 0.5)}
        )
        ON CONFLICT (id) DO NOTHING
      `;
    }
    return;
  }
  for (const m of markets) memMarkets.set(m.id as string, m);
}

export async function recentMarkets(limit = 50): Promise<Record<string, unknown>[]> {
  if (await dbAvailable()) {
    const rows = await pg`
      SELECT * FROM markets ORDER BY confidence DESC LIMIT ${limit}
    `;
    return (rows.rows as Array<Record<string, unknown>>).map((r) => ({
      id: r.id,
      question: r.question,
      category: r.category,
      yesInitial: r.yes_initial,
      noInitial: r.no_initial,
      timeHorizon: r.time_horizon,
      resolutionSource: r.resolution_source,
      reasoning: r.reasoning,
      relatedEntities: r.related_entities,
      confidenceFromFiling: r.confidence,
      generatedFrom: r.generated_from,
      sentiment: r.sentiment,
    }));
  }
  return [...memMarkets.values()].slice(-limit) as Record<string, unknown>[];
}

// ---------------------------------------------------------------------------
// Alerts
// ---------------------------------------------------------------------------

export async function upsertAlert(a: AlertInput): Promise<void> {
  if (await dbAvailable()) {
    await pg`
      INSERT INTO alerts (
        id, type, severity, title, body, filing_id, filing_type, filing_company,
        impact_score, matched_question, match_score, direction, read
      )
      VALUES (
        ${p(a.id)}, ${p(a.type)}, ${p(a.severity)}, ${p(a.title)}, ${p(a.body)}, ${p(a.filingId)}, ${p(a.filingType)},
        ${p(a.filingCompany)}, ${p(a.impactScore)}, ${p(a.matchedQuestion)}, ${p(a.matchScore)}, ${p(a.direction)}, false
      )
      ON CONFLICT (id) DO NOTHING
    `;
    return;
  }
  memAlerts.set(a.id as string, a);
}

export async function recentAlerts(limit = 50): Promise<Record<string, unknown>[]> {
  if (await dbAvailable()) {
    const rows = await pg`
      SELECT * FROM alerts ORDER BY created_at DESC LIMIT ${limit}
    `;
    return (rows.rows as Array<Record<string, unknown>>).map((r) => ({
      id: r.id,
      type: r.type,
      severity: r.severity,
      title: r.title,
      body: r.body,
      filing: r.filing_type || r.filing_company
        ? { type: r.filing_type, company: r.filing_company, impactScore: r.impact_score }
        : undefined,
      matchedMarket: r.matched_question
        ? { question: r.matched_question }
        : undefined,
      matchScore: r.match_score,
      direction: r.direction,
      timestamp: Number(r.created_at),
      read: r.read,
    }));
  }
  return [...memAlerts.values()].reverse().slice(-limit) as Record<string, unknown>[];
}

export async function markAlertRead(id: string): Promise<void> {
  if (await dbAvailable()) {
    await pg`UPDATE alerts SET read = true WHERE id = ${p(id)}`;
    return;
  }
  const a = memAlerts.get(id) as { read?: boolean } | undefined;
  if (a) a.read = true;
}

// ---------------------------------------------------------------------------
// Usage accounting (spend / rate limiting)
// ---------------------------------------------------------------------------

export async function recordUsage(ev: UsageEvent): Promise<void> {
  if (await dbAvailable()) {
    await pg`
      INSERT INTO usage (kind, actor, tokens, cost_units)
      VALUES (${p(ev.kind)}, ${p(ev.actor)}, ${p(ev.tokens ?? 0)}, ${p(ev.costUnits ?? 0)})
    `;
    return;
  }
  memUsage.push(ev);
}

export async function usageWindow(opts: {
  kind: string;
  actor: string;
  windowSeconds: number;
}): Promise<{ count: number; cost: number }> {
  if (await dbAvailable()) {
    const rows = await pg`
      SELECT count(*)::int AS cnt, coalesce(sum(cost_units),0)::float8 AS cost
      FROM usage
      WHERE kind = ${p(opts.kind)}
        AND actor = ${p(opts.actor)}
        AND consumed_at > now() - make_interval(secs => ${p(opts.windowSeconds)})
    `;
    const r = rows.rows[0];
    return { count: r.cnt, cost: r.cost };
  }
  const agg = memUsage.filter((u) => u.kind === opts.kind && u.actor === opts.actor).slice(-60);
  return {
    count: agg.length,
    cost: agg.reduce((s, u) => s + (u.costUnits ?? 0), 0),
  };
}
