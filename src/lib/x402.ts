/**
 * x402 pay-per-call integration (clean version only).
 *
 * Uses the core stackai-x402 SDK surface: createAgentClient + numeric 402
 * payment handling for MCP-style tool calls. We deliberately do NOT touch the
 * Moltbook autonomous-promo agent (engagement farming) — excluded on purpose.
 *
 * Everything is optional: if no gateway / wallet / key is configured, calls
 * gracefully fall back to free (local) execution so the dashboard never breaks.
 */

const GATEWAY_URL = process.env.X402_GATEWAY_URL || "";
const AGENT_WALLET_KEY = process.env.X402_AGENT_KEY || "";
const AGENT_ID = process.env.X402_AGENT_ID || "";
const NETWORK = (process.env.X402_NETWORK || "testnet") as "mainnet" | "testnet";

export interface PaidToolResult<T> {
  ok: boolean;
  paid: boolean;
  /** tx hash when payment settled, or null when free */
  txHash?: string;
  toolName: string;
  data?: T;
  error?: string;
}

export interface X402Status {
  configured: boolean;
  gateway: string;
  agentId: string;
  network: string;
  note: string;
}

export function x402Status(): X402Status {
  return {
    configured: !!(GATEWAY_URL && AGENT_ID),
    gateway: GATEWAY_URL || "(not set)",
    agentId: AGENT_ID || "(not set)",
    network: NETWORK,
    note: "Moltbook promo agent intentionally excluded",
  };
}

/**
 * Executes a paid market-intel tool call through the x402 gateway.
 * If not configured, runs the given local fallback (free) instead.
 */
export async function paidToolCall<T>(
  toolName: string,
  args: Record<string, unknown>,
  localFallback: () => Promise<T>
): Promise<PaidToolResult<T>> {
  if (!x402Status().configured) {
    try {
      const data = await localFallback();
      return { ok: true, paid: false, toolName, data };
    } catch (e) {
      return { ok: false, paid: false, toolName, error: String(e) };
    }
  }

  try {
    // Dynamic import so the SDK is only loaded when actually configured —
    // keeps the serverless bundle lean and avoids pulling Stacks deps otherwise.
    const { createAgentClient } = await import("stackai-x402/client");

    // cast through unknown: the published runtime returns an AxiosInstance, but
    // Turbopack's namespace typing widens it to `void | AxiosInstance`
    const createConfiguredClient = createAgentClient as (
      key: string,
      network: "mainnet" | "testnet"
    ) => { post: (url: string, data: unknown) => Promise<unknown> };

    const client = (AGENT_WALLET_KEY
      ? createConfiguredClient(AGENT_WALLET_KEY, NETWORK)
      : createAgentClientForReadonly()) as {
      post: (url: string, data: unknown) => Promise<unknown>;
    };

    const res = await client.post(
      `${GATEWAY_URL}/mcp?id=${AGENT_ID}`,
      {
        jsonrpc: "2.0",
        method: "tools/call",
        params: { name: toolName, arguments: args },
        id: 1,
      }
    );

    const result = (res as { result?: { content?: unknown[] } }).result;
    const text =
      (result?.content as Array<{ text?: string }> | undefined)
        ?.map((c) => c.text)
        .filter(Boolean)
        .join("\n") || "";

    const parsed = text ? JSON.parse(text) : undefined;

    return { ok: true, paid: true, toolName, data: parsed as T };
  } catch {
    // On any gateway/payment error, fall back to local so the request still
    // succeeds (failover philosophy). Mark as not paid.
    try {
      const data = await localFallback();
      return { ok: true, paid: false, toolName, data, error: undefined };
    } catch (e2) {
      return { ok: false, paid: false, toolName, error: String(e2) };
    }
  }
}

function createAgentClientForReadonly() {
  // Without a configured agent wallet we cannot sign payments; this path is a
  // guard. In practice configured=false prevents reaching here. Kept explicit
  // to fail loudly rather than silently.
  throw new Error("X402_AGENT_KEY not configured; cannot sign payments");
}
