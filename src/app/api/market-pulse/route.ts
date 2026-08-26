import { fetchFilingPulse } from "@/lib/edgar";
import { analyzeFilingWithMagma, type GeneratedMarket } from "@/lib/magma";

export const dynamic = "force-dynamic";

const marketCache: Map<string, GeneratedMarket[]> = new Map();

export async function GET() {
  const result = await fetchFilingPulse(15);
  
  const allMarkets: (GeneratedMarket & { generatedFrom: string; sentiment: number })[] = [];
  
  for (const filing of result.filings.slice(0, 8)) {
    if (marketCache.has(filing.id)) {
      const cachedMarkets = marketCache.get(filing.id)!;
      cachedMarkets.forEach((m) => {
        allMarkets.push({
          ...m,
          generatedFrom: filing.company,
          sentiment: 0.5,
        });
      });
      continue;
    }
    
    try {
      const analysis = await analyzeFilingWithMagma({
        id: filing.id,
        type: filing.type,
        company: filing.company,
        date: filing.date,
        description: filing.description,
        keywords: filing.keywords,
      });
      
      marketCache.set(filing.id, analysis.generatedMarkets);
      
      analysis.generatedMarkets.forEach((m) => {
        allMarkets.push({
          ...m,
          generatedFrom: filing.company,
          sentiment: analysis.sentiment,
        });
      });
    } catch {
      continue;
    }
  }

  allMarkets.sort((a, b) => b.confidenceFromFiling - a.confidenceFromFiling);

  return Response.json({ markets: allMarkets, source: result.source, error: result.error });
}
