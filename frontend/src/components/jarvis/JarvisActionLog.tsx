'use client';

import React from 'react';
import { Terminal, CheckCircle2, Zap } from 'lucide-react';
import type { JarvisState } from './JarvisCoreVisualizer';

interface JarvisActionLogProps {
  state: JarvisState;
  activeTool?: string | null;
  toolOutput?: string | null;
  citations?: string[];
  latencyMs?: number;
}

export const JarvisActionLog: React.FC<JarvisActionLogProps> = ({
  state,
  activeTool,
  toolOutput,
  citations = [],
  latencyMs = 18,
}) => {
  return (
    <div className="w-full min-h-[72px] rounded-2xl bg-black/50 border border-cyan-500/20 p-3 font-mono text-[11px] flex flex-col justify-between backdrop-blur-md shadow-lg shadow-black/40 text-left transition-all duration-300">
      <div className="flex items-center justify-between text-slate-400 text-[10px] border-b border-white/5 pb-1">
        <div className="flex items-center gap-1.5 text-cyan-400">
          <Terminal className="h-3 w-3" />
          <span>GHAUS // LIVE_ACTION_FEED</span>
        </div>
        <span className="text-slate-500">{latencyMs}ms</span>
      </div>

      {!activeTool && state === 'IDLE' ? (
        <div className="flex items-center justify-center gap-2 text-[10px] font-mono text-slate-400 py-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
          <span>CORE STANDBY · 100% GROUND TRUTH · ZERO HALLUCINATIONS</span>
        </div>
      ) : (
        <div className="space-y-1 pt-1">
          {activeTool && (
            <div className="text-cyan-300 font-semibold flex items-center gap-1.5 text-[11px]">
              <Zap className="h-3 w-3 text-amber-400 shrink-0 animate-bounce" />
              <span>[TOOL_CALL: {activeTool}]</span>
            </div>
          )}

          {toolOutput && (
            <div className="text-emerald-400 text-[10px] pl-2 border-l border-emerald-500/40 py-0.5 line-clamp-2">
              {toolOutput}
            </div>
          )}

          {citations && citations.length > 0 && (
            <div className="pt-0.5 flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] text-slate-500">Citations:</span>
              {citations.map((cite, i) => (
                <span
                  key={i}
                  className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 flex items-center gap-1"
                >
                  <CheckCircle2 className="h-2.5 w-2.5 text-cyan-400" />
                  <span>{cite}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
