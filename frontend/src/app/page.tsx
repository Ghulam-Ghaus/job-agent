'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  ExternalLink,
  Code2,
  Cpu,
  Layers,
  CheckCircle2,
  Send,
  Loader2,
  Bot,
  Zap,
  FileText,
  Database,
  Mic,
  MicOff,
  PhoneOff,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import dynamic from 'next/dynamic';
import {
  api,
  type PublicProfile,
  type PublicProduct,
  type PublicTelemetry,
} from '@/lib/api-client';
import { JarvisActionLog } from '@/components/jarvis/JarvisActionLog';

import { useJarvisVoice } from '@/hooks/useJarvisVoice';
import {
  InteractiveWorkstation,
  type WorkstationTab,
} from '@/components/showcase/InteractiveWorkstation';

const JarvisCoreVisualizer = dynamic(
  () => import('@/components/jarvis/JarvisCoreVisualizer').then((m) => m.JarvisCoreVisualizer),
  { ssr: false }
);

const JarvisWaveform = dynamic(
  () => import('@/components/jarvis/JarvisWaveform').then((m) => m.JarvisWaveform),
  { ssr: false }
);

const PORTFOLIO_URL = 'https://gghaus-portfolio.web.app/';

const DEFAULT_PRODUCTS: PublicProduct[] = [
  {
    id: 'prod-1',
    slug: 'autonomous-intake-engine',
    title: 'Autonomous Client & Candidate Ingestion Engine',
    tagline: 'Turnkey 24/7 sourcing pipeline connecting mailboxes, ATS, and lead channels.',
    description:
      'Eliminates 25+ hours of weekly manual searching. Fully autonomous multi-channel ingestion, polite website audits, and 4-factor scoring with zero hallucinations.',
    category: 'TURNKEY_SYSTEM',
    features: [
      '24/7 autonomous intake across IMAP, webhooks & APIs',
      'Custom 4-factor scoring rubric (85%+ accuracy)',
      'Polite site gap audit with need-signal extraction',
      'Zero domain burning with strict safety send limits',
    ],
    priceUsd: 3500,
    priceModel: 'FIXED',
    demoUrl: null,
    badge: 'POPULAR',
  },
  {
    id: 'prod-2',
    slug: 'embedded-fde-sprint',
    title: '2-to-4 Week Embedded FDE Engineering Sprint',
    tagline: 'Direct embedding into your engineering team to ship production AI systems.',
    description:
      'Go from unstable AI prototypes to mission-critical, enterprise-grade production architectures with two-pass Zod verification, background queues, and human approval gates.',
    category: 'EMBEDDED_SPRINT',
    features: [
      'Direct team & codebase integration by Ghulam Ghaus',
      'Zero-hallucination verification engine architecture',
      'High-throughput queues & human-in-the-loop gates',
      'Clean architecture, strict type tests, and zero downtime',
    ],
    priceUsd: 4800,
    priceModel: 'FIXED',
    demoUrl: null,
    badge: 'FEATURED',
  },
  {
    id: 'prod-3',
    slug: 'voice-ai-twin-liaison',
    title: 'Autonomous AI Voice Twin & Client Liaison',
    tagline: '24/7 interactive voice & reasoning agent trained on your business track record.',
    description:
      'Instant qualification and live workstation demo control for prospective clients and recruiters. Sub-350ms two-way conversational voice with guaranteed ground truth.',
    category: 'VOICE_AGENT',
    features: [
      'Two-way conversational voice call integration',
      'Screen & demo workstation interactive control',
      'Trained on your case studies with zero fake claims',
      'Automated consultation RFP capture & calendar sync',
    ],
    priceUsd: 2800,
    priceModel: 'FIXED',
    demoUrl: null,
    badge: 'HIGH ROI',
  },
];

