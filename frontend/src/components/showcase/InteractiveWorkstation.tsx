'use client';

import React, { useState } from 'react';
import {
  Layers,
  MapPin,
  ShieldCheck,
  FileText,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export type WorkstationTab = 'opportunities' | 'leads' | 'approvals' | 'cv';

interface InteractiveWorkstationProps {
  activeTab?: WorkstationTab;
  onTabChange?: (tab: WorkstationTab) => void;
  onBookConsultation?: () => void;
}

const STATIONS: {
  id: WorkstationTab;
  step: string;
  title: string;
  shortTitle: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  badge: string;
  metric: string;
  metricLabel: string;
}[] = [
  {
    id: 'opportunities',
    step: '01',
    title: 'Autonomous Opportunity Pipeline',
    shortTitle: '1. Opportunity Pipeline',
    subtitle: 'Multi-factor ground-truth scoring matrix',
    icon: Layers,
    badge: 'Live Scoring',
    metric: '83.3%',
    metricLabel: 'Benchmark Accuracy',
  },
  {
    id: 'leads',
    step: '02',
    title: 'Places Discovery & Gap Audits',
    shortTitle: '2. Places Lead Discovery',
    subtitle: 'Need-signals & polite site gap audits',
    icon: MapPin,
    badge: 'Need-Signals',
    metric: '100%',
    metricLabel: 'Audit Compliance',
  },
  {
    id: 'approvals',
    step: '03',
    title: 'Human-in-the-Loop Gateway',
    shortTitle: '3. Human Approval Gateway',
    subtitle: 'Zero-hallucination sign-off & safety caps',
    icon: ShieldCheck,
    badge: 'Safety First',
    metric: '15/Day',
    metricLabel: 'Safety Send Cap',
  },
  {
    id: 'cv',
    step: '04',
    title: 'Tailored Dossier & Brief Compiler',
    shortTitle: '4. Tailored Dossier Engine',
    subtitle: 'Bespoke briefs mapped to exact company needs',
    icon: FileText,
    badge: 'Zero Hallucination',
    metric: '100%',
    metricLabel: 'Verified Truth',
  },
];

export const InteractiveWorkstation: React.FC<InteractiveWorkstationProps> = ({
  activeTab: controlledTab,
  onTabChange,
  onBookConsultation,
}) => {
  const [internalTab, setInternalTab] = useState<WorkstationTab>('opportunities');
  const currentTab = controlledTab || internalTab;

  const handleSelectTab = (tab: WorkstationTab) => {
    setInternalTab(tab);
    onTabChange?.(tab);
  };

  const currentIndex = STATIONS.findIndex((s) => s.id === currentTab);
  const handlePrev = () => {
    const nextIdx = (currentIndex - 1 + STATIONS.length) % STATIONS.length;
    handleSelectTab(STATIONS[nextIdx].id);
  };
  const handleNext = () => {
    const nextIdx = (currentIndex + 1) % STATIONS.length;
    handleSelectTab(STATIONS[nextIdx].id);
  };

  // State for interactive tab simulations
  const [selectedOpportunity, setSelectedOpportunity] = useState<number>(0);
  const [simulatedCity, setSimulatedCity] = useState<'Riyadh' | 'Dubai' | 'London'>('Riyadh');
  const [approvedItems, setApprovedItems] = useState<number[]>([]);
  const [tailoredRole, setTailoredRole] = useState<'PARTNER' | 'FDE' | 'ARCHITECT'>('PARTNER');

  return (
    <div className="w-full rounded-3xl bg-[#090c14]/90 border border-white/10 backdrop-blur-xl overflow-hidden shadow-2xl shadow-indigo-950/20">
      {/* 3D Horizontal Perspective Station Carousel */}
      <div className="border-b border-white/10 bg-black/40 p-4 sm:p-6 space-y-4">
        {/* Telemetry Header with Previous / Next Controls */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
            <span className="text-xs font-mono font-bold tracking-wider uppercase text-cyan-300">
              STATION {STATIONS[currentIndex]?.step} / 04 : {STATIONS[currentIndex]?.title}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 bg-black/60 border border-white/10 rounded-xl p-1 text-xs font-mono text-slate-400">
              <button
                onClick={handlePrev}
                aria-label="Previous station"
                className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-white/10 hover:text-white transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="px-2 text-[11px] text-slate-300">
                {currentIndex + 1} of {STATIONS.length}
              </span>
              <button
                onClick={handleNext}
                aria-label="Next station"
                className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-white/10 hover:text-white transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <div className="hidden sm:flex items-center gap-1.5 text-[11px] font-mono text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
              <span>LIVE TELEMETRY: ACTIVE</span>
            </div>
          </div>
        </div>

        {/* 3D Perspective Card Track */}
        <div
          className="relative overflow-x-auto pb-2 scrollbar-none"
          style={{ perspective: '1200px' }}
        >
          <div className="flex items-center gap-3.5 min-w-[780px] py-2 transition-transform duration-500 ease-out">
            {STATIONS.map((station, idx) => {
              const Icon = station.icon;
              const isActive = currentTab === station.id;
              const offset = idx - currentIndex;

              let transformStyle = '';
              if (isActive) {
                transformStyle = 'scale(1.02) translateZ(24px)';
              } else if (offset < 0) {
                transformStyle = 'rotateY(10deg) scale(0.96) translateZ(0px)';
              } else {
                transformStyle = 'rotateY(-10deg) scale(0.96) translateZ(0px)';
              }

              return (
                <div
                  key={station.id}
                  onClick={() => handleSelectTab(station.id)}
                  style={{
                    transform: transformStyle,
                    transformStyle: 'preserve-3d',
                  }}
                  className={`flex-1 min-w-[210px] p-4 rounded-2xl cursor-pointer transition-all duration-300 relative border ${
                    isActive
                      ? 'bg-gradient-to-br from-cyan-950/40 via-indigo-950/30 to-[#090d16] border-cyan-500/50 shadow-xl shadow-cyan-950/40 z-10'
                      : 'bg-card/20 border-white/5 hover:border-white/20 hover:bg-white/5 opacity-70 hover:opacity-100'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                        isActive
                          ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-bold'
                          : 'bg-white/5 text-slate-400'
                      }`}
                    >
                      {station.step} // {station.badge}
                    </span>
                    <span className="text-xs font-mono font-bold text-white">
                      {station.metric}
                    </span>
                  </div>

                  <div className="flex items-center gap-2.5 mt-3">
                    <div
                      className={`h-8 w-8 rounded-xl flex items-center justify-center shrink-0 ${
                        isActive
                          ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                          : 'bg-white/5 text-slate-400'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <h4
                        className={`text-xs font-bold truncate ${
                          isActive ? 'text-white' : 'text-slate-300'
                        }`}
                      >
                        {station.shortTitle}
                      </h4>
                      <p className="text-[10px] text-slate-400 truncate">
                        {station.metricLabel}
                      </p>
                    </div>
                  </div>

                  {isActive && (
                    <div className="absolute -bottom-px left-6 right-6 h-[2px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-sm shadow-cyan-400" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Tab Content Display */}
      <div className="p-6 sm:p-8 min-h-[460px]">
        {/* TAB 1: OPPORTUNITY PIPELINE */}
        {currentTab === 'opportunities' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <Badge className="bg-indigo-500/20 text-indigo-300 border-indigo-500/40 text-[10px]">
                    AUTONOMOUS SOURCING &amp; SCORING
                  </Badge>
                  <span className="text-xs text-slate-400 font-mono">
                    24/7 Intake · Two-Pass Zod Scoring · Zero Manual Filtering
                  </span>
                </div>
                <h3 className="text-lg font-bold text-white mt-1">
                  Multi-Factor Opportunity Scoring Matrix
                </h3>
              </div>
              <div className="text-right">
                <div className="text-xl font-bold font-mono text-cyan-400">83.3% Match</div>
                <div className="text-[10px] text-slate-500">Golden Set Benchmark Accuracy</div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {/* Opportunities List */}
              <div className="lg:col-span-1 space-y-3">
                {[
                  {
                    title: 'Enterprise AI Systems Partner (Autonomous Workflow)',
                    company: 'Apex Sovereign Systems',
                    score: 96,
                    type: 'Embedded FDE',
                    outcome: 'Automating 120 hrs/mo manual intake',
                    term: '3-Month Sprint',
                  },
                  {
                    title: 'Forward Deployed Systems Architect (Multi-Agent Engine)',
                    company: 'Scale Distributed Corp',
                    score: 91,
                    type: 'Solutions Architect',
                    outcome: 'Zero-hallucination verification pipeline',
                    term: 'Direct Contract',
                  },
                  {
                    title: 'Consultative Solutions Lead (Production AI Deployment)',
                    company: 'Global Cloud Systems',
                    score: 86,
                    type: 'Strategic Advisory',
                    outcome: 'Turnkey 2-4 week embedded rollout',
                    term: 'Sprint Engagement',
                  },
                ].map((opp, idx) => (
                  <div
                    key={idx}
                    onClick={() => setSelectedOpportunity(idx)}
                    className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                      selectedOpportunity === idx
                        ? 'bg-cyan-950/20 border-cyan-500/40 shadow-lg shadow-cyan-950/30'
                        : 'bg-card/20 border-white/5 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 text-slate-300">
                        {opp.type}
                      </span>
                      <span
                        className={`text-xs font-bold font-mono ${
                          opp.score >= 90 ? 'text-emerald-400' : 'text-cyan-400'
                        }`}
                      >
                        {opp.score}% FIT
                      </span>
                    </div>
                    <h4 className="font-semibold text-xs text-white mt-2 line-clamp-1">
                      {opp.title}
                    </h4>
                    <p className="text-[11px] text-slate-400">{opp.company}</p>
                    <div className="mt-2 pt-2 border-t border-white/5 flex items-center justify-between text-[10px] text-slate-500 font-mono">
                      <span className="text-emerald-400">{opp.outcome}</span>
                      <span className="text-slate-300">{opp.term}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Scoring Breakdown & Evidence */}
              <div className="lg:col-span-2 rounded-2xl bg-black/40 border border-white/10 p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div>
                    <h4 className="text-sm font-semibold text-white">
                      Four-Factor Verification Rubric
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      Evaluated against real client needs with zero invented facts.
                    </p>
                  </div>
                  <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-[10px]">
                    VERIFIED MATCH
                  </Badge>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: 'Problem Fit', val: '96%', desc: 'Exact workflow automation need' },
                    { label: 'Reliability Guarantee', val: '98%', desc: '100% ground-truth enforced' },
                    { label: 'Delivery Model', val: '94%', desc: 'Embedded 2-4 wk sprint ready' },
                    { label: 'Domain Safety', val: '99%', desc: 'Audit trails & human sign-off' },
                  ].map((metric, i) => (
                    <div key={i} className="p-3 rounded-xl bg-white/5 border border-white/5 space-y-1">
                      <div className="text-[10px] text-slate-400 font-mono">{metric.label}</div>
                      <div className="text-lg font-bold text-white font-mono">{metric.val}</div>
                      <div className="text-[9px] text-slate-500 leading-tight">{metric.desc}</div>
                    </div>
                  ))}
                </div>

                <div className="space-y-2 pt-2">
                  <div className="text-[11px] font-semibold text-cyan-300 font-mono flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>EXTRACTED EVIDENCE FROM GROUND-TRUTH DOSSIER:</span>
                  </div>
                  <div className="rounded-xl bg-card/20 border border-white/5 p-3 space-y-2 text-xs text-slate-300">
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
                      <span>
                        <strong>Verified Pipeline Architecture:</strong> Engineered autonomous systems handling high-concurrency intake with zero hallucinations and strict rate-limiting.
                      </span>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
                      <span>
                        <strong>Business Outcome Track Record:</strong> Eliminated 20+ hours/week of manual research and qualification for enterprise clients and recruiting teams.
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: PLACES LEAD DISCOVERY */}
        {currentTab === 'leads' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <Badge className="bg-cyan-500/20 text-cyan-300 border-cyan-500/40 text-[10px]">
                    CONSULTATIVE B2B GAP RADAR
                  </Badge>
                  <span className="text-xs text-slate-400 font-mono">
                    Google Places API (New) · Website Need-Signals · Robots.txt Etiquette
                  </span>
                </div>
                <h3 className="text-lg font-bold text-white mt-1">
                  Autonomous Lead Discovery &amp; Operational Gap Engine
                </h3>
              </div>
              <div className="flex items-center gap-2">
                {(['Riyadh', 'Dubai', 'London'] as const).map((city) => (
                  <Button
                    key={city}
                    size="sm"
                    variant={simulatedCity === city ? 'default' : 'outline'}
                    onClick={() => setSimulatedCity(city)}
                    className="h-7 text-xs rounded-lg"
                  >
                    {city}
                  </Button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {/* Live Discovered Leads */}
              <div className="lg:col-span-2 space-y-3">
                {[
                  {
                    name: 'Apex Logistics Enterprise',
                    address: `${simulatedCity} Commercial District`,
                    gap: 'Legacy manual booking forms causing 4hr response delays',
                    solution: 'Autonomous dispatch intake API & real-time tracking agent',
                    rating: '4.8 ★ (120 Reviews)',
                  },
                  {
                    name: 'Sovereign Health Network',
                    address: `${simulatedCity} Healthcare City`,
                    gap: 'Zero automated triage; 30+ min reception intake latency',
                    solution: 'HIPAA-compliant verified patient intake & routing pipeline',
                    rating: '4.9 ★ (340 Reviews)',
                  },
                  {
                    name: 'Gulf FinTech Clearinghouse',
                    address: `${simulatedCity} Financial Center`,
                    gap: 'Manual document verification & compliance backlog',
                    solution: 'Two-pass Zod verification & automated compliance audit trails',
                    rating: '4.7 ★ (85 Reviews)',
                  },
                ].map((lead, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-2xl bg-card/20 border border-white/5 space-y-2 hover:border-cyan-500/30 transition-all"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-semibold text-xs text-white">{lead.name}</h4>
                        <p className="text-[10px] text-slate-400">{lead.address}</p>
                      </div>
                      <span className="text-[10px] font-mono text-cyan-400">{lead.rating}</span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-black/40 border border-white/5 space-y-1">
                      <div className="text-[10px] text-rose-300 font-mono flex items-center gap-1.5">
                        <AlertTriangle className="h-3 w-3 text-rose-400" />
                        <span>Identified Operational Bottleneck: {lead.gap}</span>
                      </div>
                      <div className="text-[10px] text-cyan-300 font-mono flex items-center gap-1.5">
                        <CheckCircle2 className="h-3 w-3 text-cyan-400" />
                        <span>Engineered Solution: {lead.solution}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1">
                      <span className="text-emerald-400 text-[11px] font-mono">Verified Consultative Gap</span>
                      <Button
                        size="sm"
                        onClick={onBookConsultation}
                        className="h-7 text-[11px] gap-1 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg shadow-sm shadow-cyan-500/20"
                      >
                        <span>Draft Consultative Brief</span>
                        <ArrowRight className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Discovery Stats Panel */}
              <div className="rounded-2xl bg-black/40 border border-white/10 p-5 space-y-4">
                <h4 className="text-sm font-semibold text-white">Discovery Protocol Guardrails</h4>
                <div className="space-y-3 text-xs">
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-white/5">
                    <span className="text-slate-400">Monthly Quota Guard</span>
                    <span className="text-cyan-400 font-mono">124 / 500 Used</span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-white/5">
                    <span className="text-slate-400">Robots.txt Etiquette</span>
                    <span className="text-emerald-400 font-mono">Strict Politeness</span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-white/5">
                    <span className="text-slate-400">Domain Suppression</span>
                    <span className="text-purple-400 font-mono">Global Exclusions</span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-white/5">
                    <span className="text-slate-400">Safety Cap Defense</span>
                    <span className="text-emerald-400 font-mono">15 / Day Limit</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-white/10">
                  <div className="text-[10px] text-slate-500 font-mono leading-relaxed">
                    Zero spam scraping. Every business is politely audited for verified technical gaps so outreach delivers real consulting value.
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: HUMAN APPROVAL GATEWAY */}
        {currentTab === 'approvals' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-[10px]">
                    SAFETY &amp; GOVERNANCE GATEWAY
                  </Badge>
                  <span className="text-xs text-slate-400 font-mono">
                    ApprovalRecord · 15/Day Cap · Telegram/Web Confirmation
                  </span>
                </div>
                <h3 className="text-lg font-bold text-white mt-1">
                  Human-in-the-Loop Governance Console
                </h3>
              </div>
              <div className="text-right">
                <div className="text-xs font-mono text-emerald-400 flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4" />
                  <span>100% AUDIT TRAIL</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Pending Action Card */}
              <div className="p-6 rounded-2xl bg-card/20 border border-white/10 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-amber-400 flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    <span>AWAITING HUMAN APPROVAL</span>
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">ID: APR-88219</span>
                </div>

                <div className="space-y-2">
                  <h4 className="font-semibold text-sm text-white">
                    Consultative Brief: Sarah Jenkins (VP Operations, Apex Logistics)
                  </h4>
                  <div className="rounded-xl bg-black/60 border border-white/5 p-3 text-xs text-slate-300 font-mono leading-relaxed">
                    &quot;Hi Sarah, our automated audit identified that your manual dispatch booking forms currently create a 4-hour intake bottleneck. We recently engineered an autonomous pipeline that eliminated 20+ hours/week of manual intake with 100% ground-truth verification...&quot;
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between gap-3">
                  <div className="text-[10px] text-slate-400 font-mono">
                    Daily Send Cap: <span className="text-white">4 / 15 Dispatched</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs border-white/10 hover:bg-red-500/10 hover:text-red-300"
                    >
                      Reject
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => setApprovedItems([0])}
                      className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl gap-1.5"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>{approvedItems.includes(0) ? 'Approved ✓' : 'Approve & Send'}</span>
                    </Button>
                  </div>
                </div>
              </div>

              {/* FDE Safety Guarantees */}
              <div className="rounded-2xl bg-black/40 border border-white/10 p-6 space-y-4">
                <h4 className="text-sm font-semibold text-white">Enterprise Safety &amp; Governance Rules</h4>
                <div className="space-y-3">
                  {[
                    {
                      rule: 'Never Invent Facts',
                      desc: 'Every claim in an outreach pack strictly maps back to verified profile records with zero hallucinations.',
                    },
                    {
                      rule: 'Domain Reputation Defense',
                      desc: '15/day safety caps prevent spam triggers, protect domain deliverability, and maintain sender credibility.',
                    },
                    {
                      rule: 'Zero Unauthorized Sends',
                      desc: 'No email or message is dispatched without an explicit, cryptographically traceable ApprovalRecord.',
                    },
                    {
                      rule: 'Zero Platform Passwords Stored',
                      desc: 'All credentials and API keys are stored in encrypted vaults with zero plain-text persistence.',
                    },
                  ].map((item, idx) => (
                    <div key={idx} className="flex items-start gap-3 text-xs">
                      <div className="h-5 w-5 rounded-md bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5">
                        <CheckCircle2 className="h-3 w-3" />
                      </div>
                      <div>
                        <div className="font-semibold text-white">{item.rule}</div>
                        <div className="text-slate-400 text-[11px] mt-0.5 leading-relaxed">{item.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: TAILORED CV & DOSSIER */}
        {currentTab === 'cv' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/40 text-[10px]">
                    DYNAMIC DOSSIER COMPILER
                  </Badge>
                  <span className="text-xs text-slate-400 font-mono">
                    LaTeX Engine · PDF Generator · High-Conversion Enterprise Positioning
                  </span>
                </div>
                <h3 className="text-lg font-bold text-white mt-1">
                  Tailored Technical Dossier &amp; Brief Compiler
                </h3>
              </div>
              <div className="flex items-center gap-2">
                {[
                  { id: 'PARTNER', label: 'Enterprise AI Partner' },
                  { id: 'FDE', label: 'Forward Deployed Architect' },
                  { id: 'ARCHITECT', label: 'Autonomous Workflow Lead' },
                ].map((role) => (
                  <Button
                    key={role.id}
                    size="sm"
                    variant={tailoredRole === role.id ? 'default' : 'outline'}
                    onClick={() => setTailoredRole(role.id as typeof tailoredRole)}
                    className="h-7 text-xs rounded-lg"
                  >
                    {role.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Dossier Preview Sheet */}
              <div className="lg:col-span-2 rounded-2xl bg-white p-6 text-slate-900 shadow-xl space-y-4">
                <div className="border-b border-slate-200 pb-3 flex items-start justify-between">
                  <div>
                    <h2 className="text-xl font-bold tracking-tight text-slate-950">
                      GHULAM GHAUS
                    </h2>
                    <p className="text-xs font-semibold text-indigo-700">
                      {tailoredRole === 'PARTNER'
                        ? 'Enterprise AI Partner & Solutions Architect'
                        : tailoredRole === 'FDE'
                          ? 'Forward Deployed AI Systems Architect'
                          : 'Autonomous Workflow & Verification Engineer'}
                    </p>
                    <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                      Available for Client Sprints &amp; Embedded Engagements · ghulamghaus266@gmail.com · github.com/Ghulam-Ghaus
                    </p>
                  </div>
                  <Badge className="bg-slate-100 text-slate-700 border-slate-300 text-[10px]">
                    PDF COMPILER READY
                  </Badge>
                </div>

                <div className="space-y-3 text-xs leading-relaxed">
                  <div>
                    <h5 className="font-bold text-[11px] uppercase tracking-wider text-slate-900 border-b border-slate-100 pb-0.5">
                      Executive Profile
                    </h5>
                    <p className="text-slate-700 mt-1">
                      Senior systems architect specializing in eliminating manual operational friction through autonomous discovery pipelines, zero-hallucination verification engines, and production-grade software. Trusted partner for founders and enterprise leaders seeking rapid, verifiable results.
                    </p>
                  </div>

                  <div>
                    <h5 className="font-bold text-[11px] uppercase tracking-wider text-slate-900 border-b border-slate-100 pb-0.5">
                      Core Business Outcomes Delivered
                    </h5>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-1 text-[11px] text-slate-800">
                      <div className="p-2 rounded bg-slate-50 border border-slate-200">
                        <strong>Autonomous Systems:</strong> Replaced 20+ hrs/wk of manual lead research with 24/7 continuous intake pipelines.
                      </div>
                      <div className="p-2 rounded bg-slate-50 border border-slate-200">
                        <strong>Zero-Hallucination Delivery:</strong> Built audit-proof verification engines ensuring 100% factual accuracy in enterprise AI outputs.
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Dossier Actions & Styles */}
              <div className="rounded-2xl bg-black/40 border border-white/10 p-5 space-y-4">
                <h4 className="text-sm font-semibold text-white">Dossier Export Formats</h4>
                <div className="space-y-2.5">
                  <Button
                    size="sm"
                    className="w-full text-xs h-9 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl gap-2 shadow-md shadow-indigo-500/20"
                    onClick={() => window.open('https://gghaus-portfolio.web.app/', '_blank')}
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    <span>Download Gulf Style PDF</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full text-xs h-9 border-white/10 text-slate-300 hover:text-white rounded-xl gap-2"
                    onClick={() => window.open('https://gghaus-portfolio.web.app/', '_blank')}
                  >
                    <FileText className="h-3.5 w-3.5" />
                    <span>Download Silicon Valley PDF</span>
                  </Button>
                </div>

                <div className="pt-3 border-t border-white/10 space-y-2 text-xs text-slate-400">
                  <div className="flex items-center gap-1.5 text-emerald-400 font-mono text-[11px]">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>Zero Unverified Inventions</span>
                  </div>
                  <p className="text-[11px] leading-relaxed">
                    Every bullet point compiles code-first from database records verified by the user.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
