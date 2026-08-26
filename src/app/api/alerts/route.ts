import { fetchFilingPulse } from "@/lib/edgar";
import { analyzeFilingWithMagma } from "@/lib/magma";

export const dynamic = "force-dynamic";

interface Alert {
  id: string;
  type: "filing_spike" | "high_impact" | "market_match" | "crypto_filing" | "sec_action";
  severity: "critical" | "high" | "medium" | "low";
  title: string;
  body: string;
  filing?: { type: string; company: string; impactScore: number; keywords: string[] };
  matchedMarket?: { question: string; yesPrice: number; category: string };
  matchScore?: number;
  direction?: "bullish" | "bearish" | "neutral";
  timestamp: number;
  read: boolean;
}

const alertHistory: Alert[] = [];

export async function GET() {
  const result = await fetchFilingPulse(15);
  
  const newAlerts: Alert[] = [];
  
  for (const filing of result.filings.slice(0, 5)) {
    if (filing.impactScore < 30) continue;
    
    const existingAlert = alertHistory.find((a) => a.filing?.type === filing.type && a.filing?.company === filing.company);
    if (existingAlert) continue;
    
    try {
      const analysis = await analyzeFilingWithMagma({
        id: filing.id,
        type: filing.type,
        company: filing.company,
        date: filing.date,
        description: filing.description,
        keywords: filing.keywords,
      });
      
      let severity: Alert["severity"] = "low";
      let type: Alert["type"] = "filing_spike";
      
      if (filing.impactScore >= 70) {
        severity = "critical";
        type = "high_impact";
      } else if (filing.impactScore >= 50) {
        severity = "high";
        type = "crypto_filing";
      } else if (filing.impactScore >= 30) {
        severity = "medium";
        type = "market_match";
      }
      
      const direction = analysis.sentiment >= 0.6 ? "bullish" : 
                       analysis.sentiment <= 0.4 ? "bearish" : "neutral";
      
      const alert: Alert = {
        id: `alert-${filing.id}`,
        type,
        severity,
        title: `${filing.type} — ${filing.company.split("(")[0].trim()}`,
        body: analysis.keyFindings[0] || `Impact score ${filing.impactScore}/100`,
        filing: {
          type: filing.type,
          company: filing.company,
          impactScore: filing.impactScore,
          keywords: filing.keywords,
        },
        matchedMarket: analysis.generatedMarkets[0] ? {
          question: analysis.generatedMarkets[0].question,
          yesPrice: analysis.generatedMarkets[0].yesInitial,
          category: analysis.generatedMarkets[0].category,
        } : undefined,
        matchScore: analysis.generatedMarkets[0]?.confidenceFromFiling,
        direction,
        timestamp: Date.now(),
        read: false,
      };
      
      newAlerts.push(alert);
      alertHistory.unshift(alert);
    } catch {
      continue;
    }
  }
  
  alertHistory.sort((a, b) => b.timestamp - a.timestamp);
  
  const limitedHistory = alertHistory.slice(0, 50);
  
  return Response.json({ newAlerts, history: limitedHistory, source: result.source });
}

export async function POST(request: Request) {
  const body = await request.json();
  
  if (body.action === "markRead" && body.id) {
    const alert = alertHistory.find((a) => a.id === body.id);
    if (alert) {
      alert.read = true;
    }
    return Response.json({ ok: true });
  }
  
  return Response.json({ error: "Unknown action" }, { status: 400 });
}
