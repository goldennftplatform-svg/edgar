import type { Filing } from "./edgar";

export interface AIAnalysis {
  filingId: string;
  summary: string;
  marketImpact: string;
  sentiment: "bullish" | "bearish" | "neutral";
  confidence: number;
  suggestedMarkets: string[];
  riskFlags: string[];
  timestamp: number;
}

const GEOFF_API_KEY = process.env.GEOFF_API_KEY || "";
const GEOFF_BASE = "https://api.geoff.ai/v1";

export async function analyzeFiling(filing: Filing): Promise<AIAnalysis> {
  if (GEOFF_API_KEY) {
    try {
      return await callGeoffMagma(filing);
    } catch {
      return generateLocalAnalysis(filing);
    }
  }
  return generateLocalAnalysis(filing);
}

async function callGeoffMagma(filing: Filing): Promise<AIAnalysis> {
  const res = await fetch(`${GEOFF_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${GEOFF_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "magma",
      messages: [
        {
          role: "system",
          content: `You are a financial filing analyst. Analyze SEC filings and predict their impact on prediction markets. Return JSON with: summary, marketImpact, sentiment (bullish/bearish/neutral), confidence (0-1), suggestedMarkets (array of market descriptions), riskFlags (array).`,
        },
        {
          role: "user",
          content: `Analyze this SEC filing:\nType: ${filing.type}\nCompany: ${filing.company}\nDate: ${filing.date}\nKeywords: ${filing.keywords.join(", ")}\nDescription: ${filing.description}\nImpact Score: ${filing.impactScore}/100`,
        },
      ],
      temperature: 0.3,
      max_tokens: 500,
    }),
    signal: AbortSignal.timeout(15000),
  });

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content || "";
  const parsed = JSON.parse(content);
  return {
    filingId: filing.id,
    summary: parsed.summary || "",
    marketImpact: parsed.marketImpact || "",
    sentiment: parsed.sentiment || "neutral",
    confidence: parsed.confidence || 0.5,
    suggestedMarkets: parsed.suggestedMarkets || [],
    riskFlags: parsed.riskFlags || [],
    timestamp: Date.now(),
  };
}

function generateLocalAnalysis(filing: Filing): AIAnalysis {
  const type = filing.type;
  const kw = filing.keywords;
  const company = filing.company.split("(")[0].trim();

  let sentiment: "bullish" | "bearish" | "neutral" = "neutral";
  let confidence = 0.4;
  const riskFlags: string[] = [];
  const suggestedMarkets: string[] = [];

  const isNegative = kw.some((k) =>
    ["bankruptcy", "fraud", "SEC investigation", "material weakness", "going concern", "delisting", "restatement"].includes(k)
  );
  const isPositive = kw.some((k) =>
    ["acquisition", "merger", "buyback", "dividend", "IPO"].includes(k)
  );
  const isCrypto = kw.some((k) =>
    ["crypto", "bitcoin", "ethereum", "solana", "blockchain", "token", "digital asset"].includes(k)
  );

  if (isNegative) {
    sentiment = "bearish";
    confidence = 0.75;
    riskFlags.push("Negative filing event detected");
  } else if (isPositive) {
    sentiment = "bullish";
    confidence = 0.65;
  } else if (isCrypto) {
    sentiment = "bullish";
    confidence = 0.5;
    suggestedMarkets.push("Crypto market sentiment", "Bitcoin price prediction");
  }

  if (type === "8-K") {
    confidence += 0.1;
    if (isNegative) riskFlags.push("8-K material event — immediate market reaction expected");
  }
  if (type.includes("13D") || type.includes("13G")) {
    suggestedMarkets.push("Institutional sentiment");
    confidence += 0.05;
  }

  const summary = generateSummary(filing, sentiment, isCrypto);
  const marketImpact = generateMarketImpact(filing, sentiment, isCrypto);

  if (isCrypto) suggestedMarkets.push("Crypto ETF decisions", "Digital asset regulation");
  if (filing.type === "10-K") suggestedMarkets.push("Company financial health");

  return {
    filingId: filing.id,
    summary,
    marketImpact,
    sentiment,
    confidence: Math.min(0.95, confidence),
    suggestedMarkets: [...new Set(suggestedMarkets)].slice(0, 4),
    riskFlags: [...new Set(riskFlags)],
    timestamp: Date.now(),
  };
}

function generateSummary(filing: Filing, sentiment: string, isCrypto: boolean): string {
  const company = filing.company.split("(")[0].trim();
  const parts = [
    `${company} filed a ${filing.type} on ${filing.date}.`,
  ];
  if (filing.keywords.length > 0) {
    parts.push(`Key topics: ${filing.keywords.slice(0, 4).join(", ")}.`);
  }
  if (isCrypto) {
    parts.push("Filing contains digital asset / blockchain references — relevant to crypto prediction markets.");
  }
  if (sentiment === "bearish") {
    parts.push("This filing carries negative signals that may impact related prediction contracts.");
  } else if (sentiment === "bullish") {
    parts.push("This filing carries positive signals that may boost related prediction contracts.");
  }
  return parts.join(" ");
}

function generateMarketImpact(filing: Filing, sentiment: string, isCrypto: boolean): string {
  const company = filing.company.split("(")[0].trim();
  if (filing.type === "8-K") {
    return `8-K material event from ${company} — expect immediate price action in related prediction markets. ${isCrypto ? "Crypto-adjacent filing." : ""} Sentiment: ${sentiment}.`;
  }
  if (filing.type.includes("13D") || filing.type.includes("13G")) {
    return `Institutional/activist position at ${company} signals conviction. Watch for market movements on ${filing.keywords.slice(0, 2).join(" and ")} related contracts.`;
  }
  if (filing.type === "10-K") {
    return `Annual report from ${company} — full financial picture. Risk factors and forward guidance will influence prediction market pricing over coming days.`;
  }
  return `${filing.type} from ${company} with ${filing.impactScore}/100 impact score. Monitor related markets for ${sentiment} pressure.`;
}
