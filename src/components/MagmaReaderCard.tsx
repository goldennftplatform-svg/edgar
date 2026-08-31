"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Brain, RefreshCw, Wifi, WifiOff } from "lucide-react";

type MagmaSummary = {
  analyzed: number;
  markets: number;
  averageSentiment: number;
  source: "edgar" | "mock" | null;
  error: string | null;
};

export default function MagmaReaderCard() {
  const [summary, setSummary] = useState<MagmaSummary>({
    analyzed: 0,
    markets: 0,
    averageSentiment: 0,
    source: null,
    error: null,
  });
  const [loading, setLoading] = useState(true);
  const [lastScan, setLastScan] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadSummary = useCallback(async () => {
    try {
      const res = await fetch("/api/ai-scan");
      const data = await res.json();
      const analyses = (data.analyses || []) as Array<{ sentiment?: number; generatedMarkets?: unknown[] }>;
      const analyzed = analyses.length;
      const markets = analyses.reduce((sum, a) => sum + (a.generatedMarkets?.length || 0), 0);
      const averageSentiment = analyzed
        ? analyses.reduce((sum, a) => sum + (a.sentiment ?? 0.5), 0) / analyzed
        : 0;

      setSummary({
        analyzed,
        markets,
        averageSentiment,
        source: data.source ?? null,
        error: data.error || null,
      });
      setLastScan(new Date().toLocaleTimeString());
    } catch (error) {
      setSummary((prev) => ({ ...prev, source: null, error: String(error) }));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      void loadSummary();
    }, 0);
    intervalRef.current = setInterval(() => {
      void loadSummary();
    }, 60000);

    return () => {
      clearTimeout(t);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [loadSummary]);

  const status = summary.source === "edgar" ? "LIVE" : summary.source === "mock" ? "FALLBACK" : "SYNCING";

  return (
    <div className="h-full rounded-xl border border-violet-500/20 bg-violet-500/5 px-4 py-3 shadow-sm shadow-violet-950/20">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Brain className="w-4 h-4 text-violet-400 shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-violet-100">Magma Reader</p>
            <p className="text-[10px] font-mono text-violet-300/70 truncate">
              filing analysis + market generation summary
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-right">
          <div className="flex items-center gap-1.5">
            {summary.source === "edgar" ? (
              <Wifi className="w-3 h-3 text-emerald-400" />
            ) : (
              <WifiOff className="w-3 h-3 text-amber-400" />
            )}
            <span className={`text-[9px] font-mono ${summary.source === "edgar" ? "text-emerald-400" : "text-amber-400"}`}>
              {status}
            </span>
          </div>
          <button
            onClick={() => void loadSummary()}
            disabled={loading}
            className="flex items-center gap-1.5 rounded border border-violet-500/20 bg-violet-500/10 px-2 py-1 text-[10px] font-mono text-violet-200 hover:bg-violet-500/20 disabled:opacity-40"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
            refresh
          </button>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <div className="rounded-lg border border-violet-500/15 bg-zinc-950/50 px-3 py-2">
          <p className="text-[9px] font-mono text-violet-300/60 uppercase">analyzed</p>
          <p className="text-lg font-mono font-semibold text-violet-100">{summary.analyzed}</p>
        </div>
        <div className="rounded-lg border border-violet-500/15 bg-zinc-950/50 px-3 py-2">
          <p className="text-[9px] font-mono text-violet-300/60 uppercase">markets</p>
          <p className="text-lg font-mono font-semibold text-violet-100">{summary.markets}</p>
        </div>
        <div className="rounded-lg border border-violet-500/15 bg-zinc-950/50 px-3 py-2">
          <p className="text-[9px] font-mono text-violet-300/60 uppercase">sentiment</p>
          <p className="text-lg font-mono font-semibold text-violet-100">
            {Math.round(summary.averageSentiment * 100)}%
          </p>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between text-[10px] font-mono text-violet-300/70">
        <span>
          {summary.error ? summary.error : summary.source === "mock" ? "fallback source active" : "reading filings cleanly"}
        </span>
        <span>{lastScan ? `seen ${lastScan}` : "waiting..."}</span>
      </div>
    </div>
  );
}
