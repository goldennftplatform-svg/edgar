import { fetchFilingPulse } from "@/lib/edgar";

export const dynamic = "force-dynamic";

export async function GET() {
  const filings = await fetchFilingPulse(30);
  return Response.json(filings);
}
