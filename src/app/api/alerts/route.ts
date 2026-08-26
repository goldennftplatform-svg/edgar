import { fetchFilingPulse } from "@/lib/edgar";
import { fetchMarketPulse } from "@/lib/markets";
import { processFilingAlerts, getAlertHistory, markAlertRead } from "@/lib/alerts";

export const dynamic = "force-dynamic";

export async function GET() {
  const [filings, markets] = await Promise.all([
    fetchFilingPulse(30),
    fetchMarketPulse(20),
  ]);

  const newAlerts = processFilingAlerts(filings, markets);
  const history = getAlertHistory();

  return Response.json({ newAlerts, history });
}

export async function POST(request: Request) {
  const body = await request.json();
  if (body.action === "markRead" && body.id) {
    markAlertRead(body.id);
    return Response.json({ ok: true });
  }
  return Response.json({ error: "unknown action" }, { status: 400 });
}