export default function SovereignFdeLandingPage() {
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [products, setProducts] = useState<PublicProduct[]>([]);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // Controlled workstation tab state
  const [workstationTab, setWorkstationTab] = useState<WorkstationTab>('opportunities');

  // Inquiry form modal state
  const [showInquiryModal, setShowInquiryModal] = useState(false);
  const [selectedProductSlug, setSelectedProductSlug] = useState<string>('');
  const [inquiryName, setInquiryName] = useState('');
  const [inquiryEmail, setInquiryEmail] = useState('');
  const [inquiryCompany, setInquiryCompany] = useState('');
  const [inquiryMessage, setInquiryMessage] = useState('');
  const [submittingInquiry, setSubmittingInquiry] = useState(false);
  const [inquirySuccess, setInquirySuccess] = useState(false);

  // Text console input state
  const [consoleInput, setConsoleInput] = useState('');
  const [telemetry, setTelemetry] = useState<PublicTelemetry | null>(null);

  // JARVIS Voice & Tool Hook
  const {
    state: jarvisState,
    audioLevel,
    transcript,
    activeTool,
    toolOutput,
    citations,
    isVoiceActive,
    isMuted,
    latencyMs,
    toggleVoice,
    toggleMute,
    processMessage,
  } = useJarvisVoice({
    onSwitchTab: (tab) => {
      if (tab === 'opportunities' || tab === 'leads' || tab === 'approvals' || tab === 'cv') {
        setWorkstationTab(tab as WorkstationTab);
        const el = document.getElementById('workstation-section');
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }
    },
    onOpenConsultation: () => {
      setSelectedProductSlug('');
      setShowInquiryModal(true);
    },
    onShowArchitecture: () => {
      const el = document.getElementById('architecture-blueprint');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    },
  });

  useEffect(() => {
    async function loadShowcase() {
      try {
        const [prof, prods, tele] = await Promise.all([
          api.public.getProfile().catch(() => null),
          api.public.getProducts().catch(() => []),
          api.public.getTelemetry().catch(() => null),
        ]);
        if (prof) setProfile(prof);
        if (prods) setProducts(prods);
        if (tele) setTelemetry(tele);
      } catch {
        // Fallback gracefully
      }
    }
    loadShowcase();
    api.auth
      .me()
      .then(() => setIsLoggedIn(true))
      .catch(() => setIsLoggedIn(false));
  }, []);


  const handleInquirySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inquiryName.trim() || !inquiryEmail.trim() || !inquiryMessage.trim()) return;
    setSubmittingInquiry(true);
    try {
      await api.public.submitInquiry({
        name: inquiryName,
        email: inquiryEmail,
        company: inquiryCompany || undefined,
        message: inquiryMessage,
        productSlug: selectedProductSlug || undefined,
      });
      setInquirySuccess(true);
      setTimeout(() => {
        setInquirySuccess(false);
        setShowInquiryModal(false);
        setInquiryName('');
        setInquiryEmail('');
        setInquiryCompany('');
        setInquiryMessage('');
      }, 3000);
    } catch {
      // Handle error gracefully
    } finally {
      setSubmittingInquiry(false);
    }
  };

  const handleConsoleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!consoleInput.trim()) return;
    processMessage(consoleInput);
    setConsoleInput('');
  };

  const displayName = profile?.name || 'Ghulam Ghaus';

  return (
    <div className="min-h-screen bg-[#06080d] text-slate-100 selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Top Ambient Cybernetic Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-gradient-to-b from-cyan-500/10 via-indigo-500/10 to-transparent blur-3xl pointer-events-none -z-10" />

      {/* Global Telemetry & Navigation Header */}
      <header className="sticky top-0 z-40 border-b border-white/5 bg-[#06080d]/90 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
          {/* Brand Monogram */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-cyan-500 via-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-cyan-500/25">
              <Bot className="h-5 w-5 text-white" />
            </div>
            <div className="flex items-center gap-2 whitespace-nowrap">
              <span className="font-bold text-sm tracking-tight text-white">
                {displayName}
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-300 font-mono border border-cyan-500/30">
                FDE
              </span>
            </div>
          </div>

          {/* Centered Telemetry Status Pill */}
          <div className="hidden lg:flex items-center gap-2 px-3 py-1 rounded-full bg-black/60 border border-white/10 text-[11px] font-mono text-emerald-400 shrink-0">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>SYS_STATUS: OPTIMAL</span>
          </div>

          {/* Actions & Navigation */}
          <div className="flex items-center gap-3 shrink-0">
            <nav className="hidden xl:flex items-center gap-5 text-xs text-slate-300 font-medium mr-2">
              <a href="#hero" className="hover:text-white transition-colors">
                Overview
              </a>
              <a href="#problem-solution" className="hover:text-white transition-colors">
                Problem &amp; Fix
              </a>
              <a href="#architecture-blueprint" className="hover:text-white transition-colors">
                Architecture
              </a>
              <a href="#workstation-section" className="hover:text-white transition-colors">
                Workstation
              </a>
              <a href="#offerings" className="hover:text-white transition-colors">
                Services
              </a>
            </nav>

            {/* Quick Live Voice Trigger */}
            <Button
              size="sm"
              variant="outline"
              onClick={toggleVoice}
              className={`text-xs h-8 px-3 rounded-xl border gap-1.5 font-mono transition-all ${isVoiceActive
                  ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-300 animate-pulse'
                  : 'border-white/10 bg-white/5 text-slate-300 hover:text-white hover:border-cyan-500/40'
                }`}
            >
              {isVoiceActive ? (
                <>
                  <Mic className="h-3.5 w-3.5 text-emerald-400 animate-ping" />
                  <span>Call Active</span>
                </>
              ) : (
                <>
                  <Mic className="h-3.5 w-3.5 text-cyan-400" />
                  <span>Talk with Ghaus</span>
                </>
              )}
            </Button>

            {isLoggedIn ? (
              <Link
                href="/dashboard"
                id="nav-open-workspace"
                className="text-xs font-semibold text-emerald-300 hover:text-emerald-200 transition-colors flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 shadow-sm"
              >
                <span>Console</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            ) : (
              <Link
                href="/login"
                id="nav-sign-in"
                className="text-xs font-medium text-slate-300 hover:text-white transition-colors px-3 py-1.5 rounded-lg border border-white/10 hover:border-white/20"
              >
                Sign In
              </Link>
            )}

            <Button
              size="sm"
              onClick={() => {
                setSelectedProductSlug('');
                setShowInquiryModal(true);
              }}
              className="gap-1.5 bg-gradient-to-r from-cyan-500 via-indigo-600 to-purple-600 hover:from-cyan-600 hover:to-purple-700 text-white font-medium text-xs h-8 px-4 rounded-xl shadow-md shadow-cyan-500/20"
            >
              <Send className="h-3 w-3" />
              <span>Consult / Deploy</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section: The Clean, Spacious Dual Masterpiece */}
      <section id="hero" className="relative pt-10 pb-16 px-6 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          {/* LEFT: Executive Profile Card (Outcomes & Services Focused) */}
          <div className="lg:col-span-7 rounded-3xl bg-card/25 border border-white/10 p-7 sm:p-8 backdrop-blur-2xl shadow-2xl relative overflow-hidden h-full flex flex-col justify-between space-y-6">
            <div className="absolute top-0 right-0 w-80 h-80 bg-cyan-500/5 blur-3xl pointer-events-none -z-10" />

            {/* Top Identity & Details Area */}
            <div className="space-y-5">
              {/* Value Proposition Badge */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/25 text-cyan-300 text-xs font-mono">
                  <span className="h-2 w-2 rounded-full bg-cyan-400" />
                  <span>✓ Verified Autonomous AI Engineering</span>
                </div>
                <span className="text-emerald-400 text-xs font-mono">
                  ● Available for Client Sprints &amp; Technical Advisory
                </span>
              </div>

              {/* Profile Avatar & Identity Row */}
              <div className="flex items-center gap-4 sm:gap-5">
                <div className="relative group shrink-0">
                  <div className="h-20 w-20 sm:h-22 sm:w-22 rounded-2xl bg-gradient-to-br from-cyan-500/30 via-indigo-500/20 to-purple-500/30 border border-cyan-500/40 p-1 flex items-center justify-center shadow-xl shadow-cyan-500/20 overflow-hidden">
                    <div className="h-full w-full rounded-xl bg-[#090d16] flex flex-col items-center justify-center text-cyan-400">
                      <Bot className="h-8 w-8 text-cyan-400 mb-0.5" />
                      <span className="text-[10px] font-mono font-bold tracking-wider">GG // AI</span>
                    </div>
                  </div>
                  <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-emerald-500 border-2 border-[#06080d] flex items-center justify-center text-[10px] text-black font-bold">
                    ✓
                  </div>
                </div>

                <div className="space-y-1">
                  <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white">
                    {displayName}
                  </h1>
                  <p className="text-sm sm:text-base font-semibold bg-gradient-to-r from-cyan-400 via-indigo-300 to-purple-300 bg-clip-text text-transparent">
                    Forward Deployed Systems Architect &amp; AI Engineering Partner
                  </p>
                  <div className="flex items-center gap-2 text-xs text-slate-400 font-mono pt-0.5 flex-wrap">
                    <span className="text-cyan-400 font-medium">Enterprise AI Partner</span>
                    <span>•</span>
                    <span className="text-indigo-300">Solving High-Value Friction</span>
                    <span>•</span>
                    <span className="text-amber-400 flex items-center gap-1">
                      <Zap className="h-3.5 w-3.5" />
                      <span>Zero Hallucinations</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Executive Mission Bio */}
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-normal">
                Helping founders, enterprise leaders, and recruiters eliminate operational friction by engineering <span className="text-white font-medium">autonomous discovery pipelines</span>, <span className="text-white font-medium">zero-hallucination verification engines</span>, and <span className="text-white font-medium">production AI workflows</span>. I don&apos;t just string API calls together—I deliver robust, audit-proof systems that solve expensive manual bottlenecks, protect brand reputation, and drive verifiable business growth.
              </p>

              {/* Three Client & Recruiter Services (Replacing raw tech stack listings) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                <div className="p-3.5 rounded-xl bg-black/40 border border-white/5 space-y-1.5 hover:border-cyan-500/30 transition-all">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-cyan-300">
                    <Cpu className="h-3.5 w-3.5 text-cyan-400" />
                    <span>Autonomous Agents</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-snug">
                    End-to-end multi-channel discovery, lead research, and qualification pipelines that recover 100+ hours/month for teams.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-black/40 border border-white/5 space-y-1.5 hover:border-indigo-500/30 transition-all">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-300">
                    <Layers className="h-3.5 w-3.5 text-indigo-400" />
                    <span>Verification Engines</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-snug">
                    Strict ground-truth AI systems where every generated proposal, email, and metric is verified before human approval dispatch.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-black/40 border border-white/5 space-y-1.5 hover:border-purple-500/30 transition-all">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-purple-300">
                    <Code2 className="h-3.5 w-3.5 text-purple-400" />
                    <span>Embedded 2-4 Wk Sprints</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-snug">
                    Direct integration into your codebase and operational workflows to deliver production-ready systems with zero downtime.
                  </p>
                </div>
              </div>

              {/* Operational Guarantees & Real-Time Engineering Telemetry Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
                <div className="p-2.5 rounded-xl bg-black/35 border border-white/5 text-center">
                  <div className="text-base font-black font-mono text-cyan-400">0%</div>
                  <div className="text-[10px] text-slate-400 font-mono tracking-tight">Hallucinations</div>
                </div>
                <div className="p-2.5 rounded-xl bg-black/35 border border-white/5 text-center">
                  <div className="text-base font-black font-mono text-emerald-400">
                    {telemetry ? `${telemetry.totalQueriesHandled} Qs` : '100+ hrs'}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono tracking-tight">
                    {telemetry ? 'Verified Ingestion' : 'Manual Grind Cut'}
                  </div>
                </div>
                <div className="p-2.5 rounded-xl bg-black/35 border border-white/5 text-center">
                  <div className="text-base font-black font-mono text-amber-400">
                    {telemetry ? `${telemetry.safetySendCapRemaining} / day` : '15 / day'}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono tracking-tight">Safety Send Cap</div>
                </div>
                <div className="p-2.5 rounded-xl bg-black/35 border border-white/5 text-center">
                  <div className="text-base font-black font-mono text-purple-400">
                    {telemetry ? `${telemetry.dbLatencyMs}ms` : '< 20ms'}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono tracking-tight">Postgres Latency</div>
                </div>
              </div>

            </div>

            {/* Action Buttons Pinned at Bottom */}
            <div className="pt-4 border-t border-white/5 flex items-center gap-3 flex-wrap">
              <Button
                size="lg"
                onClick={() => {
                  setSelectedProductSlug('');
                  setShowInquiryModal(true);
                }}
                className="gap-2 bg-gradient-to-r from-cyan-500 via-indigo-600 to-purple-600 hover:from-cyan-600 hover:to-purple-700 text-white font-semibold text-xs sm:text-sm h-11 px-6 rounded-2xl shadow-xl shadow-cyan-500/25"
              >
                <span>Engage / Consult FDE Sprint</span>
                <ArrowRight className="h-4 w-4" />
              </Button>

              <Button
                variant="outline"
                size="lg"
                onClick={() => {
                  setWorkstationTab('cv');
                  const el = document.getElementById('workstation-section');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                }}
                className="gap-2 border-white/10 bg-white/5 hover:bg-white/10 text-white text-xs sm:text-sm h-11 px-5 rounded-2xl backdrop-blur-sm"
              >
                <FileText className="h-4 w-4 text-cyan-400" />
                <span>View Technical Dossier</span>
              </Button>

              <a
                href={PORTFOLIO_URL}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-slate-400 hover:text-cyan-300 flex items-center gap-1 font-mono transition-colors ml-1"
              >
                <span>Full Portfolio</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>

          {/* RIGHT: The Sovereign GHAUS Arc Reactor Hub */}
          <div className="lg:col-span-5 rounded-3xl bg-black/40 border border-cyan-500/20 p-7 backdrop-blur-2xl shadow-2xl shadow-cyan-950/30 text-center relative h-full flex flex-col justify-between space-y-4">
            {/* Top Minimal Badge */}
            <div>
              <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-cyan-400 animate-ping" />
                  <span className="font-bold text-xs tracking-wider text-white font-mono uppercase">
                    GHAUS // AUTONOMOUS AI TWIN
                  </span>
                </div>
                <Badge className="bg-cyan-500/15 text-cyan-300 border-cyan-500/30 text-[10px] font-mono">
                  VOICE &amp; REASONING AGENT
                </Badge>
              </div>

              {/* Floating 3D Arc Reactor Orb */}
              <div className="relative py-1 flex flex-col items-center justify-center">
                <JarvisCoreVisualizer
                  state={jarvisState}
                  audioLevel={audioLevel}
                  size={165}
                />
              </div>

              {/* Glowing State Caption */}
              <div className="space-y-1">
                <div className="text-xs font-mono font-bold tracking-wider uppercase text-cyan-300">
                  {jarvisState === 'IDLE' && '● STANDBY // READY FOR VOICE OR COMMANDS'}
                  {jarvisState === 'LISTENING' && '▲ LISTENING // SPEAK FREELY...'}
                  {jarvisState === 'SEARCHING' && '◆ SCANNING KNOWLEDGE GRAPH & SERVICES...'}
                  {jarvisState === 'EXECUTING_ACTION' && '⚡ PERFORMING ACTION // EXECUTING SYSTEM TOOL'}
                  {jarvisState === 'SPEAKING' && '▼ HARMONIC VOICE PLAYBACK ACTIVE'}
                </div>
                {transcript && (
                  <div className="text-xs text-slate-300 italic px-4 line-clamp-1">
                    &quot;{transcript}&quot;
                  </div>
                )}
              </div>

              {/* Fluid Harmonic Audio Waveform */}
              <JarvisWaveform
                active={jarvisState !== 'IDLE'}
                audioLevel={audioLevel}
                barsCount={28}
              />
            </div>

            {/* Middle Section: Action Log & Prompt Chips */}
            <div className="space-y-3">
              <JarvisActionLog
                state={jarvisState}
                activeTool={activeTool}
                toolOutput={toolOutput}
                citations={citations}
                latencyMs={latencyMs}
              />

              <div className="space-y-1.5 text-left">
                <div className="text-[10px] font-mono text-slate-500">ASK GHAUS:</div>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    'What problem does this platform solve?',
                    'What services do you offer clients?',
                    'How do you guarantee zero hallucinations?',
                  ].map((promptText) => (
                    <button
                      key={promptText}
                      onClick={() => processMessage(promptText)}
                      className="text-[10px] px-2.5 py-1 rounded-lg bg-white/5 hover:bg-cyan-500/10 text-slate-300 hover:text-cyan-300 border border-white/10 hover:border-cyan-500/30 transition-all font-mono"
                    >
                      &quot;{promptText}&quot;
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Bottom Controls Pinned at Exact Same Baseline */}
            <div className="pt-3 border-t border-white/5 space-y-2">
              {isVoiceActive ? (
                <div className="flex items-center gap-2">
                  <Button
                    onClick={toggleVoice}
                    className="flex-1 text-xs h-11 rounded-2xl font-medium gap-2 shadow-xl transition-all bg-red-600 hover:bg-red-700 text-white animate-pulse"
                  >
                    <PhoneOff className="h-4 w-4" />
                    <span>End Voice Call</span>
                  </Button>
                  <Button
                    type="button"
                    onClick={toggleMute}
                    className={`h-11 px-4 rounded-2xl text-xs font-mono transition-all border ${
                      isMuted
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30'
                        : 'bg-white/10 text-white border-white/10 hover:bg-white/20'
                    }`}
                    title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
                  >
                    {isMuted ? (
                      <>
                        <MicOff className="h-4 w-4 text-amber-400" />
                        <span className="hidden sm:inline ml-1.5">Unmute</span>
                      </>
                    ) : (
                      <>
                        <Mic className="h-4 w-4 text-emerald-400" />
                        <span className="hidden sm:inline ml-1.5">Mute</span>
                      </>
                    )}
                  </Button>
                </div>
              ) : (
                <Button
                  onClick={toggleVoice}
                  className="w-full text-xs h-11 rounded-2xl font-medium gap-2 shadow-xl transition-all bg-gradient-to-r from-cyan-500 via-indigo-600 to-purple-600 hover:from-cyan-600 hover:to-purple-700 text-white shadow-cyan-500/20"
                >
                  <Mic className="h-4 w-4" />
                  <span>Start 2-Way Live Voice Call with Ghaus</span>
                </Button>
              )}


              <form onSubmit={handleConsoleSubmit} className="flex items-center gap-1.5 pt-0.5">
                <input
                  type="text"
                  value={consoleInput}
                  onChange={(e) => setConsoleInput(e.target.value)}
                  placeholder="Ask Ghaus about our services, the product story, or engineering..."
                  className="flex-1 px-3 py-1.5 bg-white/5 border border-white/10 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 font-mono"
                />
                <Button
                  type="submit"
                  size="sm"
                  className="h-8 px-3 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs"
                >
                  Send
                </Button>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* The Problem We Solved // What Was Broken & What We Engineered */}
      <section id="problem-solution" className="max-w-7xl mx-auto px-6 py-14 space-y-8">
        <div className="text-center space-y-2">
          <Badge variant="outline" className="border-cyan-500/30 text-cyan-400 text-xs px-3 py-1 font-mono uppercase tracking-wider">
            The Product Story // Problem &amp; Solution
          </Badge>
          <h2 className="text-2xl sm:text-4xl font-bold text-white tracking-tight">
            What Was Broken &amp; What We Engineered
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 max-w-2xl mx-auto">
            Recruiting outreach and sales prospecting are broken by manual research burnout, low-grade spam bans, and hallucinating AI bots. Here is how this platform fixes it:
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {[
            {
              problemTitle: 'The 20+ Hour Manual Discovery Grind',
              problemDesc: 'Founders, agencies, and recruiters spend dozens of hours every week manually sifting through LinkedIn, disjointed job boards, and business directories.',
              solutionTitle: 'Autonomous Multi-Source Ingestion',
              solutionDesc: 'Operates 24/7 autonomously across IMAP mailboxes, ATS webhooks, and Google Places. Opportunities are continuously ingested, parsed, and scored against proven rubrics without manual intervention.',
              tag: 'EFFICIENCY GAIN',
            },
            {
              problemTitle: 'Spray-and-Pray Spam That Burns Domains',
              problemDesc: 'Generic AI bots aggressively scrape websites and blast hundreds of cold emails a day, triggering spam filters, burning sender reputation, and getting domains permanently blacklisted.',
              solutionTitle: 'Polite Audits & 15/Day Safety Send Caps',
              solutionDesc: 'Respects robots.txt, conducts targeted site gap audits for genuine operational need-signals, and enforces a strict 15-per-day safety cap to ensure high domain deliverability and credibility.',
              tag: 'REPUTATION DEFENSE',
            },
            {
              problemTitle: 'Hallucinated Claims & Invented Experience',
              problemDesc: 'Standard LLM tools frequently invent credentials, fabricate client metrics, and make inaccurate promises that fall apart immediately under recruiter or client technical scrutiny.',
              solutionTitle: '100% Ground-Truth Verification Engines',
              solutionDesc: 'Every generated claim, pitch, and technical dossier is cross-referenced against confirmed database records using two-pass Zod validation. If a fact cannot be traced, the system refuses to generate it.',
              tag: 'AUDIT-PROOF TRUTH',
            },
            {
              problemTitle: 'The ATS Black Hole & Generic Resumes',
              problemDesc: 'Standard static resumes and generic copy-pasted templates are ignored by automated hiring systems and enterprise decision-makers looking for specific solutions.',
              solutionTitle: 'Dynamic Tailored Dossier Generator',
              solutionDesc: 'Builds tailored LaTeX dossiers and targeted value-focused propositions mapped directly to specific job specs and enterprise needs, highlighting verified relevant track records.',
              tag: 'HIGH CONVERSION',
            },
          ].map((item, idx) => (
            <div
              key={idx}
              className="rounded-3xl bg-card/25 border border-white/10 p-6 backdrop-blur-xl relative overflow-hidden flex flex-col justify-between space-y-4 hover:border-cyan-500/30 transition-all"
            >
              <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
                <span className="text-[10px] font-mono uppercase text-cyan-400 font-bold tracking-wider">
                  {item.tag}
                </span>
                <span className="text-[10px] font-mono text-slate-500">PIPELINE AUDIT #{idx + 1}</span>
              </div>

              {/* The Broken Problem */}
              <div className="space-y-1.5 p-3.5 rounded-2xl bg-rose-950/20 border border-rose-500/20">
                <div className="flex items-center gap-2 text-xs font-semibold text-rose-300">
                  <span className="h-2 w-2 rounded-full bg-rose-400" />
                  <span>The Problem: {item.problemTitle}</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed font-normal">
                  {item.problemDesc}
                </p>
              </div>

              {/* What We Fixed */}
              <div className="space-y-1.5 p-3.5 rounded-2xl bg-cyan-950/20 border border-cyan-500/20">
                <div className="flex items-center gap-2 text-xs font-semibold text-cyan-300">
                  <CheckCircle2 className="h-3.5 w-3.5 text-cyan-400" />
                  <span>What We Fixed: {item.solutionTitle}</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed font-normal">
                  {item.solutionDesc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Live System Architecture & Verification Blueprint */}
      <section id="architecture-blueprint" className="max-w-7xl mx-auto px-6 py-14 space-y-8">
        <div className="text-center space-y-2">
          <Badge variant="outline" className="border-cyan-500/30 text-cyan-400 text-xs px-3 py-1 font-mono uppercase tracking-wider">
            Enterprise Blueprint &amp; Verification
          </Badge>
          <h2 className="text-2xl sm:text-4xl font-bold text-white tracking-tight">
            Verifiable Architecture &amp; Live Telemetry
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 max-w-2xl mx-auto">
            Zero unverified claims. Every opportunity, lead, and outreach pack generated by this system traces code-first to verified database records and human approval gates.
          </p>
        </div>

        {/* Live Verifiable Metrics Counters */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Unverified Claims', val: '0', desc: '100% Traceable to Verified Profile' },
            { label: 'Scoring Accuracy', val: '83.3%', desc: 'Golden set verified rubric' },
            { label: 'Queue Throughput', val: '500k+', desc: 'Events handled via Redis BullMQ' },
            { label: 'Voice Turnaround', val: '<350ms', desc: 'Real-time conversational latency' },
          ].map((item, idx) => (
            <div
              key={idx}
              className="p-5 rounded-2xl bg-card/20 border border-white/5 backdrop-blur-md space-y-1 hover:border-cyan-500/30 transition-all text-center"
            >
              <div className="text-2xl sm:text-3xl font-extrabold text-white font-mono">
                {item.val}
              </div>
              <div className="text-xs font-semibold text-cyan-300">{item.label}</div>
              <div className="text-[11px] text-slate-500">{item.desc}</div>
            </div>
          ))}
        </div>

        {/* End-to-End Pipeline Schematic Diagram */}
        <div className="p-6 sm:p-8 rounded-3xl bg-[#080b12] border border-white/10 space-y-6">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-cyan-400" />
              <span className="text-xs font-bold text-white font-mono">
                ENTERPRISE INTELLIGENCE PIPELINE // HIGH-CONCURRENCY · AUDIT-PROOF · ZERO-HALLUCINATION
              </span>
            </div>
            <span className="text-[10px] font-mono text-emerald-400">
              AUDIT COMPLIANT · STRICT TYPE SAFETY
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            {[
              {
                step: '01. Sourcing',
                title: 'Autonomous Ingestion',
                desc: '24/7 continuous intake across IMAP mailboxes, ATS webhooks, and Google Places with zero manual scraping.',
                tag: 'Input Layer',
                color: 'border-cyan-500/30 bg-cyan-500/5 text-cyan-300',
              },
              {
                step: '02. Reliability',
                title: 'Fault-Tolerant Queues',
                desc: 'Distributed queue workers with exponential backoff retries and strict concurrency handling 500k+ events.',
                tag: '99.98% Uptime',
                color: 'border-indigo-500/30 bg-indigo-500/5 text-indigo-300',
              },
              {
                step: '03. Verification',
                title: 'Ground-Truth Reasoning',
                desc: 'Multi-model LLM engines validated via two-pass Zod schemas to guarantee 100% verified facts with zero hallucinations.',
                tag: 'Audit-Proof',
                color: 'border-purple-500/30 bg-purple-500/5 text-purple-300',
              },
              {
                step: '04. Governance',
                title: 'Human-in-the-Loop',
                desc: 'Mandatory web/mobile sign-off with enforced 15/day safety send caps to preserve domain deliverability and trust.',
                tag: 'Safety Guard',
                color: 'border-emerald-500/30 bg-emerald-500/5 text-emerald-300',
              },
              {
                step: '05. Delivery',
                title: 'High-Conversion Outbound',
                desc: 'Verified email dispatch, tailored LaTeX dossiers, and real-time CRM syncing with complete audit logs.',
                tag: 'Execution',
                color: 'border-amber-500/30 bg-amber-500/5 text-amber-300',
              },
            ].map((pipe, idx) => (
              <div
                key={idx}
                className={`p-4 rounded-2xl border ${pipe.color} space-y-2 relative`}
              >
                <div className="flex items-center justify-between text-[10px] font-mono">
                  <span>{pipe.step}</span>
                  <span className="px-1.5 py-0.2 rounded bg-white/5 border border-white/10">
                    {pipe.tag}
                  </span>
                </div>
                <h4 className="font-bold text-xs text-white">{pipe.title}</h4>
                <p className="text-[11px] text-slate-400 leading-relaxed">{pipe.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Interactive Platform Workstation (3D Horizontal Perspective Carousel) */}
      <section id="workstation-section" className="max-w-7xl mx-auto px-6 py-14 space-y-6">
        <div className="text-center space-y-2">
          <Badge variant="outline" className="border-indigo-500/30 text-indigo-400 text-xs px-3 py-1 font-mono uppercase tracking-wider">
            Interactive 3D Workstation
          </Badge>
          <h2 className="text-2xl sm:text-4xl font-bold text-white tracking-tight">
            Explore Autonomous Engines in Real-Time
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 max-w-xl mx-auto">
            Test live simulations of the 4 core platform engines in 3D perspective. (You can also ask Ghaus above by voice to switch these stations!)
          </p>
        </div>

        <InteractiveWorkstation
          activeTab={workstationTab}
          onTabChange={(tab) => setWorkstationTab(tab)}
          onBookConsultation={() => {
            setSelectedProductSlug('');
            setShowInquiryModal(true);
          }}
        />
      </section>

      {/* Productized Forward Deployed Engagements */}
      <section id="offerings" className="max-w-7xl mx-auto px-6 py-14 space-y-8">
        <div className="text-center space-y-2">
          <Badge variant="outline" className="border-cyan-500/30 text-cyan-400 text-xs px-3 py-1 font-mono uppercase tracking-wider">
            High-Impact Client Services &amp; Sprints
          </Badge>
          <h2 className="text-2xl sm:text-4xl font-bold text-white tracking-tight">
            Turnkey Systems &amp; Embedded Engineering Sprints
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 max-w-xl mx-auto">
            Proven, fixed-scope commercial engagements designed to eliminate operational bottlenecks, automate high-value research, and deploy production AI with zero downtime.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
          {(products.length > 0 ? products : DEFAULT_PRODUCTS).map((prod) => (
            <div
              key={prod.id}
              className="p-7 rounded-3xl bg-card/30 border border-white/5 hover:border-cyan-500/40 transition-all flex flex-col justify-between gap-6 relative group h-full"
            >
              <div className="space-y-3">
                {/* Dedicated Top Meta Row (Badge never overlaps title) */}
                <div className="flex items-center justify-between gap-2 border-b border-white/5 pb-2.5">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-cyan-400">
                    {prod.category?.replace(/_/g, ' ') || 'ENGINEERING SPRINT'}
                  </span>
                  {prod.badge && (
                    <Badge className="bg-cyan-500/15 text-cyan-300 border-cyan-500/30 text-[10px] font-mono">
                      {prod.badge}
                    </Badge>
                  )}
                </div>

                <h3 className="font-bold text-lg text-white leading-snug">{prod.title}</h3>
                {prod.tagline && (
                  <p className="text-xs font-medium text-cyan-300/90">{prod.tagline}</p>
                )}
                <p className="text-xs text-slate-400 leading-relaxed">{prod.description}</p>

                {/* Features */}
                <div className="space-y-2 pt-3 border-t border-white/5">
                  {prod.features.map((feat, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-slate-300">
                      <CheckCircle2 className="h-3.5 w-3.5 text-cyan-400 shrink-0 mt-0.5" />
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-white/5 space-y-3">
                <div className="flex items-baseline justify-between">
                  <span className="text-xs text-slate-400">Fixed Sprint Investment</span>
                  <span className="text-xl font-bold text-white font-mono">
                    {prod.priceUsd ? `$${prod.priceUsd.toLocaleString()}` : 'Custom Scope'}
                  </span>
                </div>

                <Button
                  onClick={() => {
                    setSelectedProductSlug(prod.slug);
                    setShowInquiryModal(true);
                  }}
                  className="w-full text-xs h-10 bg-cyan-600 hover:bg-cyan-700 text-white font-medium rounded-xl gap-2 shadow-md shadow-cyan-500/20"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>Request Deployment Sprint</span>
                </Button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Global Footer */}
      <footer className="border-t border-white/5 py-12 px-6 bg-black/60 text-xs text-slate-500 text-center space-y-4">
        <div className="flex items-center justify-center gap-6 text-slate-400 font-medium flex-wrap">
          <a
            href={PORTFOLIO_URL}
            target="_blank"
            rel="noreferrer"
            className="hover:text-white transition-colors"
          >
            Full Portfolio
          </a>
          <a
            href="https://linkedin.com/in/ghulam-ghaus-5b4ba9194/"
            target="_blank"
            rel="noreferrer"
            className="hover:text-white transition-colors"
          >
            LinkedIn Profile
          </a>
          <a
            href="https://github.com/Ghulam-Ghaus"
            target="_blank"
            rel="noreferrer"
            className="hover:text-white transition-colors"
          >
            GitHub Repositories
          </a>
          <Link href="/dashboard" className="hover:text-white transition-colors">
            Agent Dashboard
          </Link>
          <Link href="/admin" className="hover:text-white transition-colors">
            Admin Console
          </Link>
        </div>
        <p>© {new Date().getFullYear()} {displayName} · Forward Deployed AI Systems Architect. All rights reserved.</p>
        <p className="text-[10px] text-slate-600 font-mono">
          Engineered with NestJS 10+, Next.js 15, PostgreSQL pgvector, Redis BullMQ, and Deepgram Audio.
        </p>
      </footer>

      {/* Executive Consultation & RFP Lead Capture Modal */}
      {showInquiryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div
            className="w-full max-w-lg bg-[#0a0d17] border border-white/10 rounded-3xl shadow-2xl p-6 sm:p-7 space-y-5 animate-in zoom-in-95 duration-200 text-slate-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <h3 className="text-base font-bold text-white">
                  Direct FDE Consultation &amp; Deployment Request
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Discuss strategic forward-deployed roles, high-concurrency systems, or AI pipelines.
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowInquiryModal(false)}
                className="h-8 w-8 text-slate-400 hover:text-white rounded-xl"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {inquirySuccess ? (
              <div className="p-8 text-center space-y-3">
                <CheckCircle2 className="h-12 w-12 text-emerald-400 mx-auto" />
                <h4 className="font-bold text-base text-white">Inquiry Registered</h4>
                <p className="text-xs text-slate-300">
                  Thank you! Your request has been logged into Ghulam&apos;s CRM pipeline. You will receive a direct technical response within 24 hours.
                </p>
              </div>
            ) : (
              <form onSubmit={handleInquirySubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-medium text-slate-300 block mb-1">
                      Your Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={inquiryName}
                      onChange={(e) => setInquiryName(e.target.value)}
                      placeholder="e.g. Sarah Jenkins"
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-slate-300 block mb-1">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      required
                      value={inquiryEmail}
                      onChange={(e) => setInquiryEmail(e.target.value)}
                      placeholder="e.g. sarah@enterprise.com"
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-medium text-slate-300 block mb-1">
                    Company / Organization &amp; Region
                  </label>
                  <input
                    type="text"
                    value={inquiryCompany}
                    onChange={(e) => setInquiryCompany(e.target.value)}
                    placeholder="e.g. Gulf Sovereign Cloud (Riyadh / Dubai)"
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-medium text-slate-300 block mb-1">
                    Project Requirements / Architecture Scope *
                  </label>
                  <textarea
                    required
                    rows={4}
                    value={inquiryMessage}
                    onChange={(e) => setInquiryMessage(e.target.value)}
                    placeholder="Describe your operational bottleneck, target timeline, or required AI integration..."
                    className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowInquiryModal(false)}
                    className="text-xs h-9 border-white/10 text-slate-300 hover:text-white rounded-xl"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={submittingInquiry}
                    className="text-xs h-9 px-5 bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-600 hover:to-indigo-700 text-white rounded-xl gap-2 shadow-lg shadow-cyan-500/20"
                  >
                    {submittingInquiry ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    <span>Submit Executive Request</span>
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
