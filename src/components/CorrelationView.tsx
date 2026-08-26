"use client";

import { useEffect, useState, useCallback } from "react";
import { GitBranch, Zap, ArrowRight, TrendingUp, TrendingDown, Minus, RefreshCw } from "lucide-react";

interface Correlation {
  filing: {
    id: string;
    type: string;
    company: string;
    date: string;
    impactScore: number;
    keywords: string[];
  };
  matchedMarkets: Array<{
    market: {
      id: string;
      question: string;
      yesPrice: number;
      volume: number;
      category: string;
    };
    score: number;
    direction: "bullish" | "bearish" | "neutral";
    reasoning: string;
  }>;
  overallImpact: "high" | "medium" | "low";
  timestamp: number;
}

const IMPACT_BORDER = {
  high: "border-l-red-500",
  medium: "border-l-amber-500",
  low: "border-l-zinc-600",
};

const DIRECTION_ICON = {
  bullish: TrendingUp,
  bearish: TrendingDown,
  neutral: Minus,
};
const DIRECTION_COLOR = {
  bullish: "text-emerald-400",
  bearish: "text-red-400",
  neutral: "text-zinc-400",
};

export default function CorrelationView() {
  const [correlations, setCorrelations] = useState<Correlation[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/correlation");
      const data = await res.json();
      setCorrelations(data);
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
          <GitBranch className="w-4 h-4 text-cyan-400" />
          <h2 className="text-sm font-semibold">Filing → Market Pipeline</h2>
          <span className="text-[10px] text-zinc-500 font-mono">{correlations.length} links</span>
        </div>
        <button onClick={load} className="p-1 hover:bg-zinc-800 rounded">
          <RefreshCw className={`w-3.5 h-3.5 text-zinc-400 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {correlations.map((c) => (
          <div key={c.filing.id} className={`px-4 py-3 border-b border-zinc-800/50 border-l-2 ${IMPACT_BORDER[c.overallImpact]}`}>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-indigo-500/20 text-indigo-400 rounded">
                {c.filing.type}
              </span>
              <span className={`px-1.5 py-0.5 text-[10px] font-mono font-bold rounded ${
                c.overallImpact === "high" ? "bg-red-500/20 text-red-400" :
                c.overallImpact === "medium" ? "bg-amber-500/20 text-amber-400" :
                "bg-zinc-500/20 text-zinc-400"
              }`}>
                <Zap className="w-2.5 h-2.5 inline mr-0.5" />
                {c.filing.impactScore}
              </span>
              <span className="text-[10px] text-zinc-500 font-mono">{c.filing.date}</span>
            </div>
            <p className="text-xs font-medium text-zinc-200 mb-1">{c.filing.company}</p>
            <div className="flex flex-wrap gap-1 mb-2">
              {c.filing.keywords.slice(0, 3).map((kw) => (
                <span key={kw} className="px-1 py-0.5 text-[8px] font-mono bg-zinc-800 text-zinc-500 rounded">{kw}</span>
              ))}
            </div>

            {c.matchedMarkets.length > 0 && (
              <div className="space-y-1.5">
                {c.matchedMarkets.slice(0, 3).map((m) => {
                  const DirIcon = DIRECTION_ICON[m.direction];
                  return (
                    <div key={m.market.id} className="flex items-start gap-2 pl-3 border-l border-zinc-800">
                      <ArrowRight className="w-3 h-3 text-zinc-600 mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <DirIcon className={`w-3 h-3 ${DIRECTION_COLOR[m.direction]}`} />
                          <span className="text-[10px] text-zinc-300 truncate">{m.market.question}</span>
                          <span className="text-[9px] font-mono text-zinc-500 shrink-0">
                            {(m.market.yesPrice * 100).toFixed(0)}%
                          </span>
                        </div>
                        <p className="text-[9px] text-zinc-500 mt-0.5 leading-relaxed">{m.reasoning}</p>
                      </div>
                      <span className="px-1 py-0.5 text-[8px] font-mono bg-cyan-500/10 text-cyan-400 rounded shrink-0">
                        {m.score}pts
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
        {correlations.length === 0 && !loading && (
          <div className="p-8 text-center text-zinc-500 text-sm">No correlations found yet</div>
        )}
      </div>
    </div>
  );
}
