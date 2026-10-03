'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  Globe,
  MapPin,
  ExternalLink,
  Code2,
  CheckCircle2,
  Send,
  Loader2,
  Bot,
  ArrowLeft,
  X,
  Award,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { api, type PublicProfile } from '@/lib/api-client';

export default function PublicProfilePage() {
  const params = useParams();
  const slug = typeof params?.slug === 'string' ? params.slug : undefined;

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Inquiry Modal
  const [showInquiryModal, setShowInquiryModal] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    async function fetchProfile() {
      try {
        setLoading(true);
        const data = await api.public.getProfile(slug);
        setProfile(data);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Profile not found');
      } finally {
        setLoading(false);
      }
    }
    fetchProfile();
  }, [slug]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !message.trim()) return;
    setSubmitting(true);
    try {
      await api.public.submitInquiry({
        name,
        email,
        company: company || undefined,
        message,
      });
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setShowInquiryModal(false);
        setName('');
        setEmail('');
        setCompany('');
        setMessage('');
      }, 3000);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#07090e] flex items-center justify-center text-slate-400">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
          <p className="text-xs">Loading public consultant profile...</p>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-[#07090e] text-slate-100 flex items-center justify-center p-6 text-center">
        <div className="space-y-4 max-w-md">
          <h2 className="text-xl font-bold text-white">Profile Not Found</h2>
          <p className="text-xs text-slate-400">
            The consultant profile &ldquo;{slug}&rdquo; could not be found or is not currently public.
          </p>
          <Link href="/">
            <Button variant="outline" size="sm" className="text-xs h-8 border-white/10 gap-1.5">
              <ArrowLeft className="h-3 w-3" />
              <span>Back to Home</span>
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#07090e] text-slate-100">
      {/* Top Navbar */}
      <header className="border-b border-white/5 bg-[#07090e]/80 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-xs text-slate-400 hover:text-white transition-colors">
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Showcase Home</span>
          </Link>

          <Button
            size="sm"
            onClick={() => setShowInquiryModal(true)}
            className="text-xs h-8 gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-md shadow-indigo-500/20"
          >
            <Send className="h-3 w-3" />
            <span>Send Direct Inquiry</span>
          </Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12 space-y-12">
        {/* Profile Card Header */}
        <div className="p-8 rounded-3xl bg-card/25 border border-white/5 backdrop-blur-md space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-bold text-white">{profile.name}</h1>
                <Badge variant="secondary" className="text-[10px] bg-indigo-500/20 text-indigo-300 font-mono">
                  Verified Consultant
                </Badge>
              </div>
              <p className="text-sm font-medium text-indigo-400">{profile.headline}</p>
              <div className="flex items-center gap-3 text-xs text-slate-400">
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5 text-indigo-400" />
                  <span>{profile.location}</span>
                </span>
                {profile.country && <span>• {profile.country}</span>}
              </div>
            </div>

            <div className="h-16 w-16 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/25 shrink-0">
              <Bot className="h-9 w-9 text-white" />
            </div>
          </div>

          <p className="text-sm text-slate-300 leading-relaxed pt-2 border-t border-white/5">
            {profile.summary}
          </p>

          <div className="flex items-center gap-3 text-xs pt-1 flex-wrap">
            {profile.githubUrl && (
              <a
                href={profile.githubUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 hover:border-indigo-500/40 text-slate-300 flex items-center gap-1.5"
              >
                <span>GitHub</span>
                <ExternalLink className="h-3 w-3 text-slate-500" />
              </a>
            )}
            {profile.linkedinUrl && (
              <a
                href={profile.linkedinUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 hover:border-indigo-500/40 text-slate-300 flex items-center gap-1.5"
              >
                <span>LinkedIn</span>
                <ExternalLink className="h-3 w-3 text-slate-500" />
              </a>
            )}
            {profile.portfolioUrl && (
              <a
                href={profile.portfolioUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 hover:border-indigo-500/40 text-slate-300 flex items-center gap-1.5"
              >
                <Globe className="h-3.5 w-3.5 text-indigo-400" />
                <span>Website</span>
              </a>
            )}
          </div>
        </div>

        {/* Technical Skills Grid */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Code2 className="h-4 w-4 text-indigo-400" />
            <span>Core Competencies &amp; Technical Skills</span>
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {profile.skills.map((skill, i) => (
              <div
                key={i}
                className="p-3 rounded-xl bg-card/20 border border-white/5 space-y-1 hover:border-indigo-500/30 transition-all text-xs"
              >
                <div className="font-semibold text-white">{skill.name}</div>
                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <span className="capitalize">{skill.level.toLowerCase()}</span>
                  {skill.yearsOfExp && <span>{skill.yearsOfExp} yrs</span>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Public Projects & Case Studies */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Award className="h-4 w-4 text-purple-400" />
            <span>Verified Projects &amp; Architectures</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {profile.projects.map((proj) => (
              <div
                key={proj.id}
                className="p-5 rounded-2xl bg-card/25 border border-white/5 space-y-3 hover:border-indigo-500/30 transition-all flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-sm text-white">{proj.title}</h3>
                    {proj.url && (
                      <a
                        href={proj.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-indigo-400 hover:underline flex items-center gap-1 shrink-0"
                      >
                        <span>Demo</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                  {proj.description && (
                    <p className="text-xs text-slate-400 line-clamp-3">{proj.description}</p>
                  )}
                </div>

                <div className="flex flex-wrap gap-1 pt-2 border-t border-white/5">
                  {Array.isArray(proj.techStack) &&
                    proj.techStack.map((tech: string) => (
                      <span key={tech} className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-slate-400 font-mono">
                        {tech}
                      </span>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Inquiry Modal */}
      {showInquiryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
          <div
            className="w-full max-w-md bg-[#0d111a] border border-white/10 rounded-2xl shadow-2xl p-6 space-y-5 animate-in zoom-in-95 duration-200 text-slate-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <h3 className="text-sm font-semibold text-white">Direct Message to {profile.name}</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Send a project inquiry or consultation request.
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

            {success ? (
              <div className="p-6 text-center space-y-2">
                <CheckCircle2 className="h-10 w-10 text-emerald-400 mx-auto" />
                <h4 className="font-semibold text-sm text-white">Message Sent</h4>
                <p className="text-xs text-slate-400">
                  Thank you! We have received your inquiry and will reach out promptly.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-3.5">
                <div>
                  <label className="text-[11px] font-medium text-slate-300 block mb-1">Your Name *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Sarah Jenkins"
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-medium text-slate-300 block mb-1">Email Address *</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. sarah@company.com"
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-medium text-slate-300 block mb-1">Company (Optional)</label>
                  <input
                    type="text"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder="e.g. Enterprise Logistics Corp"
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-medium text-slate-300 block mb-1">Message *</label>
                  <textarea
                    required
                    rows={3}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Briefly describe the project scope or engineering role..."
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
                    disabled={submitting}
                    className="text-xs h-8 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl gap-1.5 shadow-md shadow-indigo-500/20"
                  >
                    {submitting ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Send className="h-3.5 w-3.5" />
                    )}
                    <span>Send Message</span>
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
