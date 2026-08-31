"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  FileText, Clock, AlertCircle, ChevronDown, ChevronRight,
  RefreshCw, Wifi, WifiOff,
} from "lucide-react";
import type { FilingIntelligence } from "@/lib/magma";

export default function MagmaAnalysis() {
  const [filings, setFilings] = useState<FilingIntelligence[]>([]);
  const [source, setSource] = useState<"edgar" | "mock" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scanRunning, setScanRunning] = useState(false);
  const [lastScan, setLastScan] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const requestSeqRef = useRef(0);

  const runScan = useCallback(async () => {
    if (scanRunning) return;
    setScanRunning(true);
    const requestSeq = ++requestSeqRef.current;
    try {
      const aRes = await fetch("/api/ai-scan");
      const analysisData = await aRes.json();
      if (requestSeq !== requestSeqRef.current) return;
      setSource(analysisData.source);
      setError(analysisData.error || null);
      setFilings((analysisData.analyses || []).map((a: Record<string, unknown>) => ({
          filingId: a.filingId,
          company: a.company,
          formType: a.formType,
          filedDate: a.filedDate,
          sentiment: a.sentiment,
          sentimentLabel: a.sentimentLabel,
          riskScore: a.riskScore,
          materialityScore: a.materialityScore,
          keyFindings: a.keyFindings,
          financialSignals: a.financialSignals,
          regulatorySignals: a.regulatorySignals,
          marketMovingEvents: a.marketMovingEvents,
          entities: a.entities || [],
          generatedMarkets: a.generatedMarkets || [],
        } as FilingIntelligence)));
      setLastScan(new Date().toLocaleTimeString());
    } catch (e) {
      if (requestSeq !== requestSeqRef.current) return;
      setSource(null);
      setError(String(e));
    } finally {
      if (requestSeq === requestSeqRef.current) setScanRunning(false);
    }
  }, [scanRunning]);

  useEffect(() => {
    const t = setTimeout(() => { runScan(); }, 0);
    intervalRef.current = setInterval(runScan, 60000);
    return () => { clearTimeout(t); if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [runScan]);

  function toggleExpand(id: string) {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function sentimentColor(sentiment: number): string {
    if (sentiment >= 0.7) return "text-emerald-400";
    if (sentiment >= 0.55) return "text-lime-400";
    if (sentiment >= 0.45) return "text-zinc-400";
    if (sentiment >= 0.3) return "text-amber-400";
    return "text-red-400";
  }

  function sentimentBg(sentiment: number): string {
    if (sentiment >= 0.7) return "bg-emerald-500/20 border-emerald-500/30";
    if (sentiment >= 0.55) return "bg-lime-500/15 border-lime-500/25";
    if (sentiment >= 0.45) return "bg-zinc-500/15 border-zinc-500/25";
    if (sentiment >= 0.3) return "bg-amber-500/15 border-amber-500/25";
    return "bg-red-500/15 border-red-500/25";
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${source === "edgar" ? "bg-emerald-400 animate-pulse" : source === "mock" ? "bg-amber-400" : "bg-zinc-600"}`} />
          <span className="text-sm font-semibold">Magma Analysis</span>
          <span className="text-[10px] font-mono text-zinc-500">{filings.length} analyzed</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            {source === "edgar" ? (
              <Wifi className="w-3 h-3 text-emerald-400" />
            ) : (
              <WifiOff className="w-3 h-3 text-amber-400" />
            )}
            <span className={`text-[9px] font-mono ${source === "edgar" ? "text-emerald-400" : "text-amber-400"}`}>
              {source === "edgar" ? "LIVE" : "FALLBACK"}
            </span>
          </div>
          {lastScan && <span className="text-[9px] font-mono text-zinc-600">scanned {lastScan}</span>}
          <button
            onClick={runScan}
            disabled={scanRunning}
            className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-mono bg-violet-500/15 text-violet-300 rounded border border-violet-500/20 hover:bg-violet-500/25 disabled:opacity-40 transition-colors"
          >
            {scanRunning ? <Clock className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
            {scanRunning ? "analyzing..." : "rescan"}
          </button>
        </div>
      </div>

      {error && (
        <div className="px-4 py-2 bg-amber-500/10 border-b border-amber-500/20">
          <p className="text-[10px] font-mono text-amber-400">⚠ {error}</p>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {filings.length === 0 && !scanRunning && (
          <div className="p-8 text-center text-zinc-500 text-sm">
            <FileText className="w-8 h-8 mx-auto mb-3 text-zinc-600" />
            <p className="font-medium mb-1">Analyzing filings...</p>
          </div>
        )}

        {filings.map((fi) => {
          const isExpanded = expanded[fi.filingId] ?? false;
          return (
            <div key={fi.filingId} className="border-b border-zinc-800/60">
              <button
                onClick={() => toggleExpand(fi.filingId)}
                className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-zinc-800/30 transition-colors"
              >
                <div className={`mt-0.5 p-1.5 rounded border ${sentimentBg(fi.sentiment)}`}>
                  {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="px-1.5 py-0.5 text-[9px] font-mono bg-zinc-800 text-zinc-400 rounded">{fi.formType}</span>
                    <span className={`text-[10px] font-mono ${sentimentColor(fi.sentiment)}`}>
                      {fi.sentimentLabel?.replace("_", " ")}
                    </span>
                    {fi.generatedMarkets.length > 0 && (
                      <span className="px-1.5 py-0.5 text-[9px] font-mono bg-indigo-500/20 text-indigo-300 rounded">
                        {fi.generatedMarkets.length} market{fi.generatedMarkets.length !== 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-medium text-zinc-200 truncate">{fi.company.split("(")[0].trim()}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[9px] font-mono text-zinc-600">sentiment {(fi.sentiment * 100).toFixed(0)}%</span>
                    <span className="text-zinc-700">·</span>
                    <span className="text-[9px] font-mono text-zinc-600">risk {fi.riskScore}</span>
                    <span className="text-zinc-700">·</span>
                    <span className="text-[9px] font-mono text-zinc-600">materiality {fi.materialityScore}</span>
                  </div>
                </div>
              </button>

              {isExpanded && (
                <div className="px-4 pb-3 ml-6">
                  <div className="mb-3">
                    <p className="text-[10px] font-mono text-zinc-500 mb-1 uppercase tracking-wider">Key Findings</p>
                    <ul className="space-y-0.5">
                      {fi.keyFindings.map((f, i) => (
                        <li key={i} className="text-[11px] text-zinc-400 flex items-start gap-1.5">
                          <span className="text-zinc-600 mt-0.5">→</span>{f}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {fi.marketMovingEvents.length > 0 && (
                    <div className="mb-3">
                      <p className="text-[10px] font-mono text-zinc-500 mb-1 uppercase tracking-wider">Market Moving</p>
                      <ul className="space-y-0.5">
                        {fi.marketMovingEvents.map((e, i) => (
                          <li key={i} className="text-[11px] text-amber-400/80 flex items-start gap-1.5">
                            <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
                            {e}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {fi.generatedMarkets.length > 0 && (
                    <div>
                      <p className="text-[10px] font-mono text-zinc-500 mb-1.5 uppercase tracking-wider">Generated Markets</p>
                      <div className="space-y-2">
                        {fi.generatedMarkets.map((market) => (
                          <div key={market.id} className="p-2.5 bg-zinc-900 border border-zinc-800 rounded-lg">
                            <p className="text-[11px] font-medium text-zinc-200 leading-snug mb-2">{market.question}</p>
                            <div className="flex items-center gap-3 mb-2">
                              <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                                <div className="h-full bg-emerald-500/70 rounded-full" style={{ width: `${Math.round(market.yesInitial * 100)}%` }} />
                              </div>
                              <div className="flex items-center gap-2 text-[9px] font-mono">
                                <span className="text-emerald-400">YES {Math.round(market.yesInitial * 100)}%</span>
                                <span className="text-zinc-600">|</span>
                                <span className="text-red-400">NO {Math.round(market.noInitial * 100)}%</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 text-[9px] font-mono text-zinc-500">
                              <span className="px-1.5 py-0.5 bg-zinc-800 rounded">{market.category}</span>
                              <span>{market.timeHorizon} horizon</span>
                              <span>confidence {Math.round(market.confidenceFromFiling * 100)}%</span>
                            </div>
                            <p className="text-[10px] text-zinc-500 mt-1.5 leading-relaxed">{market.reasoning}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
