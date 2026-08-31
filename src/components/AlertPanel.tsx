"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  Bell, BellRing, AlertTriangle, TrendingUp, TrendingDown,
  FileText, Shield, Zap, Check, X, Volume2,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Alert {
  id: string;
  type: "filing_spike" | "high_impact" | "market_match" | "crypto_filing" | "sec_action";
  severity: "critical" | "high" | "medium" | "low";
  title: string;
  body: string;
  filing?: { type: string; company: string; impactScore: number; keywords: string[] };
  matchedMarket?: { question: string; yesPrice: number; category: string };
  matchScore?: number;
  direction?: "bullish" | "bearish" | "neutral";
  timestamp: number;
  read: boolean;
}

const SEVERITY_CONFIG = {
  critical: { icon: AlertTriangle, color: "text-red-400 bg-red-500/15 border-red-500/30", pulse: true },
  high: { icon: Zap, color: "text-amber-400 bg-amber-500/15 border-amber-500/30", pulse: false },
  medium: { icon: Bell, color: "text-blue-400 bg-blue-500/15 border-blue-500/30", pulse: false },
  low: { icon: Bell, color: "text-zinc-400 bg-zinc-500/15 border-zinc-500/30", pulse: false },
};

const TYPE_ICON = {
  high_impact: Zap,
  crypto_filing: TrendingUp,
  sec_action: Shield,
  market_match: TrendingUp,
  filing_spike: FileText,
};

const DIRECTION_CONFIG = {
  bullish: { icon: TrendingUp, color: "text-emerald-400", label: "BULL" },
  bearish: { icon: TrendingDown, color: "text-red-400", label: "BEAR" },
  neutral: { icon: Bell, color: "text-zinc-400", label: "FLAT" },
};

export default function AlertPanel() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const prevCountRef = useRef(0);
  const requestSeqRef = useRef(0);

  function playAlertSound() {
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.3);
    } catch { /* */ }
  }

  const loadAlerts = useCallback(async () => {
    const requestSeq = ++requestSeqRef.current;
    try {
      const res = await fetch("/api/alerts");
      const data = await res.json();
      if (requestSeq !== requestSeqRef.current) return;
      const history: Alert[] = data.history || [];
      setAlerts(history);
      const unread = history.filter((a: Alert) => !a.read).length;
      setUnreadCount(unread);

      if (unread > prevCountRef.current && soundEnabled) {
        playAlertSound();
      }
      if (unread > prevCountRef.current && "Notification" in window && Notification.permission === "granted") {
        const latest = history.find((a: Alert) => !a.read);
        if (latest) {
          new Notification("Metap Watch Alert", {
            body: latest.title,
            icon: "/favicon.ico",
          });
        }
      }
      prevCountRef.current = unread;
    } catch {
      if (requestSeq !== requestSeqRef.current) return;
    }
  }, [soundEnabled]);

  useEffect(() => {
    const t = setTimeout(() => { loadAlerts(); }, 0);
    const iv = setInterval(loadAlerts, 30000);
    return () => { clearTimeout(t); clearInterval(iv); };
  }, [loadAlerts]);

  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  async function markRead(id: string) {
    setAlerts((prev) => prev.map((a) => a.id === id ? { ...a, read: true } : a));
    setUnreadCount((prev) => Math.max(0, prev - 1));
    fetch("/api/alerts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "markRead", id }),
    });
  }

  return (
    <div className={`fixed right-0 top-0 h-full z-50 transition-all duration-300 ${expanded ? "w-96" : "w-12"}`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="absolute right-0 top-14 z-50 p-2 bg-zinc-900 border border-zinc-700 rounded-l-lg hover:bg-zinc-800 transition-colors"
      >
        {expanded ? (
          <X className="w-4 h-4 text-zinc-400" />
        ) : (
          <div className="relative">
            {unreadCount > 0 ? (
              <BellRing className="w-4 h-4 text-amber-400 animate-pulse" />
            ) : (
              <Bell className="w-4 h-4 text-zinc-400" />
            )}
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </div>
        )}
      </button>

      {expanded && (
        <div className="h-full bg-zinc-900 border-l border-zinc-800 flex flex-col pt-14">
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-amber-400" />
              <span className="text-sm font-semibold">Alerts</span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 text-[10px] font-mono bg-red-500/20 text-red-400 rounded">
                  {unreadCount} new
                </span>
              )}
            </div>
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`p-1 rounded transition-colors ${soundEnabled ? "bg-amber-500/20 text-amber-400" : "text-zinc-500 hover:bg-zinc-800"}`}
            >
              <Volume2 className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {alerts.length === 0 ? (
              <div className="p-8 text-center text-zinc-500 text-sm">
                <Bell className="w-6 h-6 mx-auto mb-2 text-zinc-600" />
                No alerts yet. Monitoring filings...
              </div>
            ) : (
              alerts.map((alert) => {
                const sev = SEVERITY_CONFIG[alert.severity];
                const SevIcon = sev.icon;
                const TypeIcon = TYPE_ICON[alert.type];
                const dir = alert.direction ? DIRECTION_CONFIG[alert.direction] : null;
                const DirIcon = dir?.icon;

                return (
                  <div
                    key={alert.id}
                    className={`px-4 py-3 border-b border-zinc-800/50 transition-colors ${
                      alert.read ? "opacity-60" : "bg-zinc-800/20"
                    } ${sev.pulse ? "border-l-2 border-l-red-500" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="flex items-center gap-1.5">
                        <span className={`p-1 rounded ${sev.color}`}>
                          <SevIcon className="w-3 h-3" />
                        </span>
                        <TypeIcon className="w-3 h-3 text-zinc-500" />
                        {dir && DirIcon && (
                          <span className={`flex items-center gap-0.5 text-[9px] font-mono ${dir.color}`}>
                            <DirIcon className="w-2.5 h-2.5" />
                            {dir.label}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[9px] text-zinc-500 font-mono">
                          {formatDistanceToNow(alert.timestamp, { addSuffix: true })}
                        </span>
                        {!alert.read && (
                          <button onClick={() => markRead(alert.id)} className="p-0.5 hover:bg-zinc-700 rounded">
                            <Check className="w-3 h-3 text-zinc-500" />
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="text-[11px] font-medium text-zinc-200 mb-0.5">{alert.title}</p>
                    <p className="text-[10px] text-zinc-500 leading-relaxed">{alert.body}</p>
                    {alert.filing && (
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="px-1 py-0.5 text-[8px] font-mono bg-zinc-800 text-zinc-400 rounded">
                          {alert.filing.type}
                        </span>
                        <span className="text-[9px] text-zinc-500 font-mono">
                          impact {alert.filing.impactScore}/100
                        </span>
                      </div>
                    )}
                    {alert.matchedMarket && (
                      <div className="mt-1.5 pl-2 border-l border-zinc-800">
                        <p className="text-[10px] text-zinc-400">
                          → {alert.matchedMarket.question}
                        </p>
                        <span className="text-[9px] font-mono text-zinc-500">
                          yes {(alert.matchedMarket.yesPrice * 100).toFixed(1)}%
                          {alert.matchScore !== undefined && ` | match ${alert.matchScore}`}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
