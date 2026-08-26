import { fetchFilingPulse } from "@/lib/edgar";
import { analyzeFilingWithMagma, type FilingIntelligence } from "@/lib/magma";

export const dynamic = "force-dynamic";

const analysisCache: Map<string, FilingIntelligence> = new Map();

export async function GET() {
  const filings = await fetchFilingPulse(15);
  
  const analyses: FilingIntelligence[] = [];
  
  for (const filing of filings.slice(0, 5)) {
    if (analysisCache.has(filing.id)) {
      analyses.push(analysisCache.get(filing.id)!);
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
      analyses.push(analysis);
    } catch {
      continue;
    }
  }

  return Response.json({ analyses });
}
