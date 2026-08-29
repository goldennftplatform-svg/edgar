import { getMarketIntelPaid } from "@/lib/marketIntel";
import { x402Status } from "@/lib/x402";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const args = {
    company: searchParams.get("company") || undefined,
    limit: searchParams.get("limit") ? Number(searchParams.get("limit")) : undefined,
    minImpact: searchParams.get("minImpact") ? Number(searchParams.get("minImpact")) : undefined,
  };

  const intel = await getMarketIntelPaid(args);
  return Response.json({ intel, x402: x402Status() });
}
