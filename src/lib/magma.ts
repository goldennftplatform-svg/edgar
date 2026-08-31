import { createStackNetProvider, generateObject } from "@stacknet/sdk";
import {
  parseFilingIntelligence,
  type FilingIntelligence,
  type GeneratedMarket,
} from "@/lib/schema";

const GEOFF_API_KEY = process.env.GEOFF_API_KEY || "";
const GEOFF_BASE = "https://geoff.ai/api/v1";

const magmaProvider = GEOFF_API_KEY
  ? createStackNetProvider({
      name: "geoff",
      baseURL: GEOFF_BASE,
      apiKey: GEOFF_API_KEY,
      supportsStructuredOutputs: true,
    })
  : null;

export { type FilingIntelligence, type GeneratedMarket } from "@/lib/schema";
export { generatedMarketSchema, filingIntelligenceSchema } from "@/lib/schema";

export async function analyzeFilingWithMagma(filing: {
  id: string;
  type: string;
  company: string;
  date: string;
  description: string;
  keywords: string[];
}): Promise<FilingIntelligence> {
  if (GEOFF_API_KEY) {
    try {
      return await callMagma(filing);
    } catch {
      return generateLocalIntelligence(filing);
    }
  }
  return generateLocalIntelligence(filing);
}

async function callMagma(filing: {
  id: string;
  type: string;
  company: string;
  date: string;
  description: string;
  keywords: string[];
}): Promise<FilingIntelligence> {
  if (!magmaProvider) throw new Error("Magma provider not configured");

  const prompt = `You are an expert SEC filing analyst and prediction market creator.

Analyze this SEC filing and generate prediction markets based on its contents:

FILING:
- Type: ${filing.type}
- Company: ${filing.company}
- Date: ${filing.date}
- Keywords: ${filing.keywords.join(", ")}
- Description: ${filing.description}

Return a JSON object with this EXACT structure:
{
  "company": "${filing.company}",
  "formType": "${filing.type}",
  "filedDate": "${filing.date}",
  "entities": ["list of named entities/companies/people mentioned"],
  "sentiment": 0.0 to 1.0,
  "sentimentLabel": "very_bearish|bearish|neutral|bullish|very_bullish",
  "riskScore": 0 to 100,
  "materialityScore": 0 to 100,
  "keyFindings": ["2-4 key takeaways from the filing"],
  "financialSignals": ["revenue, earnings, debt signals"],
  "regulatorySignals": ["SEC, compliance, legal signals"],
  "marketMovingEvents": ["events that could move prediction markets"],
  "generatedMarkets": [
    {
      "question": "Will [company] [specific event] by [date]?",
      "category": "binary|range|outcome",
      "yesInitial": 0.0 to 1.0,
      "noInitial": 0.0 to 1.0,
      "timeHorizon": "30d|90d|6m|1y",
      "resolutionSource": "SEC filings, earnings, public data",
      "reasoning": "Why this market is relevant based on the filing",
      "relatedEntities": ["entities"],
      "confidenceFromFiling": 0.0 to 1.0
    }
  ]
}

Generate 2-4 prediction markets per filing. Make them specific, tradeable, and directly tied to what the filing reveals.`;

  const model = magmaProvider("magma");
  const result = await generateObject({
    model,
    output: "no-schema",
    system: "You are Magma, an expert SEC filing analyst and prediction market generator. Always return valid JSON matching the requested structure.",
    prompt,
    temperature: 0.3,
    maxOutputTokens: 1500,
  });

  const parsed = (result.object ?? {}) as Record<string, unknown>;

  const intelligence = parseFilingIntelligence({
    ...parsed,
    filingId: filing.id,
    // The model may not emit stable ids for generated markets; assign our own.
    generatedMarkets: ((parsed.generatedMarkets as Record<string, unknown>[] | undefined) ?? []).map((m, i) => ({
      ...m,
      id: (m.id as string) || `gen-${filing.id}-${i}`,
    })),
  });

  return intelligence;
}

