import { fetchFilingPulse } from "@/lib/edgar";
import { analyzeFilingWithMagma, type GeneratedMarket } from "@/lib/magma";
import { upsertFilings, upsertMarkets } from "@/lib/db";

export const dynamic = "force-dynamic";

const marketCache: Map<string, GeneratedMarket[]> = new Map();

export async function GET() {
  const result = await fetchFilingPulse(15);
  await upsertFilings(
    result.filings.map((f) => ({ ...f, source: result.source }))
  );

  const allMarkets: (GeneratedMarket & { generatedFrom: string; sentiment: number })[] = [];

  for (const filing of result.filings.slice(0, 8)) {
    let markets: GeneratedMarket[];
    let sentiment = 0.5;

    if (marketCache.has(filing.id)) {
      markets = marketCache.get(filing.id)!;
    } else {
      try {
        const analysis = await analyzeFilingWithMagma({
          id: filing.id,
          type: filing.type,
          company: filing.company,
          date: filing.date,
          description: filing.description,
          keywords: filing.keywords,
        });
        markets = analysis.generatedMarkets;
        sentiment = analysis.sentiment;
        marketCache.set(filing.id, markets);
      } catch {
        continue;
      }
    }

    markets.forEach((m) => {
      allMarkets.push({
        ...m,
        generatedFrom: filing.company,
        sentiment,
      });
    });

    await upsertMarkets(
      markets.map((m) => ({
        ...m,
        filingId: filing.id,
        generatedFrom: filing.company,
        confidenceFromFiling: m.confidenceFromFiling,
        sentiment,
      }))
    );
  }

  allMarkets.sort((a, b) => b.confidenceFromFiling - a.confidenceFromFiling);

  return Response.json({ markets: allMarkets, source: result.source, error: result.error });
}
