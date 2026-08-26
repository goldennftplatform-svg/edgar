import { fetchFilingPulse } from "@/lib/edgar";
import { fetchMarketPulse } from "@/lib/markets";
import { buildCorrelations } from "@/lib/correlation";

export const dynamic = "force-dynamic";

export async function GET() {
  const [filings, markets] = await Promise.all([
    fetchFilingPulse(20),
    fetchMarketPulse(15),
  ]);

  const correlations = buildCorrelations(filings, markets);
  return Response.json(correlations);
}
