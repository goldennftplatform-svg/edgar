import { fetchMarketPulse } from "@/lib/markets";

export const dynamic = "force-dynamic";

export async function GET() {
  const markets = await fetchMarketPulse(20);
  return Response.json(markets);
}
