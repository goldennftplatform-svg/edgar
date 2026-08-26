import { fetchFilingPulse } from "@/lib/edgar";
import { analyzeFilingWithMagma, type FilingIntelligence } from "@/lib/magma";

export const dynamic = "force-dynamic";

const analysisCache: Map<string, FilingIntelligence> = new Map();

export async function GET() {
  const result = await fetchFilingPulse(15);
  
  const analyses: (FilingIntelligence & { source: "edgar" | "mock" })[] = [];
  
  for (const filing of result.filings.slice(0, 5)) {
    if (analysisCache.has(filing.id)) {
      analyses.push({ ...analysisCache.get(filing.id)!, source: result.source });
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
      
      analysisCache.set(filing.id, analysis);
      analyses.push({ ...analysis, source: result.source });
    } catch {
      continue;
    }
  }

  return Response.json({ analyses, source: result.source, error: result.error });
}
