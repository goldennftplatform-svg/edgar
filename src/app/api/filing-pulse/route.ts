import { fetchFilingPulse } from "@/lib/edgar";

export const dynamic = "force-dynamic";

export async function GET() {
  const result = await fetchFilingPulse(20);
  return Response.json(result);
}
