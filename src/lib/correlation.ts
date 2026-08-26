import type { Filing } from "./edgar";
import type { Market } from "./markets";
import { matchFilingToMarkets } from "./markets";

export interface Correlation {
  filing: Filing;
  matchedMarkets: Array<{
    market: Market;
    score: number;
    direction: "bullish" | "bearish" | "neutral";
    reasoning: string;
  }>;
  overallImpact: "high" | "medium" | "low";
  timestamp: number;
}

const MARKET_CATEGORY_KEYWORDS: Record<string, string[]> = {
  crypto: ["crypto", "bitcoin", "btc", "ethereum", "eth", "solana", "sol", "blockchain", "token", "defi", "coinbase", "digital asset", "meta", "base"],
  finance: ["fed", "rate", "recession", "inflation", "economy", "gdp", "unemployment", "stock", "bank", "treasury", "market"],
  regulation: ["sec", "regulation", "etf", "tax", "legislation", "congress", "approve", "ban", "compliance"],
  geopolitics: ["tariff", "trade", "sanction", "war", "china", "russia", "trump", "government", "military"],
};

export function buildCorrelations(
  filings: Filing[],
  markets: Market[]
): Correlation[] {
  const enriched = filings
    .filter((f) => f.impactScore >= 15)
    .map((filing) => {
      const directMatches = matchFilingToMarkets(filing.keywords, markets);
      const categoryMatches = matchByCategory(filing, markets);
      const merged = mergeMatches(directMatches, categoryMatches);

      const matchedMarkets = merged.slice(0, 5).map((m) => ({
        market: m.market,
        score: m.score,
        direction: inferDirection(filing, m.market) as "bullish" | "bearish" | "neutral",
        reasoning: generateReasoning(filing, m.market),
      }));

      const overallImpact: "high" | "medium" | "low" =
        filing.impactScore >= 70 ? "high" : filing.impactScore >= 40 ? "medium" : "low";

      return {
        filing,
        matchedMarkets,
        overallImpact,
        timestamp: Date.now(),
      };
    });

  return enriched
    .filter((c) => c.matchedMarkets.length > 0)
    .sort((a, b) => b.filing.impactScore - a.filing.impactScore);
}

function matchByCategory(filing: Filing, markets: Market[]): Array<{ market: Market; score: number }> {
  const filingText = `${filing.type} ${filing.company} ${filing.keywords.join(" ")}`.toLowerCase();
  const results: Array<{ market: Market; score: number }> = [];

  for (const market of markets) {
    let score = 0;
    const q = market.question.toLowerCase();

    if (filingText.includes("crypto") || filingText.includes("bitcoin") || filingText.includes("ethereum") || filingText.includes("solana") || filingText.includes("blockchain") || filingText.includes("token") || filingText.includes("digital asset")) {
      if (market.category === "crypto") score += 30;
    }

    if (filingText.includes("tariff") || filingText.includes("trade") || filingText.includes("sanction")) {
      if (market.category === "geopolitics") score += 25;
    }

    if (filingText.includes("sec") || filingText.includes("regulation") || filingText.includes("etf")) {
      if (market.category === "regulation") score += 25;
    }

    if (filingText.includes("fed") || filingText.includes("rate") || filingText.includes("recession") || filingText.includes("inflation")) {
      if (market.category === "finance") score += 25;
    }

    if (filing.type === "8-K" && market.category !== "other") score += 8;
    if (filing.type.includes("13D") || filing.type.includes("13G")) {
      if (q.includes("win") || q.includes("exceed") || q.includes("hit")) score += 10;
    }

    const companyName = filing.company.split("(")[0].trim().toLowerCase();
    if (q.includes(companyName) || companyName.includes(q.split(" ")[0])) score += 40;

    if (score > 0) results.push({ market, score });
  }

  return results.sort((a, b) => b.score - a.score);
}

function mergeMatches(
  direct: Array<{ market: Market; score: number }>,
  category: Array<{ market: Market; score: number }>
): Array<{ market: Market; score: number }> {
  const seen = new Map<string, number>();
  for (const m of direct) {
    seen.set(m.market.id, (seen.get(m.market.id) || 0) + m.score);
  }
  for (const m of category) {
    seen.set(m.market.id, (seen.get(m.market.id) || 0) + m.score);
  }

  const all = new Map<string, Market>();
  for (const m of direct) all.set(m.market.id, m.market);
  for (const m of category) all.set(m.market.id, m.market);

  return Array.from(seen.entries())
    .map(([id, score]) => ({ market: all.get(id)!, score }))
    .sort((a, b) => b.score - a.score);
}

function inferDirection(filing: Filing, market: Market): string {
  const kw = filing.keywords.map((k) => k.toLowerCase());
  const q = market.question.toLowerCase();

  if (kw.includes("bankruptcy") || kw.includes("fraud") || kw.includes("sec investigation") || kw.includes("delisting")) return "bearish";
  if (kw.includes("acquisition") || kw.includes("merger") || kw.includes("buyback") || kw.includes("dividend")) return "bullish";
  if (kw.includes("crypto") || kw.includes("bitcoin") || kw.includes("ethereum") || kw.includes("solana") || kw.includes("blockchain")) {
    if (q.includes("hit") || q.includes("exceed") || q.includes("launch")) return "bullish";
    if (q.includes("ban") || q.includes("crash") || q.includes("decline")) return "bearish";
    return "bullish";
  }
  if (kw.includes("tariff") || kw.includes("regulation") || kw.includes("sec")) {
    if (q.includes("recession") || q.includes("no ") || q.includes("ban")) return "bearish";
    return "neutral";
  }
  if (kw.includes("fed") || kw.includes("rate") || kw.includes("recession")) {
    if (q.includes("rate cut") && !q.includes("no ")) return "bullish";
    if (q.includes("recession")) return "bearish";
  }
  return "neutral";
}

function generateReasoning(filing: Filing, market: Market): string {
  const company = filing.company.split("(")[0].trim();
  const q = market.question;
  const kw = filing.keywords.slice(0, 3).join(", ");

  if (filing.type === "8-K") {
    return `${company} 8-K (${kw}) → "${q}"`;
  }
  if (filing.type.includes("13D") || filing.type.includes("13G")) {
    return `Activist position at ${company} signals conviction on "${q}"`;
  }
  if (filing.type === "10-K") {
    return `Annual disclosure: ${company}. Financial health impacts "${q}"`;
  }
  return `${filing.type} by ${company} [${kw}] correlates with "${q}"`;
}
