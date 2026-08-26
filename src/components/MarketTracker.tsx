"use client";

import { useEffect, useState, useCallback } from "react";
import { TrendingUp, TrendingDown, Activity, RefreshCw } from "lucide-react";

interface Market {
  id: string;
  question: string;
  yesPrice: number;
  noPrice: number;
  volume: number;
  liquidity: number;
  endDate: string;
  category: string;
  matchScore: number;
}

const CATEGORY_BADGE: Record<string, string> = {
  crypto: "bg-orange-500/20 text-orange-400",
  finance: "bg-blue-500/20 text-blue-400",
  regulation: "bg-purple-500/20 text-purple-400",
  geopolitics: "bg-red-500/20 text-red-400",
  other: "bg-zinc-500/20 text-zinc-400",
};

function formatVol(n: number): string {
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

export default function MarketTracker({ highlightIds }: { highlightIds?: string[] }) {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/market-pulse");
      const data = await res.json();
      setMarkets(data);
    } catch { /* */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const iv = setInterval(load, 60000);
    return () => clearInterval(iv);
  }, [load]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-orange-400" />
          <h2 className="text-sm font-semibold">Market Pulse</h2>
          <span className="text-[10px] text-zinc-500 font-mono">Polymarket</span>
        </div>
        <button onClick={load} className="p-1 hover:bg-zinc-800 rounded">
          <RefreshCw className={`w-3.5 h-3.5 text-zinc-400 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {markets.map((m) => {
          const isHighlighted = highlightIds?.includes(m.id);
          const yesPct = (m.yesPrice * 100).toFixed(1);
          const barWidth = m.yesPrice * 100;
          return (
            <div
              key={m.id}
              className={`px-4 py-3 border-b border-zinc-800/50 transition-colors ${
                isHighlighted ? "bg-orange-500/10 border-l-2 border-l-orange-500" : "hover:bg-zinc-800/30"
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <span className={`px-1.5 py-0.5 text-[9px] font-mono rounded ${CATEGORY_BADGE[m.category] || CATEGORY_BADGE.other}`}>
                  {m.category.toUpperCase()}
                </span>
                <span className="text-[10px] text-zinc-500 font-mono">{formatVol(m.volume)} vol</span>
              </div>
              <p className="text-xs text-zinc-200 leading-snug mb-2">{m.question}</p>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${barWidth}%`,
                      background: barWidth > 60 ? "#10b981" : barWidth > 40 ? "#f59e0b" : "#ef4444",
                    }}
                  />
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="flex items-center gap-0.5">
                    <TrendingUp className="w-2.5 h-2.5 text-emerald-400" />
                    <span className="text-[11px] font-mono font-bold text-emerald-400">{yesPct}%</span>
                  </div>
                  <div className="flex items-center gap-0.5">
                    <TrendingDown className="w-2.5 h-2.5 text-red-400" />
                    <span className="text-[11px] font-mono text-red-400">{(m.noPrice * 100).toFixed(1)}%</span>
                  </div>
                </div>
              </div>
              {m.matchScore > 0 && (
                <div className="mt-2 flex items-center gap-1">
                  <span className="px-1.5 py-0.5 text-[9px] font-mono bg-indigo-500/20 text-indigo-400 rounded">
                    MATCH {m.matchScore}
                  </span>
                </div>
              )}
            </div>
          );
        })}
        {markets.length === 0 && !loading && (
          <div className="p-8 text-center text-zinc-500 text-sm">No markets found</div>
        )}
      </div>
    </div>
  );
}
