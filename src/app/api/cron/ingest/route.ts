import { fetchFilingPulse } from "@/lib/edgar";
import { analyzeFilingWithMagma } from "@/lib/magma";
import { upsertFilings, upsertAnalysis, upsertMarkets } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Scheduled ingest: pulls recent EDGAR filings every few hours (see
 * vercel.json) and persists them + analyses + generated markets so the
 * dashboard has durable, pre-computed data instead of computing on every view.
 * Guarded by CRON_SECRET as required by Vercel for cron jobs.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET || "";
  const auth = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  const queryKey = new URL(request.url).searchParams.get("key") || "";
  if (secret && auth !== secret && queryKey !== secret) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const result = await fetchFilingPulse(20);
  if (result.source === "edgar") {
    await upsertFilings(result.filings.map((f) => ({ ...f, source: result.source })));
  }

  let analyzed = 0;
  let markets = 0;
  for (const filing of result.filings.slice(0, 8)) {
    try {
      const analysis = await analyzeFilingWithMagma({
        id: filing.id,
        type: filing.type,
        company: filing.company,
        date: filing.date,
        description: filing.description,
        keywords: filing.keywords,
      });
      await upsertAnalysis(filing.id, analysis);
      await upsertMarkets(
        analysis.generatedMarkets.map((m) => ({
          ...m,
          filingId: filing.id,
          generatedFrom: filing.company,
          sentiment: analysis.sentiment,
        }))
      );
      analyzed++;
      markets += analysis.generatedMarkets.length;
    } catch {
      // skip individual filing failures
    }
  }

  return Response.json({
    ok: true,
    source: result.source,
    error: result.error ?? null,
    filingsPersisted: result.filings.length,
    analyzed,
    markets,
  });
}
