"use client";

import { useState } from "react";
import {
  FileText, Activity, Brain, GitBranch, Zap,
  ChevronLeft, ChevronRight,
} from "lucide-react";
import FilingIngest from "@/components/FilingIngest";
import MagmaAnalysis from "@/components/MagmaAnalysis";
import MarketPerformance from "@/components/MarketPerformance";
import AlertPanel from "@/components/AlertPanel";
import PaperMintCard from "@/components/PaperMintCard";

type Tab = "pipeline" | "filings" | "markets" | "ai";

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "pipeline", label: "Pipeline", icon: GitBranch },
  { id: "filings", label: "Filings", icon: FileText },
  { id: "markets", label: "Markets", icon: Activity },
  { id: "ai", label: "AI Scan", icon: Brain },
];

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>("pipeline");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="flex flex-col h-screen bg-zinc-950 text-zinc-100">
      <header className="flex items-center justify-between px-4 py-2 border-b border-zinc-800 bg-zinc-900/80">
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-indigo-400" />
          <span className="text-sm font-bold tracking-tight">metap</span>
          <span className="text-xs text-zinc-500">watch</span>
        </div>
        <div className="flex items-center gap-4 text-[10px] font-mono text-zinc-500">
          <span>SEC EDGAR → Magma → Prediction Markets</span>
          <span className="px-1.5 py-0.5 bg-indigo-500/20 text-indigo-400 rounded">VERCEL</span>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className={`flex flex-col border-r border-zinc-800 bg-zinc-900/50 transition-all duration-200 ${sidebarCollapsed ? "w-12" : "w-36"}`}>
          <div className="flex items-center justify-end px-2 py-3">
            <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)} className="p-1 hover:bg-zinc-800 rounded">
              {sidebarCollapsed ? <ChevronRight className="w-3.5 h-3.5 text-zinc-400" /> : <ChevronLeft className="w-3.5 h-3.5 text-zinc-400" />}
            </button>
          </div>
          <nav className="flex-1 py-1">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 text-xs transition-colors ${
                    active ? "bg-zinc-800 text-zinc-100" : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50"
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {!sidebarCollapsed && <span>{tab.label}</span>}
                </button>
              );
            })}
          </nav>
        </aside>

        <main className="flex-1 overflow-hidden">
          <PaperMintCard />
          {activeTab === "pipeline" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 h-[calc(100%-72px)] divide-y lg:divide-y-0 lg:divide-x divide-zinc-800">
              <div className="overflow-hidden flex flex-col min-h-0">
                <FilingIngest />
              </div>
              <div className="overflow-hidden flex flex-col min-h-0">
                <MagmaAnalysis />
              </div>
              <div className="overflow-hidden flex flex-col min-h-0">
                <MarketPerformance />
              </div>
            </div>
          )}

          {activeTab === "filings" && (
            <div className="h-[calc(100%-72px)] overflow-hidden"><FilingIngest /></div>
          )}

          {activeTab === "markets" && (
            <div className="h-[calc(100%-72px)] overflow-hidden"><MarketPerformance /></div>
          )}

          {activeTab === "ai" && (
            <div className="h-[calc(100%-72px)] overflow-hidden"><MagmaAnalysis /></div>
          )}
        </main>
      </div>

      <AlertPanel />
    </div>
  );
}