function generateLocalIntelligence(filing: {
  id: string;
  type: string;
  company: string;
  date: string;
  keywords: string[];
}): FilingIntelligence {
  const company = filing.company.split("(")[0].trim();
  const kw = filing.keywords;
  const isCrypto = kw.some((k) => ["crypto", "bitcoin", "ethereum", "solana", "blockchain", "token", "digital asset"].includes(k));
  const isNegative = kw.some((k) => ["bankruptcy", "fraud", "sec investigation", "material weakness", "going concern", "delisting"].includes(k));
  const isPositive = kw.some((k) => ["acquisition", "merger", "buyback", "dividend", "revenue growth"].includes(k));
  const is8K = filing.type === "8-K";
  const is13D = filing.type.includes("13D") || filing.type.includes("13G");

  let sentiment = 0.5;
  let sentimentLabel: FilingIntelligence["sentimentLabel"] = "neutral";
  let riskScore = 30;
  let materialityScore = 40;

  if (isNegative) { sentiment = 0.2; sentimentLabel = "bearish"; riskScore = 75; materialityScore = 80; }
  else if (isPositive) { sentiment = 0.7; sentimentLabel = "bullish"; riskScore = 25; materialityScore = 70; }
  else if (isCrypto) { sentiment = 0.6; sentimentLabel = "bullish"; riskScore = 35; materialityScore = 60; }
  else if (is8K) { sentiment = 0.5; sentimentLabel = "neutral"; riskScore = 50; materialityScore = 75; }
  else if (is13D) { sentiment = 0.65; sentimentLabel = "bullish"; riskScore = 30; materialityScore = 65; }

  if (filing.type === "10-K" || filing.type === "10-Q") { materialityScore = 85; riskScore = 55; }

  const entities = [company];
  if (isCrypto) entities.push("Bitcoin", "Ethereum", "Solana");
  if (is13D) entities.push("Institutional Investor");

  const keyFindings: string[] = [];
  if (is8K) keyFindings.push(`Material event disclosed via 8-K by ${company}`);
  if (isNegative) keyFindings.push("Negative signals detected in filing keywords");
  if (isPositive) keyFindings.push("Positive corporate action announced");
  if (isCrypto) keyFindings.push("Digital asset / blockchain activity disclosed");
  if (keyFindings.length === 0) keyFindings.push(`Standard ${filing.type} filing from ${company}`);

  const financialSignals: string[] = [];
  if (filing.type === "10-K") financialSignals.push("Annual financial statements", "Risk factors disclosure");
  if (filing.type === "10-Q") financialSignals.push("Quarterly financial update");
  if (isPositive) financialSignals.push("Potential value-creating event");
  if (isNegative) financialSignals.push("Potential value-destructive event");

  const regulatorySignals: string[] = [];
  if (kw.includes("sec")) regulatorySignals.push("SEC regulatory activity");
  if (kw.includes("tariff")) regulatorySignals.push("Trade policy impact");
  if (kw.includes("regulation")) regulatorySignals.push("Regulatory compliance event");

  const marketMovingEvents: string[] = [];
  if (is8K) marketMovingEvents.push("8-K material event — immediate market attention");
  if (is13D) marketMovingEvents.push("Activist/institutional position — signals conviction");
  if (isNegative) marketMovingEvents.push("Risk event — potential downside catalyst");
  if (isCrypto) marketMovingEvents.push("Crypto ecosystem signal — watch digital asset markets");

  const generatedMarkets: GeneratedMarket[] = [];

  if (is8K || is13D) {
    generatedMarkets.push({
      id: `gen-${filing.id}-0`,
      question: `Will ${company} stock move more than 5% in the next 5 trading days?`,
      category: "binary",
      yesInitial: isNegative ? 0.75 : isPositive ? 0.65 : 0.45,
      noInitial: isNegative ? 0.25 : isPositive ? 0.35 : 0.55,
      timeHorizon: "5d",
      resolutionSource: "Public market price data",
      reasoning: `${filing.type} filing signals ${sentimentLabel} sentiment. Material events typically trigger price movement.`,
      relatedEntities: entities,
      confidenceFromFiling: materialityScore / 100,
    });
  }

  if (isCrypto) {
    generatedMarkets.push({
      id: `gen-${filing.id}-1`,
      question: `Will Bitcoin exceed $${Math.floor(80000 + Math.random() * 40000).toLocaleString()} by end of ${getHorizon("90d")}?`,
      category: "binary",
      yesInitial: 0.4 + Math.random() * 0.2,
      noInitial: 0.6 - Math.random() * 0.2,
      timeHorizon: "90d",
      resolutionSource: "Public price feeds",
      reasoning: `Crypto-related filing from ${company} may influence market sentiment toward digital assets.`,
      relatedEntities: ["Bitcoin", "Ethereum", company],
      confidenceFromFiling: 0.5,
    });
  }

  if (isNegative) {
    generatedMarkets.push({
      id: `gen-${filing.id}-2`,
      question: `Will ${company} face enforcement action within 6 months?`,
      category: "binary",
      yesInitial: 0.3 + Math.random() * 0.3,
      noInitial: 0.7 - Math.random() * 0.3,
      timeHorizon: "6m",
      resolutionSource: "SEC enforcement database, court records",
      reasoning: `Negative keywords detected: ${kw.filter((k) => ["bankruptcy", "fraud", "sec investigation", "material weakness"].includes(k)).join(", ")}. Elevated regulatory risk.`,
      relatedEntities: [company, "SEC"],
      confidenceFromFiling: riskScore / 100,
    });
  }

  if (isPositive && (is8K || filing.type === "S-1")) {
    generatedMarkets.push({
      id: `gen-${filing.id}-3`,
      question: `Will ${company} complete a major corporate event by ${getHorizon("6m")}?`,
      category: "binary",
      yesInitial: 0.55 + Math.random() * 0.2,
      noInitial: 0.45 - Math.random() * 0.2,
      timeHorizon: "6m",
      resolutionSource: "SEC filings, press releases",
      reasoning: `Positive filing signals potential M&A, IPO, or other corporate event.`,
      relatedEntities: [company],
      confidenceFromFiling: materialityScore / 100,
    });
  }

  if (generatedMarkets.length === 0) {
    generatedMarkets.push({
      id: `gen-${filing.id}-0`,
      question: `Will ${company} meet or exceed analyst expectations next quarter?`,
      category: "binary",
      yesInitial: 0.5,
      noInitial: 0.5,
      timeHorizon: "90d",
      resolutionSource: "Earnings reports",
      reasoning: `Standard filing — no strong directional signal. Market defaults to baseline probability.`,
      relatedEntities: [company],
      confidenceFromFiling: 0.3,
    });
  }

  return parseFilingIntelligence({
    filingId: filing.id,
    company,
    formType: filing.type,
    filedDate: filing.date,
    entities,
    sentiment,
    sentimentLabel,
    riskScore,
    materialityScore,
    keyFindings,
    financialSignals,
    regulatorySignals,
    marketMovingEvents,
    generatedMarkets,
  });
}

function getHorizon(h: string): string {
  const d = new Date();
  if (h === "30d") d.setDate(d.getDate() + 30);
  else if (h === "90d") d.setDate(d.getDate() + 90);
  else if (h === "6m") d.setMonth(d.getMonth() + 6);
  else d.setFullYear(d.getFullYear() + 1);
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}
