import type { Filing } from "./edgar";
import type { Market } from "./markets";
import { matchFilingToMarkets } from "./markets";

export interface Alert {
  id: string;
  type: "filing_spike" | "high_impact" | "market_match" | "crypto_filing" | "sec_action";
  severity: "critical" | "high" | "medium" | "low";
  title: string;
  body: string;
  filing?: Filing;
  matchedMarket?: Market;
  matchScore?: number;
  direction?: "bullish" | "bearish" | "neutral";
  timestamp: number;
  read: boolean;
}

const ALERT_THRESHOLDS = {
  HIGH_IMPACT_SCORE: 70,
  MEDIUM_IMPACT_SCORE: 40,
  MARKET_MATCH_SCORE: 20,
  CRYPTO_KEYWORDS: ["crypto", "bitcoin", "ethereum", "solana", "blockchain", "token", "digital asset", "coinbase"],
  SEC_ACTION_KEYWORDS: ["sec investigation", "enforcement", "subpoena", "wells notice", "fraud"],
};

let alertHistory: Alert[] = [];
let lastFilingIds = new Set<string>();

export function processFilingAlerts(
  filings: Filing[],
  markets: Market[]
): Alert[] {
  const newAlerts: Alert[] = [];
  const newIds = new Set(filings.map((f) => f.id));

  for (const filing of filings) {
    if (lastFilingIds.has(filing.id)) continue;

    if (filing.impactScore >= ALERT_THRESHOLDS.HIGH_IMPACT_SCORE) {
      newAlerts.push(createAlert("high_impact", "critical", filing, undefined, undefined));
    }

    const cryptoMatch = filing.keywords.some((k) =>
      ALERT_THRESHOLDS.CRYPTO_KEYWORDS.includes(k.toLowerCase())
    );
    if (cryptoMatch) {
      newAlerts.push(createAlert("crypto_filing", "high", filing, undefined, undefined));
    }

    const secAction = filing.keywords.some((k) =>
      ALERT_THRESHOLDS.SEC_ACTION_KEYWORDS.includes(k.toLowerCase())
    );
    if (secAction) {
      newAlerts.push(createAlert("sec_action", "critical", filing, undefined, undefined));
    }

    const marketMatches = matchFilingToMarkets(filing.keywords, markets);
    for (const match of marketMatches.slice(0, 3)) {
      if (match.score >= ALERT_THRESHOLDS.MARKET_MATCH_SCORE) {
        const direction = inferQuickDirection(filing, match.market);
        newAlerts.push(createAlert("market_match", "high", filing, match.market, match.score, direction));
      }
    }
  }

  lastFilingIds = newIds;
  alertHistory = [...newAlerts, ...alertHistory].slice(0, 100);
  return newAlerts;
}

function createAlert(
  type: Alert["type"],
  severity: Alert["severity"],
  filing: Filing,
  market?: Market,
  matchScore?: number,
  direction?: "bullish" | "bearish" | "neutral"
): Alert {
  const company = filing.company.split("(")[0].trim();

  const titles: Record<string, string> = {
    high_impact: `HIGH IMPACT: ${filing.type} from ${company}`,
    crypto_filing: `CRYPTO: ${filing.type} — ${filing.keywords.filter((k) => ALERT_THRESHOLDS.CRYPTO_KEYWORDS.includes(k.toLowerCase())).join(", ")}`,
    sec_action: `SEC ACTION: ${filing.type} from ${company}`,
    market_match: `MARKET LINK: ${filing.type} → ${market?.question || "unknown market"}`,
    filing_spike: `SPIKE: Unusual filing activity detected`,
  };

  const bodies: Record<string, string> = {
    high_impact: `Impact score ${filing.impactScore}/100. Keywords: ${filing.keywords.join(", ")}. Check prediction markets for price movement.`,
    crypto_filing: `Crypto-related filing from ${company}. This may move crypto prediction contracts. Impact: ${filing.impactScore}/100.`,
    sec_action: `Regulatory action detected. Keywords: ${filing.keywords.join(", ")}. Expect market volatility. Impact: ${filing.impactScore}/100.`,
    market_match: `Correlated with "${market?.question}" — ${direction?.toUpperCase()} signal. Match score: ${matchScore}.`,
    filing_spike: `Multiple filings detected in short window. Monitor for coordinated events.`,
  };

  return {
    id: `alert-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type,
    severity,
    title: titles[type] || "Alert",
    body: bodies[type] || "",
    filing,
    matchedMarket: market,
    matchScore,
    direction,
    timestamp: Date.now(),
    read: false,
  };
}

function inferQuickDirection(filing: Filing, market: Market): "bullish" | "bearish" | "neutral" {
  const kw = filing.keywords.map((k) => k.toLowerCase());
  if (kw.includes("bankruptcy") || kw.includes("fraud") || kw.includes("sec investigation")) return "bearish";
  if (kw.includes("crypto") || kw.includes("bitcoin") || kw.includes("ethereum") || kw.includes("solana")) return "bullish";
  if (kw.includes("tariff") || kw.includes("regulation")) return "bearish";
  if (kw.includes("acquisition") || kw.includes("merger")) return "bullish";
  return "neutral";
}

export function getAlertHistory(): Alert[] {
  return alertHistory;
}

export function markAlertRead(id: string): void {
  const alert = alertHistory.find((a) => a.id === id);
  if (alert) alert.read = true;
}

export function getUnreadCount(): number {
  return alertHistory.filter((a) => !a.read).length;
}
