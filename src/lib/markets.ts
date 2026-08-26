export interface Market {
  id: string;
  question: string;
  yesPrice: number;
  noPrice: number;
  volume: number;
  liquidity: number;
  endDate: string;
  category: string;
  matchScore: number;
}

export async function fetchMarketPulse(count = 20): Promise<Market[]> {
  try {
    const res = await fetch(
      "https://gamma-api.polymarket.com/events?limit=100&active=true&closed=false",
      { signal: AbortSignal.timeout(12000) }
    );

    if (!res.ok) return getMockMarkets();
    const events = await res.json();

    const allMarkets: Market[] = [];

    for (const event of events as Array<Record<string, unknown>>) {
      const title = (event.title as string) || "";
      const category = detectCategory(title);
      const markets = event.markets as Array<Record<string, unknown>> | undefined;
      if (!markets) continue;

      for (const m of markets) {
        const prices = (typeof m.outcomePrices === "string" ? JSON.parse(m.outcomePrices as string) : m.outcomePrices) as string[];
        const yesPrice = prices?.[0] ? parseFloat(prices[0]) : 0;
        const noPrice = prices?.[1] ? parseFloat(prices[1]) : 0;

        allMarkets.push({
          id: (m.conditionId as string) || (m.id as string) || "",
          question: (m.question as string) || title,
          yesPrice,
          noPrice,
          volume: (m.volume as number) || 0,
          liquidity: (m.liquidity as number) || 0,
          endDate: (m.endDate as string) || "",
          category,
          matchScore: 0,
        });
      }
    }

    const relevant = allMarkets.filter((m) => ["crypto", "finance", "regulation", "geopolitics"].includes(m.category));
    const sorted = (relevant.length >= 5 ? relevant : allMarkets).sort((a, b) => b.volume - a.volume);

    return sorted.length > 0 ? sorted.slice(0, count) : getMockMarkets();
  } catch {
    return getMockMarkets();
  }
}

function detectCategory(question: string): string {
  const lower = question.toLowerCase();
  if (["bitcoin", "ethereum", "solana", "crypto", "blockchain", "token", "defi", "nft", "coinbase", "btc", "eth", "sol "].some((k) => lower.includes(k))) return "crypto";
  if (["fed", "rate", "recession", "inflation", "gdp", "unemployment", "stock", "s&p", "nasdaq", "bank", "treasury", "economy"].some((k) => lower.includes(k))) return "finance";
  if (["sec", "regulation", "etf", "approve", "ban", "enforcement", "fine", "lawsuit", "congress", "legislation", "tax", "capital gains"].some((k) => lower.includes(k))) return "regulation";
  if (["tariff", "trade", "sanction", "war", "china", "russia", "ukraine", "nato", "military", "trump"].some((k) => lower.includes(k))) return "geopolitics";
  return "other";
}

export function matchFilingToMarkets(
  filingKeywords: string[],
  markets: Market[]
): Array<{ market: Market; score: number }> {
  return markets
    .map((m) => {
      let score = 0;
      const q = m.question.toLowerCase();
      for (const kw of filingKeywords) {
        if (q.includes(kw.toLowerCase())) score += 25;
      }
      if (m.category === "crypto" && filingKeywords.some((k) => ["crypto", "bitcoin", "ethereum", "solana", "blockchain", "token", "digital asset"].includes(k))) score += 20;
      if (m.category === "finance" && filingKeywords.some((k) => ["tariff", "recession", "fraud", "bankruptcy", "rate"].includes(k))) score += 20;
      if (m.category === "regulation" && filingKeywords.some((k) => ["SEC", "regulation", "tariff", "ETF"].includes(k))) score += 25;
      if (m.category === "geopolitics" && filingKeywords.some((k) => ["tariff", "trade", "regulation"].includes(k))) score += 15;
      return { market: m, score };
    })
    .filter((m) => m.score > 0)
    .sort((a, b) => b.score - a.score);
}

function getMockMarkets(): Market[] {
  return [
    { id: "m1", question: "When will Bitcoin hit $150K?", yesPrice: 0.42, noPrice: 0.58, volume: 8500000, liquidity: 2100000, endDate: "2026-12-31", category: "crypto", matchScore: 0 },
    { id: "m2", question: "How many Fed rate cuts in 2026?", yesPrice: 0.35, noPrice: 0.65, volume: 5200000, liquidity: 1800000, endDate: "2026-12-31", category: "finance", matchScore: 0 },
    { id: "m3", question: "US recession by end of 2026?", yesPrice: 0.22, noPrice: 0.78, volume: 15000000, liquidity: 4200000, endDate: "2026-12-31", category: "finance", matchScore: 0 },
    { id: "m4", question: "Trump eliminates capital gains tax on crypto by end of 2026?", yesPrice: 0.18, noPrice: 0.82, volume: 3100000, liquidity: 900000, endDate: "2026-12-31", category: "regulation", matchScore: 0 },
  ];
}
