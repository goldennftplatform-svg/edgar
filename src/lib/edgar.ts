const USER_AGENT = "EdgarWatch/1.0 (local-dev; mailto:dev@edgar.watch)";

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

export interface FetchResult {
  filings: Filing[];
  source: "edgar" | "mock";
  error?: string;
}

export async function fetchFilingPulse(count = 20): Promise<FetchResult> {
  const queries = [
    "material definitive agreement",
    "unregistered sales of equity securities",
    "regulation fd disclosure",
    "digital asset",
    "bitcoin",
    "ethereum",
    "solana",
    "blockchain",
    "token",
    "global distributed ledger",
    "entry into a material definitive agreement",
    "financial statements and exhibits",
    "securities offering",
    "annual report",
    "quarterly report",
    "current report",
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
        ).then((r) => {
          if (!r.ok) throw new Error(`EDGAR ${r.status}`);
          return r.json();
        })
      )
    );

    const seen = new Set<string>();
    const all: Filing[] = [];
    let successCount = 0;

    for (const r of results) {
      if (r.status !== "fulfilled") continue;
      successCount++;
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

    if (all.length > 0) {
      all.sort((a, b) => b.impactScore - a.impactScore || b.date.localeCompare(a.date));
      return { filings: all.slice(0, count), source: "edgar" };
    }

    if (successCount > 0) {
      return { filings: getMockFilings(count), source: "mock", error: "EDGAR returned no results" };
    }

    return { filings: getMockFilings(count), source: "mock", error: "EDGAR API unreachable" };
  } catch (e) {
    return { filings: getMockFilings(count), source: "mock", error: String(e) };
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
  if (["8-K", "SC 13D", "SC 13G", "S-1", "FORM D"].includes(formType)) score += 60;
  else if (["10-K", "10-Q", "DEF 14A"].includes(formType)) score += 30;
  else score += 10;

  const hi = ["bankruptcy", "fraud", "SEC investigation", "material weakness", "going concern", "delisting", "restatement"];
  const mid = ["acquisition", "merger", "crypto", "bitcoin", "ethereum", "solana", "blockchain", "token", "digital asset", "tariff"];
  for (const kw of keywords) {
    if (hi.includes(kw)) score += 25;
    else if (mid.includes(kw)) score += 10;
    else score += 3;
  }
  return Math.min(100, score);
}

function getMockFilings(count: number): Filing[] {
  const now = new Date();
  const mockData = [
    { type: "8-K", company: "Coinbase Global Inc.  (COIN)  (CIK 0001679788)", keywords: ["crypto", "digital asset", "blockchain"], impactScore: 85 },
    { type: "10-K", company: "MicroStrategy Inc.  (MSTR)  (CIK 0001050446)", keywords: ["bitcoin", "crypto", "digital asset"], impactScore: 78 },
    { type: "8-K", company: "Riot Platforms Inc.  (RIOT)  (CIK 0001167419)", keywords: ["bitcoin", "crypto"], impactScore: 72 },
    { type: "SC 13D", company: "Galaxy Digital Holdings  (GLXY)  (CIK 0001830681)", keywords: ["crypto", "bitcoin"], impactScore: 70 },
    { type: "S-1", company: "Solana Labs  (SOL)  (CIK 0002018938)", keywords: ["solana", "blockchain", "token"], impactScore: 82 },
    { type: "8-K", company: "Block Inc.  (SQ)  (CIK 0001512673)", keywords: ["bitcoin", "crypto", "digital asset"], impactScore: 68 },
    { type: "10-Q", company: "PayPal Holdings Inc.  (PYPL)  (CIK 0001633917)", keywords: ["crypto", "token"], impactScore: 55 },
    { type: "8-K", company: "JPMorgan Chase & Co.  (JPM)  (CIK 0000019617)", keywords: ["tariff", "regulation"], impactScore: 65 },
    { type: "4", company: "ARK Investment Management  (CIK 0001649339)", keywords: ["bitcoin", "crypto"], impactScore: 60 },
    { type: "8-K", company: "Visa Inc.  (V)  (CIK 0001403161)", keywords: ["crypto", "digital asset", "token"], impactScore: 58 },
  ];
  return mockData.slice(0, count).map((m, i) => ({
    id: `mock-${Date.now()}-${i}`,
    ...m,
    cik: String(100000 + i * 1234),
    date: new Date(now.getTime() - i * 3600000 * 3).toISOString().split("T")[0],
    description: `${m.type} — ${m.keywords.join(", ")}`,
    url: "#",
  }));
}

function getToday(): string { return new Date().toISOString().split("T")[0]; }
function getDaysAgo(days: number): string {
  const d = new Date(); d.setDate(d.getDate() - days); return d.toISOString().split("T")[0];
}
