import { z } from "zod";

export const generatedMarketSchema = z.object({
  id: z.string().optional(),
  question: z.string(),
  category: z.enum(["binary", "range", "outcome"]).default("binary"),
  yesInitial: z.number().min(0).max(1).default(0.5),
  noInitial: z.number().min(0).max(1).default(0.5),
  timeHorizon: z.string().default("90d"),
  resolutionSource: z.string().default("SEC filings"),
  reasoning: z.string().default(""),
  relatedEntities: z.array(z.string()).default([]),
  confidenceFromFiling: z.number().min(0).max(1).default(0.5),
});

export const filingIntelligenceSchema = z.object({
  filingId: z.string(),
  company: z.string(),
  formType: z.string(),
  filedDate: z.string(),

  entities: z.array(z.string()).default([]),
  sentiment: z.number().min(0).max(1).default(0.5),
  sentimentLabel: z
    .enum(["very_bearish", "bearish", "neutral", "bullish", "very_bullish"])
    .default("neutral"),
  riskScore: z.number().min(0).max(100).default(30),
  materialityScore: z.number().min(0).max(100).default(40),

  keyFindings: z.array(z.string()).default([]),
  financialSignals: z.array(z.string()).default([]),
  regulatorySignals: z.array(z.string()).default([]),
  marketMovingEvents: z.array(z.string()).default([]),

  generatedMarkets: z.array(generatedMarketSchema).default([]),
});

export type FilingIntelligence = z.infer<typeof filingIntelligenceSchema>;
export type GeneratedMarket = z.infer<typeof generatedMarketSchema>;

/**
 * Validates/repairs raw LLM output into a well-typed FilingIntelligence.
 * Throws if the output is fundamentally not an object; otherwise fills in
 * defaults for missing/invalid fields so downstream code never crashes.
 */
export function parseFilingIntelligence(raw: unknown): FilingIntelligence {
  if (typeof raw !== "object" || raw === null) {
    throw new Error("Filing intelligence output was not a JSON object");
  }
  return filingIntelligenceSchema.parse(raw);
}
