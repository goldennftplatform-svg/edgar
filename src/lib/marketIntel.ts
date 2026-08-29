import { fetchFilingPulse } from "@/lib/edgar";
import { analyzeFilingWithMagma, type FilingIntelligence } from "@/lib/magma";
import { paidToolCall } from "@/lib/x402";

export interface MarketIntel {
  tool: string;
  scope: "recent" | "company";
  filings: FilingIntelligence[];
  generatedMarkets: number;
  signal: "high" | "medium" | "low";
  note: string;
}

const TOOL_NAME = "market-intel";

/**
 * The pay-per-call MCP tool. Analyzes recent EDGAR filings with Magma and
 * returns scored companies + generated prediction-market contracts.
 * Designed to be monetized via x402 (pay-per-call) when a gateway is present.
 */
export async function getMarketIntel(
  args: { company?: string; limit?: number; minImpact?: number }
): Promise<MarketIntel> {
  const limit = Math.min(args.limit ?? 5, 20);
  const minImpact = args.minImpact ?? 40;

  const result = await fetchFilingPulse(20);
  let filings = result.filings.filter((f) => f.impactScore >= minImpact);

  if (args.company) {
    const c = args.company.toLowerCase();
    filings = filings.filter((f) => f.company.toLowerCase().includes(c));
  }

  filings = filings.slice(0, limit);

  const analyses: FilingIntelligence[] = [];
  for (const filing of filings) {
    try {
      const a = await analyzeFilingWithMagma({
        id: filing.id,
        type: filing.type,
        company: filing.company,
        date: filing.date,
        description: filing.description,
        keywords: filing.keywords,
      });
      analyses.push(a);
    } catch { /* skip */ }
  }

  const generatedMarkets = analyses.reduce(
    (sum, a) => sum + a.generatedMarkets.length,
    0
  );
  const anyHigh = analyses.some((a) => a.materialityScore >= 70);
  const signal: MarketIntel["signal"] = anyHigh ? "high" : analyses.length > 0 ? "medium" : "low";

  return {
    tool: TOOL_NAME,
    scope: args.company ? "company" : "recent",
    filings: analyses,
    generatedMarkets,
    signal,
    note: "Paid market-intel: Magma-scored SEC filings + generated prediction contracts.",
  };
}

export async function getMarketIntelPaid(
  args: { company?: string; limit?: number; minImpact?: number }
) {
  return paidToolCall(TOOL_NAME, args, () => getMarketIntel(args));
}
