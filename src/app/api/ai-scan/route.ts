import { fetchFilingPulse } from "@/lib/edgar";
import { analyzeFiling } from "@/lib/ai";

export const dynamic = "force-dynamic";

export async function GET() {
  const filings = await fetchFilingPulse(10);
  const analyses = await Promise.all(filings.map((f) => analyzeFiling(f)));
  return Response.json(analyses);
}
