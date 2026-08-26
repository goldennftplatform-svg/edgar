const USER_AGENT = "MetapWatch/1.0 (local-dev; mailto:dev@metap.watch)";

export interface Filing {
  id: string;
  type: string;
  company: string;
  cik: string;
  date: string;
  description: string;
  url: string;
  impactScore: number;
  keywords: string[];
}

const HIGH_IMPACT_TYPES = ["8-K", "SC 13D", "SC 13G", "S-1", "FORM D"];
const MEDIUM_IMPACT_TYPES = ["10-K", "10-Q", "DEF 14A", "11-K"];

export async function fetchFilingPulse(count = 30): Promise<Filing[]> {
  const queries = [
    "pursuant to this agreement",
    "material definitive agreement",
    "termination of material definitive agreement",
    "unregistered sales of equity securities",
    "regulation fd disclosure",
    "financial statements and exhibits",
    "entry into a material definitive agreement",
    "global distributed ledger",
    "digital asset",
    "bitcoin",
    "ethereum",
    "solana",
    "blockchain",
    "token",
    "initial coin offering",
    "securities offering",
  ];

  const today = getToday();
  const weekAgo = getDaysAgo(7);

  try {
    const results = await Promise.allSettled(
      queries.map((q) =>
        fetch(
          `https://efts.sec.gov/LATEST/search-index?q=${encodeURIComponent(q)}&dateRange=custom&startdt=${weekAgo}&enddt=${today}&forms=8-K,10-K,10-Q,4,SC%2013G,SC%2013D,S-1,FORM%20D,DEF%2014A&from=0&size=8`,
          {
            headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
            signal: AbortSignal.timeout(8000),
          }
        ).then((r) => r.json())
      )
    );

    const seen = new Set<string>();
    const all: Filing[] = [];

    for (const r of results) {
      if (r.status !== "fulfilled") continue;
      const data = r.value as Record<string, unknown>;
      const hits = (data.hits as Record<string, unknown>)?.hits as Array<Record<string, unknown>> | undefined;
      if (!hits) continue;
      for (const hit of hits) {
        const id = hit._id as string;
        if (seen.has(id)) continue;
        seen.add(id);
        const src = hit._source as Record<string, unknown>;
        const form = (src?.form as string) || (src?.root_forms as string[])?.[0] || "Unknown";
        const names = src?.display_names as string[] | undefined;
        const ciks = src?.ciks as string[] | undefined;

        const keywords = extractKeywords(JSON.stringify(src));
        const impactScore = scoreImpact(form, keywords);

        all.push({
          id,
          type: form,
          company: names?.[0] || "Unknown",
          cik: ciks?.[0] || "",
          date: (src?.file_date as string) || "",
          description: (src?.form_description as string) || "",
          url: `https://www.sec.gov/Archives/edgar/data/${ciks?.[0]?.replace(/^0+/, "") || ""}/${(src?.adsh as string)?.replace(/-/g, "") || ""}/${(src?.adsh as string) || ""}-index.htm`,
          impactScore,
          keywords,
        });
      }
    }

    all.sort((a, b) => b.impactScore - a.impactScore || b.date.localeCompare(a.date));
    return all.length > 0 ? all.slice(0, count) : getMockFilings();
  } catch {
    return getMockFilings();
  }
}

function extractKeywords(text: string): string[] {
  const terms = [
    "acquisition", "merger", "bankruptcy", "delisting", "SEC investigation",
    "restatement", "crypto", "bitcoin", "ethereum", "solana", "blockchain",
    "token", "digital asset", "IPO", "buyback", "dividend", "layoff",
    "CEO departure", "material weakness", "going concern", "fraud",
    "litigation", "settlement", "antitrust", "tariff", "regulation",
  ];
  const lower = text.toLowerCase();
  return terms.filter((t) => lower.includes(t));
}

function scoreImpact(formType: string, keywords: string[]): number {
  let score = 0;
  if (HIGH_IMPACT_TYPES.includes(formType)) score += 60;
  else if (MEDIUM_IMPACT_TYPES.includes(formType)) score += 30;
  else score += 10;

  const highImpactKw = ["bankruptcy", "fraud", "SEC investigation", "material weakness", "going concern", "delisting", "restatement"];
  const midImpactKw = ["acquisition", "merger", "crypto", "bitcoin", "ethereum", "solana", "blockchain", "token", "digital asset", "tariff"];
  for (const kw of keywords) {
    if (highImpactKw.includes(kw)) score += 25;
    else if (midImpactKw.includes(kw)) score += 10;
    else score += 3;
  }

  return Math.min(100, score);
}

function getMockFilings(): Filing[] {
  const now = new Date();
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getTime() - i * 3600000 * 2);
    const types = ["8-K", "10-K", "10-Q", "4", "SC 13D", "S-1"];
    const companies = [
      "Coinbase Global Inc.", "MicroStrategy Inc.", "Riot Platforms Inc.",
      "Marathon Digital Holdings", "Galaxy Digital Holdings", "Block Inc.",
      "PayPal Holdings Inc.", "Visa Inc.", "Mastercard Inc.", "Solana Labs",
    ];
    const t = types[i % types.length];
    return {
      id: `mock-${Date.now()}-${i}`,
      type: t,
      company: companies[i % companies.length],
      cik: String(100000 + i * 1234),
      date: d.toISOString().split("T")[0],
      description: `${t} filing — ${["material event", "annual report", "quarterly update", "insider transaction", "ownership change", "registration"][i % 6]}`,
      url: "#",
      impactScore: Math.floor(30 + Math.random() * 70),
      keywords: ["crypto", "digital asset"].slice(0, 1 + (i % 2)),
    };
  });
}

function getToday(): string {
  return new Date().toISOString().split("T")[0];
}

function getDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split("T")[0];
}
