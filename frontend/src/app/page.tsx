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
  Terminal,
  Zap,
  Globe,
  Award,
  ChevronRight,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  api,
  type PublicProfile,
  type PublicProduct,
} from '@/lib/api-client';

const PORTFOLIO_URL = 'https://gghaus-portfolio.web.app/';

export default function PublicLandingPage() {
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [products, setProducts] = useState<PublicProduct[]>([]);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // Inquiry form modal state
  const [showInquiryModal, setShowInquiryModal] = useState(false);
  const [selectedProductSlug, setSelectedProductSlug] = useState<string>('');
  const [inquiryName, setInquiryName] = useState('');
  const [inquiryEmail, setInquiryEmail] = useState('');
  const [inquiryCompany, setInquiryCompany] = useState('');
  const [inquiryMessage, setInquiryMessage] = useState('');
  const [submittingInquiry, setSubmittingInquiry] = useState(false);
  const [inquirySuccess, setInquirySuccess] = useState(false);

  useEffect(() => {
    async function loadShowcase() {
      try {
        const [prof, prods] = await Promise.all([
          api.public.getProfile().catch(() => null),
          api.public.getProducts().catch(() => []),
        ]);
        if (prof) setProfile(prof);
        if (prods) setProducts(prods);
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

  const displayName = profile?.name || 'Ghulam Ghaus';
  const displayHeadline =
    profile?.headline || 'Senior Full Stack & AI Systems Architect';
  const displayLocation = profile?.location || 'Riyadh · Dubai · Remote';

  return (
    <div className="min-h-screen bg-[#07090e] text-slate-100 selection:bg-indigo-500/30 selection:text-indigo-200">
      {/* Top Ambient Glow Gradient */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-gradient-to-b from-indigo-500/15 via-purple-500/10 to-transparent blur-3xl pointer-events-none -z-10" />

      {/* Navigation Header */}
      <header className="sticky top-0 z-40 border-b border-white/5 bg-[#07090e]/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-indigo-500/25">
              <Bot className="h-5 w-5 text-white" />
            </div>
            <div>
              <span className="font-bold text-sm tracking-tight text-white block">
                {displayName}
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                GG IT SOLUTIONS · Portfolio Showcase
              </span>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-6 text-xs text-slate-300 font-medium">
            <a href="#about" className="hover:text-white transition-colors">
              About
            </a>
            <a href="#skills" className="hover:text-white transition-colors">
              Tech Stack
            </a>
            <a href="#projects" className="hover:text-white transition-colors">
              Case Studies
            </a>
            <a href="#offerings" className="hover:text-white transition-colors">
              Products &amp; Offerings
            </a>
            <Link href="/products" className="hover:text-indigo-400 transition-colors">
              All Offerings
            </Link>
          </nav>

          <div className="flex items-center gap-3">
            {isLoggedIn ? (
              <Link
                href="/dashboard"
                id="nav-open-workspace"
                className="text-xs font-semibold text-emerald-300 hover:text-emerald-200 transition-colors flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 shadow-sm"
              >
                <span>Open Workspace</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            ) : (
              <Link
                href="/login"
                id="nav-sign-in"
                className="text-xs font-medium text-slate-300 hover:text-white transition-colors flex items-center gap-1 px-3 py-1.5 rounded-lg border border-white/10 hover:border-white/20"
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
              className="gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-medium text-xs h-8 px-4 rounded-xl shadow-md shadow-indigo-500/20"
            >
              <Send className="h-3.5 w-3.5" />
              <span>Contact / Hire</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-20 pb-16 px-6 max-w-5xl mx-auto text-center space-y-6">
        {/* Availability Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Available for Senior / Lead Roles &amp; Strategic Advisory in Gulf &amp; Remote</span>
        </div>

        {/* Main Headline */}
        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white leading-tight">
          Architecting <span className="bg-gradient-to-r from-indigo-400 via-purple-300 to-pink-400 bg-clip-text text-transparent">Autonomous AI Workflows</span> &amp; High-Scale Web Systems.
        </h1>

        <p className="text-xs sm:text-sm font-semibold text-indigo-300 font-mono tracking-wide">
          {displayHeadline}
        </p>

        <p className="max-w-2xl mx-auto text-base sm:text-lg text-slate-400 leading-relaxed font-normal">
          {profile?.summary ||
            'Senior Full Stack Engineer & AI Systems Architect specializing in autonomous agentic pipelines, high-concurrency NestJS services, and modern Next.js 15 user interfaces.'}
        </p>

        {/* Meta Pills */}
        <div className="flex items-center justify-center gap-4 text-xs text-slate-400 pt-2 flex-wrap font-mono">
          <span className="flex items-center gap-1.5">
            <Globe className="h-3.5 w-3.5 text-indigo-400" />
            <span>{displayLocation}</span>
          </span>
          <span>•</span>
          <span className="flex items-center gap-1.5">
            <Zap className="h-3.5 w-3.5 text-amber-400" />
            <span>4+ Years Experience</span>
          </span>
          <span>•</span>
          <span className="flex items-center gap-1.5">
            <Award className="h-3.5 w-3.5 text-emerald-400" />
            <span>Top Tier Delivery</span>
          </span>
        </div>

        {/* Call to Actions */}
        <div className="pt-4 flex items-center justify-center gap-4 flex-wrap">
          <Button
            size="lg"
            onClick={() => {
              setSelectedProductSlug('');
              setShowInquiryModal(true);
            }}
            className="gap-2 bg-gradient-to-r from-indigo-500 via-purple-600 to-pink-500 hover:from-indigo-600 hover:to-pink-600 text-white font-semibold text-sm h-11 px-7 rounded-2xl shadow-lg shadow-indigo-500/25"
          >
            <span>Book Consultation / Hire</span>
            <ArrowRight className="h-4 w-4" />
          </Button>

          <Link href="/dashboard">
            <Button
              variant="outline"
              size="lg"
              className="gap-2 border-white/10 bg-white/5 hover:bg-white/10 text-white text-sm h-11 px-6 rounded-2xl backdrop-blur-sm"
            >
              <Terminal className="h-4 w-4 text-indigo-400" />
              <span>Launch Platform</span>
            </Button>
          </Link>
        </div>
      </section>

      {/* Highlights / Metric Counters */}
      <section className="max-w-6xl mx-auto px-6 py-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Production Workflows', val: '500k+', desc: 'Events processed' },
            { label: 'Scoring Accuracy', val: '83.3%', desc: 'Golden set verified' },
            { label: 'Core Architecture', val: 'Nest + Next', desc: '100% Strict TypeScript' },
            { label: 'Human-in-the-Loop', val: '100%', desc: 'Zero unverified claims' },
          ].map((item, idx) => (
            <div
              key={idx}
              className="p-5 rounded-2xl bg-card/20 border border-white/5 backdrop-blur-md space-y-1 hover:border-indigo-500/30 transition-all text-center"
            >
              <div className="text-2xl sm:text-3xl font-extrabold text-white font-mono">
                {item.val}
              </div>
              <div className="text-xs font-semibold text-indigo-300">{item.label}</div>
              <div className="text-[11px] text-slate-500">{item.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Tech Stack Section */}
      <section id="skills" className="max-w-6xl mx-auto px-6 py-14 space-y-8">
        <div className="text-center space-y-2">
          <Badge variant="outline" className="border-indigo-500/30 text-indigo-400 text-xs px-3 py-1 font-mono uppercase tracking-wider">
            Technical Competencies
          </Badge>
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Battle-Tested Modern Stack
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 max-w-xl mx-auto">
            Architected for verifiable accuracy, microsecond queues, and elegant human-centric user experiences.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Category 1: AI & Agentic Systems */}
          <div className="p-6 rounded-2xl bg-card/20 border border-white/5 backdrop-blur-md space-y-4 hover:border-purple-500/30 transition-all">
            <div className="h-10 w-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <Cpu className="h-5 w-5" />
            </div>
            <h3 className="font-semibold text-base text-white">AI &amp; Agentic Pipelines</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Multi-model reasoning chains (Gemini 2.0, Groq Llama 3), Zod structured schemas, two-pass verifier passes, and cost-guard rate limiters.
            </p>
            <div className="flex flex-wrap gap-1.5 pt-2">
              {['Vercel AI SDK', 'Structured Reasoning', 'Evidence Extraction', 'Prompt Versioning', 'Zod Validation'].map((t) => (
                <span key={t} className="text-[11px] px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-300 border border-purple-500/20">
                  {t}
                </span>
              ))}
            </div>
          </div>

          {/* Category 2: Backend Architecture */}
          <div className="p-6 rounded-2xl bg-card/20 border border-white/5 backdrop-blur-md space-y-4 hover:border-indigo-500/30 transition-all">
            <div className="h-10 w-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Layers className="h-5 w-5" />
            </div>
            <h3 className="font-semibold text-base text-white">Backend &amp; High-Throughput</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Production NestJS microservices, Prisma 7 with PostgreSQL pgvector, BullMQ Redis distributed workers, and strict multi-tenant userId isolation.
            </p>
            <div className="flex flex-wrap gap-1.5 pt-2">
              {['NestJS', 'Prisma 7', 'PostgreSQL', 'Redis', 'BullMQ', 'Docker', 'Swagger API'].map((t) => (
                <span key={t} className="text-[11px] px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                  {t}
                </span>
              ))}
            </div>
          </div>

          {/* Category 3: Frontend & Design Systems */}
          <div className="p-6 rounded-2xl bg-card/20 border border-white/5 backdrop-blur-md space-y-4 hover:border-pink-500/30 transition-all">
            <div className="h-10 w-10 rounded-xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-400">
              <Code2 className="h-5 w-5" />
            </div>
            <h3 className="font-semibold text-base text-white">Frontend &amp; Design Systems</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Next.js 15 App Router, React 19, Tailwind CSS, shadcn/ui, responsive dark-mode interfaces, and type-safe Swagger client generation.
            </p>
            <div className="flex flex-wrap gap-1.5 pt-2">
              {['Next.js 15', 'React 19', 'Tailwind CSS', 'shadcn/ui', 'TypeScript Strict', 'TanStack Query'].map((t) => (
                <span key={t} className="text-[11px] px-2 py-0.5 rounded-md bg-pink-500/10 text-pink-300 border border-pink-500/20">
                  {t}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Case Studies / Featured Projects */}
      <section id="projects" className="max-w-6xl mx-auto px-6 py-14 space-y-8">
        <div className="flex items-end justify-between flex-wrap gap-4">
          <div className="space-y-2">
            <Badge variant="outline" className="border-indigo-500/30 text-indigo-400 text-xs px-3 py-1 font-mono uppercase tracking-wider">
              Featured Case Studies
            </Badge>
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Production Implementations
            </h2>
          </div>
          {profile?.githubUrl && (
            <a
              href={profile.githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1.5 font-medium"
            >
              <span>Explore GitHub Repositories</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Main Showcase Project */}
          <div className="p-7 rounded-3xl bg-gradient-to-br from-indigo-950/30 to-purple-950/20 border border-indigo-500/30 backdrop-blur-md space-y-5 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Badge className="bg-indigo-500/20 text-indigo-300 border-indigo-500/40 text-[10px]">
                  Autonomous Agent Platform
                </Badge>
                <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Live System
                </span>
              </div>
              <h3 className="text-xl font-bold text-white">
                AI Job &amp; Client Ingestion Agent
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Autonomous system monitoring dedicated IMAP mailboxes, ATS job boards, and Google Places API (New). Automatically scores opportunities against verified user profiles with multi-factor match algorithms and drafts consultative outreach packs requiring Telegram/Web human approval.
              </p>

              <div className="space-y-1.5 pt-2">
                {[
                  'Multi-tenant PostgreSQL pgvector + BullMQ Redis queues',
                  'Google Places API discovery with strict 500 calls/mo quota guard',
                  'Polite robots.txt website need-signal extractor with quoted evidence',
                  '15/day safety send cap & global domain suppression list',
                ].map((feat, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-slate-300">
                    <CheckCircle2 className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                    <span>{feat}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-white/5 flex items-center justify-between">
              <div className="flex flex-wrap gap-1.5">
                {['NestJS', 'Next.js 15', 'Prisma 7', 'BullMQ', 'Zod'].map((tech) => (
                  <span key={tech} className="text-[10px] px-2 py-0.5 rounded bg-white/5 text-slate-300 border border-white/10 font-mono">
                    {tech}
                  </span>
                ))}
              </div>
              <Link href="/dashboard">
                <Button size="sm" className="h-8 text-xs gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl">
                  <span>View Console</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </div>
          </div>

          {/* Dynamic projects list or secondary showcase */}
          <div className="space-y-4 flex flex-col justify-between">
            {profile?.projects && profile.projects.length > 0 ? (
              profile.projects.slice(0, 3).map((proj) => (
                <div
                  key={proj.id}
                  className="p-5 rounded-2xl bg-card/20 border border-white/5 hover:border-indigo-500/30 transition-all space-y-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-semibold text-sm text-white">{proj.title}</h4>
                    {proj.url && (
                      <a
                        href={proj.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-indigo-400 hover:underline text-xs flex items-center gap-1 shrink-0"
                      >
                        <span>Demo</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 line-clamp-2">{proj.description}</p>
                  <div className="flex flex-wrap gap-1">
                    {Array.isArray(proj.techStack) &&
                      proj.techStack.map((tech: string) => (
                        <span key={tech} className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-slate-400 font-mono">
                          {tech}
                        </span>
                      ))}
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 rounded-2xl bg-card/20 border border-white/5 space-y-3">
                <h4 className="font-semibold text-sm text-white">Enterprise Full-Stack Architecture</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Engineered clean microservice architectures with global exception envelopes, request-ID tracing, fast Prisma 7 transactions, and shadcn/ui frontend applications.
                </p>
                <div className="flex flex-wrap gap-1.5 pt-2">
                  <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 font-mono">TypeScript</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-purple-500/10 text-purple-300 font-mono">NestJS</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-pink-500/10 text-pink-300 font-mono">PostgreSQL</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Productized Solutions & Offerings */}
      <section id="offerings" className="max-w-6xl mx-auto px-6 py-14 space-y-8">
        <div className="text-center space-y-2">
          <Badge variant="outline" className="border-indigo-500/30 text-indigo-400 text-xs px-3 py-1 font-mono uppercase tracking-wider">
            Productized Services
          </Badge>
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Consultancy &amp; Architectural Solutions
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 max-w-xl mx-auto">
            Ready-to-deploy blueprints and bespoke engineering engagements for businesses and startups.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {products.map((prod) => (
            <div
              key={prod.id}
              className="p-6 rounded-2xl bg-card/30 border border-white/5 hover:border-indigo-500/40 transition-all flex flex-col justify-between gap-5 relative group"
            >
              {prod.badge && (
                <div className="absolute top-4 right-4">
                  <Badge className="bg-indigo-500/20 text-indigo-300 border-indigo-500/40 text-[10px] font-mono">
                    {prod.badge}
                  </Badge>
                </div>
              )}

              <div className="space-y-3">
                <h3 className="font-bold text-base text-white">{prod.title}</h3>
                {prod.tagline && (
                  <p className="text-xs font-medium text-indigo-300">{prod.tagline}</p>
                )}
                <p className="text-xs text-slate-400 leading-relaxed">{prod.description}</p>

                {/* Features */}
                <div className="space-y-1.5 pt-3 border-t border-white/5">
                  {prod.features.map((feat, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-slate-300">
                      <CheckCircle2 className="h-3.5 w-3.5 text-indigo-400 shrink-0 mt-0.5" />
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-white/5 space-y-3">
                <div className="flex items-baseline justify-between">
                  <span className="text-xs text-slate-400">Starting from</span>
                  <span className="text-lg font-bold text-white font-mono">
                    {prod.priceUsd ? `$${prod.priceUsd.toLocaleString()}` : 'Custom Quote'}
                  </span>
                </div>

                <Button
                  onClick={() => {
                    setSelectedProductSlug(prod.slug);
                    setShowInquiryModal(true);
                  }}
                  className="w-full text-xs h-9 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl gap-1.5 shadow-md shadow-indigo-500/20"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>Request Solution</span>
                </Button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-12 px-6 bg-black/40 text-xs text-slate-500 text-center space-y-4">
        <div className="flex items-center justify-center gap-6 text-slate-400 font-medium">
          <a
            href={PORTFOLIO_URL}
            target="_blank"
            rel="noreferrer"
            className="hover:text-white transition-colors"
          >
            Full Portfolio
          </a>
          <Link href="/products" className="hover:text-white transition-colors">
            Product Catalog
          </Link>
          <Link href="/dashboard" className="hover:text-white transition-colors">
            Agent Dashboard
          </Link>
          <Link href="/admin" className="hover:text-white transition-colors">
            Admin Console
          </Link>
        </div>
        <p>© {new Date().getFullYear()} {displayName} · GG IT SOLUTIONS. All rights reserved.</p>
        <p className="text-[10px] text-slate-600 font-mono">
          Powered by NestJS, Next.js 15, PostgreSQL pgvector &amp; BullMQ.
        </p>
      </footer>

      {/* Inquiry Modal */}
      {showInquiryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
          <div
            className="w-full max-w-md bg-[#0d111a] border border-white/10 rounded-2xl shadow-2xl p-6 space-y-5 animate-in zoom-in-95 duration-200 text-slate-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <h3 className="text-sm font-semibold text-white">Direct Consultation &amp; Hire</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Discuss strategic projects, full stack engineering, or AI automation.
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowInquiryModal(false)}
                className="h-7 w-7 text-slate-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {inquirySuccess ? (
              <div className="p-6 text-center space-y-2">
                <CheckCircle2 className="h-10 w-10 text-emerald-400 mx-auto" />
                <h4 className="font-semibold text-sm text-white">Inquiry Received</h4>
                <p className="text-xs text-slate-400">
                  Thank you! We have logged your request and will respond within 24 hours.
                </p>
              </div>
            ) : (
              <form onSubmit={handleInquirySubmit} className="space-y-3.5">
                <div>
                  <label className="text-[11px] font-medium text-slate-300 block mb-1">Your Name *</label>
                  <input
                    type="text"
                    required
                    value={inquiryName}
                    onChange={(e) => setInquiryName(e.target.value)}
                    placeholder="e.g. Sarah Jenkins"
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-medium text-slate-300 block mb-1">Email Address *</label>
                  <input
                    type="email"
                    required
                    value={inquiryEmail}
                    onChange={(e) => setInquiryEmail(e.target.value)}
                    placeholder="e.g. sarah@company.com"
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-medium text-slate-300 block mb-1">Company / Organization</label>
                  <input
                    type="text"
                    value={inquiryCompany}
                    onChange={(e) => setInquiryCompany(e.target.value)}
                    placeholder="e.g. Apex Innovations Ltd"
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-medium text-slate-300 block mb-1">Project Details / Needs *</label>
                  <textarea
                    required
                    rows={3}
                    value={inquiryMessage}
                    onChange={(e) => setInquiryMessage(e.target.value)}
                    placeholder="Briefly describe what you are looking to build or achieve..."
                    className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowInquiryModal(false)}
                    className="text-xs h-8 border-white/10 text-slate-300 hover:text-white"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={submittingInquiry}
                    className="text-xs h-8 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl gap-1.5 shadow-md shadow-indigo-500/20"
                  >
                    {submittingInquiry ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Send className="h-3.5 w-3.5" />
                    )}
                    <span>Submit Inquiry</span>
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
