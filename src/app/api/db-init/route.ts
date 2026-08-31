import { initSchema, isPersistent } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * One-time / repeatable schema setup. Safe to call repeatedly (CREATE TABLE
 * IF NOT EXISTS). Guarded so it cannot be triggered by anonymous traffic.
 */
export async function GET(request: Request) {
  if (!(await isPersistent())) {
    return Response.json(
      { ok: false, note: "POSTGRES_URL not configured; running in-memory", persistent: false },
      { status: 503 }
    );
  }

  const secret = process.env.ADMIN_SECRET || "";
  const auth = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  const queryKey = new URL(request.url).searchParams.get("key") || "";
  if (secret && auth !== secret && queryKey !== secret) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const done = await initSchema();
  return Response.json({ ok: done, persistent: true });
}
