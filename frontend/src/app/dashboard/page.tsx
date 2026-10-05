'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import {
  api,
  type Opportunity,
  type SkillGap,
  type ScoreBreakdown,
  type JobRequirementFields,
  type TailoredCv,
  type CoverLetter,
} from '@/lib/api-client';
import { AtsSettingsModal } from '@/components/dashboard/ats-settings-modal';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function scoreColor(score: number): string {
  if (score >= 75) return '#22c55e';
  if (score >= 50) return '#f59e0b';
  return '#ef4444';
}

function scoreLabel(score: number): string {
  if (score >= 75) return 'Strong match';
  if (score >= 50) return 'Moderate match';
  return 'Weak match';
}

function formatDate(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function statusBadge(status: string): { label: string; color: string; bg: string } {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    DISCOVERED: { label: 'Discovered', color: '#93c5fd', bg: 'rgba(59,130,246,.15)' },
    QUALIFIED: { label: 'Qualified', color: '#6ee7b7', bg: 'rgba(16,185,129,.15)' },
    DRAFT_READY: { label: 'Draft Ready', color: '#fde68a', bg: 'rgba(245,158,11,.15)' },
    AWAITING_APPROVAL: { label: 'Awaiting Approval', color: '#fca5a5', bg: 'rgba(239,68,68,.15)' },
    APPLIED: { label: 'Applied', color: '#c4b5fd', bg: 'rgba(139,92,246,.15)' },
    VIEWED: { label: 'Viewed', color: '#94a3b8', bg: 'rgba(148,163,184,.15)' },
    SHORTLISTED: { label: 'Shortlisted', color: '#67e8f9', bg: 'rgba(6,182,212,.15)' },
    REJECTED: { label: 'Rejected', color: '#f87171', bg: 'rgba(239,68,68,.1)' },
    ARCHIVED: { label: 'Archived', color: '#6b7280', bg: 'rgba(107,114,128,.1)' },
  };
  return map[status] ?? { label: status, color: '#94a3b8', bg: 'rgba(148,163,184,.1)' };
}

// ─── Score Ring SVG ───────────────────────────────────────────────────────────

function ScoreRing({ score }: { score: number }) {
  const r = 28;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const color = scoreColor(score);
  return (
    <svg width="72" height="72" viewBox="0 0 72 72">
      <circle cx="36" cy="36" r={r} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="6" />
      <circle
        cx="36"
        cy="36"
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="6"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform="rotate(-90 36 36)"
        style={{ transition: 'stroke-dashoffset .6s ease' }}
      />
      <text x="36" y="40" textAnchor="middle" fill={color} fontSize="15" fontWeight="700">
        {score}
      </text>
    </svg>
  );
}

// ─── Breakdown bar ────────────────────────────────────────────────────────────

function BreakdownBar({
  label,
  value,
  max,
}: {
  label: string;
  value: number;
  max: number;
}) {
  const pct = Math.round((value / max) * 100);
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>
        <span>{label}</span>
        <span>
          {value}/{max}
        </span>
      </div>
      <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,.06)' }}>
        <div
          style={{
            height: '100%',
            borderRadius: 3,
            width: `${pct}%`,
            background: scoreColor(pct),
            transition: 'width .5s ease',
          }}
        />
      </div>
    </div>
  );
}

// ─── Import Dialog ────────────────────────────────────────────────────────────

function ImportDialog({
  onClose,
  onImported,
}: {
  onClose: () => void;
  onImported: (opp: Opportunity) => void;
}) {
  const [tab, setTab] = useState<'text' | 'url'>('text');
  const [text, setText] = useState('');
  const [url, setUrl] = useState('');
  const [type, setType] = useState<'JOB' | 'FREELANCE' | 'LEAD'>('JOB');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (tab === 'text' && !text.trim()) return;
    if (tab === 'url' && !url.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const result = await api.opportunities.create({
        text: tab === 'text' ? text : undefined,
        url: tab === 'url' ? url : undefined,
        type,
      });
      onImported(result);
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Import failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,.6)',
        backdropFilter: 'blur(4px)',
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          background: '#0f172a',
          border: '1px solid rgba(255,255,255,.1)',
          borderRadius: 16,
          padding: '32px',
          width: '100%',
          maxWidth: 520,
          boxShadow: '0 25px 50px rgba(0,0,0,.6)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#f1f5f9' }}>Import Job</h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#64748b',
              cursor: 'pointer',
              fontSize: 20,
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {(['text', 'url'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                flex: 1,
                padding: '8px 0',
                borderRadius: 8,
                border: 'none',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: 13,
                background: tab === t ? 'rgba(99,102,241,.3)' : 'rgba(255,255,255,.04)',
                color: tab === t ? '#818cf8' : '#64748b',
                transition: 'all .2s',
              }}
            >
              {t === 'text' ? '📋 Paste Description' : '🔗 Job URL'}
            </button>
          ))}
        </div>

        {/* Type selector */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {(['JOB', 'FREELANCE', 'LEAD'] as const).map((tp) => (
            <button
              key={tp}
              onClick={() => setType(tp)}
              style={{
                flex: 1,
                padding: '6px 0',
                borderRadius: 6,
                border: `1px solid ${type === tp ? '#6366f1' : 'rgba(255,255,255,.08)'}`,
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 600,
                background: type === tp ? 'rgba(99,102,241,.15)' : 'transparent',
                color: type === tp ? '#818cf8' : '#64748b',
              }}
            >
              {tp}
            </button>
          ))}
        </div>

        {/* Input */}
        {tab === 'text' ? (
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste the full job description here…"
            rows={10}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              background: 'rgba(255,255,255,.04)',
              border: '1px solid rgba(255,255,255,.1)',
              borderRadius: 10,
              padding: '12px 14px',
              color: '#f1f5f9',
              fontSize: 14,
              lineHeight: 1.6,
              resize: 'vertical',
              outline: 'none',
              fontFamily: 'inherit',
            }}
          />
        ) : (
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/jobs/123"
            style={{
              width: '100%',
              boxSizing: 'border-box',
              background: 'rgba(255,255,255,.04)',
              border: '1px solid rgba(255,255,255,.1)',
              borderRadius: 10,
              padding: '12px 14px',
              color: '#f1f5f9',
              fontSize: 14,
              outline: 'none',
              fontFamily: 'inherit',
            }}
          />
        )}

        {error && (
          <p style={{ margin: '12px 0 0', color: '#f87171', fontSize: 13 }}>⚠ {error}</p>
        )}

        <p style={{ margin: '12px 0 0', color: '#64748b', fontSize: 12 }}>
          AI will auto-extract job details and score the match against your profile.
        </p>

        <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              padding: '12px 0',
              borderRadius: 10,
              border: '1px solid rgba(255,255,255,.1)',
              background: 'transparent',
              color: '#94a3b8',
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={loading}
            style={{
              flex: 2,
              padding: '12px 0',
              borderRadius: 10,
              border: 'none',
              background: loading ? '#334155' : 'linear-gradient(135deg,#6366f1,#8b5cf6)',
              color: loading ? '#64748b' : '#fff',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: 14,
              fontWeight: 700,
              boxShadow: loading ? 'none' : '0 4px 15px rgba(99,102,241,.4)',
              transition: 'all .2s',
            }}
          >
            {loading ? '⏳ Processing…' : '🚀 Import & Analyse'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Evidence Drawer ──────────────────────────────────────────────────────────

function EvidenceDrawer({
  opp,
  onClose,
  onUpdated,
}: {
  opp: Opportunity;
  onClose: () => void;
  onUpdated?: (updated: Opportunity) => void;
}) {
  const router = useRouter();
  const [currentOpp, setCurrentOpp] = useState<Opportunity>(opp);
  const [addingSkill, setAddingSkill] = useState<string | null>(null);
  const [addingAll, setAddingAll] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  // Modals state
  const [generatingCv, setGeneratingCv] = useState(false);
  const [tailoredCv, setTailoredCv] = useState<TailoredCv | null>(null);
  const [showCvModal, setShowCvModal] = useState(false);
  const [cvStyleChoice, setCvStyleChoice] = useState<'AUTO' | 'GULF' | 'EUROPE'>('AUTO');

  const [generatingLetter, setGeneratingLetter] = useState(false);
  const [coverLetter, setCoverLetter] = useState<CoverLetter | null>(null);
  const [showLetterModal, setShowLetterModal] = useState(false);
  const [copiedLetter, setCopiedLetter] = useState(false);

  const req = currentOpp.requirement;
  const match = currentOpp.match;
  const fields = req?.fieldsJson as JobRequirementFields | undefined;
  const evidence = req?.evidenceJson as Record<string, string> | undefined;
  const breakdown = match?.breakdownJson as ScoreBreakdown | undefined;
  const gaps = (match?.gapsJson as SkillGap[]) ?? [];

  // Add 1 skill from gap
  const handleAddSkill = async (skillName: string) => {
    try {
      setAddingSkill(skillName);
      const res = await api.tailoredCv.addSkillFromGap({
        name: skillName,
        category: 'Backend',
        opportunityId: currentOpp.id,
      });
      if (res.rescoredOpportunity) {
        setCurrentOpp(res.rescoredOpportunity);
        onUpdated?.(res.rescoredOpportunity);
      }
      setActionMsg(`Added "${skillName}" to Master Profile & re-scored!`);
      setTimeout(() => setActionMsg(null), 3500);
    } catch {
      setActionMsg('Failed to add skill');
    } finally {
      setAddingSkill(null);
    }
  };

  // Add all skills from gaps
  const handleAddAllSkills = async () => {
    if (gaps.length === 0) return;
    try {
      setAddingAll(true);
      for (const g of gaps) {
        await api.tailoredCv.addSkillFromGap({
          name: g.skill,
          category: 'Backend',
        });
      }
      // Re-score once at end
      const rescored = await api.opportunities.reprocess(currentOpp.id);
      setCurrentOpp(rescored);
      onUpdated?.(rescored);
      setActionMsg(`Added all ${gaps.length} skills to profile & re-scored to ${rescored.match?.score ?? 0}/100!`);
      setTimeout(() => setActionMsg(null), 4000);
    } catch {
      setActionMsg('Failed to add all skills');
    } finally {
      setAddingAll(false);
    }
  };

  // Generate Tailored CV
  const handleGenerateCv = async () => {
    try {
      setGeneratingCv(true);
      const cv = await api.tailoredCv.generate({
        opportunityId: currentOpp.id,
        forceRegenerate: true,
      });
      setTailoredCv(cv);
      setShowCvModal(true);
    } catch {
      setActionMsg('Failed to generate tailored CV');
    } finally {
      setGeneratingCv(false);
    }
  };

  // Generate Cover Letter
  const handleGenerateCoverLetter = async () => {
    try {
      setGeneratingLetter(true);
      const letter = await api.tailoredCv.generateCoverLetter({
        opportunityId: currentOpp.id,
        forceRegenerate: true,
      });
      setCoverLetter(letter);
      setShowLetterModal(true);
    } catch {
      setActionMsg('Failed to generate cover letter');
    } finally {
      setGeneratingLetter(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        justifyContent: 'flex-end',
        background: 'rgba(0,0,0,.5)',
        backdropFilter: 'blur(2px)',
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 520,
          background: '#0f172a',
          borderLeft: '1px solid rgba(255,255,255,.08)',
          overflowY: 'auto',
          padding: '28px 24px',
          boxSizing: 'border-box',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#f1f5f9' }}>
              {currentOpp.title ?? 'Untitled'}
            </h2>
            <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 14 }}>
              {currentOpp.company ?? 'Unknown company'} {currentOpp.country ? `· ${currentOpp.country}` : ''}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 20 }}
          >
            ✕
          </button>
        </div>

        {/* Action feedback */}
        {actionMsg && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 8,
              background: 'rgba(99,102,241,.15)',
              border: '1px solid rgba(99,102,241,.3)',
              color: '#818cf8',
              fontSize: 12,
              marginBottom: 16,
              fontWeight: 600,
            }}
          >
            ✓ {actionMsg}
          </div>
        )}

        {/* Score Card */}
        {match && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'rgba(255,255,255,.04)',
              borderRadius: 12,
              padding: '16px 20px',
              marginBottom: 16,
              border: '1px solid rgba(255,255,255,.07)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <ScoreRing score={match.score} />
              <div>
                <div style={{ fontSize: 22, fontWeight: 800, color: scoreColor(match.score) }}>
                  {match.score}/100
                </div>
                <div style={{ fontSize: 13, color: '#94a3b8' }}>{scoreLabel(match.score)}</div>
              </div>
            </div>

            <div style={{ textAlign: 'right', fontSize: 11, color: '#64748b' }}>
              Tech: <span style={{ color: '#e2e8f0', fontWeight: 700 }}>{breakdown?.technical ?? 0}/40</span>
            </div>
          </div>
        )}

        {/* 3 Main Action Buttons */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 24 }}>
          <button
            onClick={handleGenerateCv}
            disabled={generatingCv}
            style={{
              padding: '10px 8px',
              borderRadius: 10,
              border: '1px solid rgba(99,102,241,.4)',
              background: 'rgba(99,102,241,.12)',
              color: '#c7d2fe',
              fontSize: 11,
              fontWeight: 600,
              cursor: generatingCv ? 'not-allowed' : 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <span style={{ fontSize: 16 }}>📄</span>
            <span>{generatingCv ? 'Tailoring…' : 'Tailored CV'}</span>
          </button>

          <button
            onClick={handleGenerateCoverLetter}
            disabled={generatingLetter}
            style={{
              padding: '10px 8px',
              borderRadius: 10,
              border: '1px solid rgba(168,85,247,.4)',
              background: 'rgba(168,85,247,.12)',
              color: '#e9d5ff',
              fontSize: 11,
              fontWeight: 600,
              cursor: generatingLetter ? 'not-allowed' : 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <span style={{ fontSize: 16 }}>✉️</span>
            <span>{generatingLetter ? 'Writing…' : 'Cover Letter'}</span>
          </button>

          <button
            onClick={() => router.push(`/interview-prep?opportunityId=${currentOpp.id}&role=${encodeURIComponent(currentOpp.title || '')}`)}
            style={{
              padding: '10px 8px',
              borderRadius: 10,
              border: '1px solid rgba(34,197,94,.4)',
              background: 'rgba(34,197,94,.12)',
              color: '#bbf7d0',
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <span style={{ fontSize: 16 }}>🎯</span>
            <span>Interview Prep</span>
          </button>
        </div>

        {/* Application submission link */}
        {currentOpp.url ? (
          <a
            id="drawer-open-apply-url"
            href={currentOpp.url}
            target="_blank"
            rel="noreferrer"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              padding: '11px 14px',
              borderRadius: 10,
              marginBottom: 24,
              background: 'linear-gradient(135deg,#22c55e,#16a34a)',
              color: '#fff',
              fontSize: 13,
              fontWeight: 700,
              textDecoration: 'none',
              boxShadow: '0 4px 15px rgba(34,197,94,.25)',
            }}
          >
            🔗 {currentOpp.type === 'FREELANCE' ? 'Open Proposal Page' : 'Open Application Page'}
          </a>
        ) : (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 10,
              marginBottom: 24,
              background: 'rgba(245,158,11,.1)',
              border: '1px solid rgba(245,158,11,.3)',
              color: '#fbbf24',
              fontSize: 12,
            }}
          >
            ⚠ No application URL was captured for this opportunity.
          </div>
        )}

        {/* Breakdown */}
        {breakdown && (
          <section style={{ marginBottom: 24 }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.05em' }}>
              Score Breakdown {currentOpp.type === 'FREELANCE' ? '(Freelance Model)' : '(Full-Time Model)'}
            </h3>
            {currentOpp.type === 'FREELANCE' ? (
              <>
                <BreakdownBar label="Technical Fit" value={breakdown.technical} max={25} />
                <BreakdownBar label="Budget Fit" value={breakdown.budgetFit ?? breakdown.salary} max={20} />
                <BreakdownBar label="Client Trust & History" value={breakdown.clientTrust ?? 15} max={20} />
                <BreakdownBar label="Competition (Proposals)" value={breakdown.competition ?? 10} max={15} />
                <BreakdownBar label="Scope Clarity" value={breakdown.scopeClarity ?? 7} max={10} />
                <BreakdownBar label="Track Record & Exp" value={breakdown.experience} max={10} />
              </>
            ) : (
              <>
                <BreakdownBar label="Technical Skills" value={breakdown.technical} max={40} />
                <BreakdownBar label="Experience" value={breakdown.experience} max={20} />
                <BreakdownBar label="Location / Remote" value={breakdown.location} max={15} />
                <BreakdownBar label="Seniority" value={breakdown.seniority} max={10} />
                <BreakdownBar label="Salary" value={breakdown.salary} max={10} />
                <BreakdownBar label="Visa" value={breakdown.visa} max={5} />
              </>
            )}
          </section>
        )}

        {/* Skill Gaps with 1-Click Profile Adoption */}
        {gaps.length > 0 && (
          <section style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.05em' }}>
                Skill Gaps ({gaps.length})
              </h3>
              <button
                onClick={handleAddAllSkills}
                disabled={addingAll}
                style={{
                  background: 'rgba(99,102,241,.15)',
                  border: '1px solid rgba(99,102,241,.4)',
                  color: '#818cf8',
                  borderRadius: 6,
                  padding: '3px 8px',
                  fontSize: 10,
                  fontWeight: 700,
                  cursor: addingAll ? 'not-allowed' : 'pointer',
                }}
              >
                {addingAll ? '⚡ Adding All…' : '⚡ Add All & Rescore'}
              </button>
            </div>

            {gaps.map((g, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  borderRadius: 8,
                  marginBottom: 6,
                  background: g.required ? 'rgba(239,68,68,.08)' : 'rgba(245,158,11,.06)',
                  border: `1px solid ${g.required ? 'rgba(239,68,68,.2)' : 'rgba(245,158,11,.15)'}`,
                }}
              >
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', minWidth: 0 }}>
                  <span style={{ fontSize: 14, marginTop: 1 }}>{g.required ? '🔴' : '🟡'}</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0', wordBreak: 'break-word' }}>{g.skill}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{g.reason}</div>
                  </div>
                </div>

                <button
                  onClick={() => handleAddSkill(g.skill)}
                  disabled={addingSkill === g.skill}
                  style={{
                    marginLeft: 12,
                    padding: '4px 10px',
                    borderRadius: 6,
                    background: 'rgba(255,255,255,.08)',
                    border: '1px solid rgba(255,255,255,.2)',
                    color: '#f8fafc',
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: addingSkill === g.skill ? 'not-allowed' : 'pointer',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                >
                  {addingSkill === g.skill ? 'Adding…' : '+ Add to Profile'}
                </button>
              </div>
            ))}
          </section>
        )}

        {/* Extracted fields */}
        {fields && (
          <section style={{ marginBottom: 24 }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.05em' }}>
              Extracted Details
            </h3>
            {[
              { label: 'Seniority', value: fields.seniority },
              { label: 'Years required', value: fields.yearsExp != null ? `${fields.yearsExp}y` : undefined },
              { label: 'Remote', value: fields.remote != null ? (fields.remote ? 'Yes' : 'No') : undefined },
              { label: 'Salary', value: fields.salaryMin || fields.salaryMax ? `${fields.salaryCurrency ?? '$'}${fields.salaryMin?.toLocaleString() ?? '?'} – ${fields.salaryMax?.toLocaleString() ?? '?'} / ${fields.salaryPeriod ?? 'year'}` : undefined },
              { label: 'Visa sponsorship', value: fields.visaSponsorship != null ? (fields.visaSponsorship ? 'Yes' : 'No') : undefined },
              { label: 'Industry', value: fields.industry },
            ]
              .filter((f) => f.value)
              .map((f) => (
                <div key={f.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,.05)', fontSize: 13 }}>
                  <span style={{ color: '#64748b' }}>{f.label}</span>
                  <span style={{ color: '#e2e8f0', fontWeight: 500 }}>{f.value}</span>
                </div>
              ))}

            {/* Required skills */}
            {(fields.skills ?? []).length > 0 && (
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>Required skills</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {fields.skills!.map((s) => (
                    <span
                      key={s.name}
                      style={{
                        padding: '3px 10px',
                        borderRadius: 20,
                        fontSize: 11,
                        fontWeight: 600,
                        background: s.required ? 'rgba(99,102,241,.15)' : 'rgba(255,255,255,.05)',
                        color: s.required ? '#818cf8' : '#94a3b8',
                        border: `1px solid ${s.required ? 'rgba(99,102,241,.3)' : 'rgba(255,255,255,.07)'}`,
                      }}
                    >
                      {s.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* Evidence */}
        {evidence && Object.keys(evidence).length > 0 && (
          <section>
            <h3 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.05em' }}>
              Evidence Quotes
            </h3>
            {Object.entries(evidence).map(([field, quote]) => (
              <div
                key={field}
                style={{
                  marginBottom: 10,
                  padding: '10px 14px',
                  borderRadius: 8,
                  background: 'rgba(255,255,255,.03)',
                  borderLeft: '3px solid rgba(99,102,241,.5)',
                }}
              >
                <div style={{ fontSize: 11, color: '#6366f1', fontWeight: 700, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                  {field}
                </div>
                <div style={{ fontSize: 13, color: '#cbd5e1', fontStyle: 'italic', lineHeight: 1.5 }}>
                  &ldquo;{quote}&rdquo;
                </div>
              </div>
            ))}
          </section>
        )}

        {/* Raw text */}
        <details style={{ marginTop: 24 }}>
          <summary style={{ cursor: 'pointer', fontSize: 12, color: '#64748b', userSelect: 'none' }}>
            View raw text
          </summary>
          <pre
            style={{
              marginTop: 10,
              padding: 12,
              borderRadius: 8,
              background: 'rgba(0,0,0,.3)',
              color: '#94a3b8',
              fontSize: 11,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              lineHeight: 1.6,
              maxHeight: 300,
              overflowY: 'auto',
            }}
          >
            {currentOpp.rawText}
          </pre>
        </details>
      </div>

      {/* Tailored CV Modal with ATS PDF Download */}
      {showCvModal && tailoredCv && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,.7)',
            backdropFilter: 'blur(4px)',
            padding: 20,
          }}
          onClick={(e) => e.target === e.currentTarget && setShowCvModal(false)}
        >
          <div
            style={{
              background: '#0f172a',
              border: '1px solid rgba(255,255,255,.15)',
              borderRadius: 16,
              padding: '24px 28px',
              maxWidth: 640,
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 25px 50px rgba(0,0,0,.8)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 18 }}>📄</span>
                  <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#f8fafc' }}>
                    Tailored CV Generated
                  </h3>
                  <span
                    style={{
                      fontSize: 11,
                      padding: '2px 8px',
                      borderRadius: 12,
                      fontWeight: 600,
                      background: tailoredCv.verifierStatus === 'passed' ? 'rgba(34,197,94,.15)' : 'rgba(245,158,11,.15)',
                      color: tailoredCv.verifierStatus === 'passed' ? '#4ade80' : '#fbbf24',
                      border: `1px solid ${tailoredCv.verifierStatus === 'passed' ? 'rgba(34,197,94,.3)' : 'rgba(245,158,11,.3)'}`,
                    }}
                  >
                    {tailoredCv.verifierStatus === 'passed' ? '✓ Fact-Checked' : '⚠ Flagged'}
                  </span>
                </div>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: '#94a3b8' }}>
                  ATS-optimized for &ldquo;{tailoredCv.targetRole}&rdquo;
                </p>
              </div>
              <button
                onClick={() => setShowCvModal(false)}
                style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 20 }}
              >
                ✕
              </button>
            </div>

            {/* Content summary */}
            <div style={{ background: 'rgba(255,255,255,.03)', padding: 16, borderRadius: 12, marginBottom: 16, border: '1px solid rgba(255,255,255,.06)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#818cf8', marginBottom: 4 }}>
                {tailoredCv.contentJson.headline}
              </div>
              <p style={{ fontSize: 12, color: '#cbd5e1', lineHeight: 1.5, margin: '0 0 12px' }}>
                {tailoredCv.contentJson.summary}
              </p>

              <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 6 }}>
                Emphasized Skill Pillars:
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {tailoredCv.contentJson.skills?.flatMap((s) => s.items).slice(0, 10).map((skillName, idx) => (
                  <span
                    key={idx}
                    style={{
                      padding: '2px 8px',
                      borderRadius: 6,
                      background: 'rgba(99,102,241,.15)',
                      color: '#a5b4fc',
                      fontSize: 11,
                      fontWeight: 600,
                    }}
                  >
                    {skillName}
                  </span>
                ))}
              </div>
            </div>

            {/* CV Template Layout Selector */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'rgba(255,255,255,.04)',
                padding: '10px 14px',
                borderRadius: 10,
                marginBottom: 16,
                border: '1px solid rgba(255,255,255,.08)',
                flexWrap: 'wrap',
                gap: 8,
              }}
            >
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#f1f5f9' }}>
                  CV Template Layout
                </div>
                <div style={{ fontSize: 11, color: '#94a3b8' }}>
                  {cvStyleChoice === 'GULF'
                    ? '🇸🇦 Gulf / GCC Executive (Visa status, notice period, mobility, direct contact)'
                    : cvStyleChoice === 'EUROPE'
                      ? '🇪🇺 European ATS Standard (GDPR compliant, zero bias fields, metric-heavy)'
                      : '⚡ Auto-Detect (Gulf layout for GCC jobs, European for UK/EU/Remote)'}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {(['AUTO', 'GULF', 'EUROPE'] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setCvStyleChoice(st)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 600,
                      border:
                        cvStyleChoice === st
                          ? '1px solid #6366f1'
                          : '1px solid rgba(255,255,255,.1)',
                      background: cvStyleChoice === st ? '#6366f1' : 'transparent',
                      color: '#fff',
                      cursor: 'pointer',
                    }}
                  >
                    {st === 'AUTO' ? '⚡ Auto' : st === 'GULF' ? '🇸🇦 Gulf' : '🇪🇺 Europe'}
                  </button>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                onClick={() => setShowCvModal(false)}
                style={{
                  padding: '8px 16px',
                  borderRadius: 8,
                  border: '1px solid rgba(255,255,255,.15)',
                  background: 'transparent',
                  color: '#94a3b8',
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                Close
              </button>
              <button
                type="button"
                onClick={async () => {
                  const styleParam = cvStyleChoice === 'AUTO' ? undefined : cvStyleChoice;
                  try {
                    await api.tailoredCv.downloadPdf(tailoredCv.id, undefined, styleParam);
                  } catch {
                    window.open(api.tailoredCv.downloadUrl(tailoredCv.id, styleParam), '_blank');
                  }
                }}
                style={{
                  padding: '8px 20px',
                  borderRadius: 8,
                  border: 'none',
                  background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
                  color: '#fff',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  textDecoration: 'none',
                  boxShadow: '0 4px 15px rgba(99,102,241,.4)',
                }}
              >
                <span>⬇️ Download ATS PDF</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cover Letter Modal with PDF Download */}
      {showLetterModal && coverLetter && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,.7)',
            backdropFilter: 'blur(4px)',
            padding: 20,
          }}
          onClick={(e) => e.target === e.currentTarget && setShowLetterModal(false)}
        >
          <div
            style={{
              background: '#0f172a',
              border: '1px solid rgba(255,255,255,.15)',
              borderRadius: 16,
              padding: '24px 28px',
              maxWidth: 640,
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 25px 50px rgba(0,0,0,.8)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#f8fafc' }}>
                  Tailored Cover Letter
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: '#94a3b8' }}>
                  Matched directly to {currentOpp.company || 'Hiring Team'} requirements
                </p>
              </div>
              <button
                onClick={() => setShowLetterModal(false)}
                style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 20 }}
              >
                ✕
              </button>
            </div>

            <textarea
              defaultValue={coverLetter.bodyEdited || coverLetter.body}
              rows={12}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                background: 'rgba(0,0,0,.3)',
                border: '1px solid rgba(255,255,255,.1)',
                borderRadius: 10,
                padding: '14px',
                color: '#f1f5f9',
                fontSize: 12,
                lineHeight: 1.6,
                resize: 'vertical',
                outline: 'none',
                fontFamily: 'inherit',
                marginBottom: 16,
              }}
            />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(coverLetter.bodyEdited || coverLetter.body);
                  setCopiedLetter(true);
                  setTimeout(() => setCopiedLetter(false), 2500);
                }}
                style={{
                  padding: '8px 14px',
                  borderRadius: 8,
                  border: '1px solid rgba(255,255,255,.15)',
                  background: 'rgba(255,255,255,.05)',
                  color: '#e2e8f0',
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                {copiedLetter ? '✓ Copied!' : '📋 Copy to Clipboard'}
              </button>

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={() => setShowLetterModal(false)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 8,
                    border: '1px solid rgba(255,255,255,.15)',
                    background: 'transparent',
                    color: '#94a3b8',
                    fontSize: 12,
                    cursor: 'pointer',
                  }}
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await api.tailoredCv.downloadCoverLetterPdf(coverLetter.id);
                    } catch {
                      window.open(api.tailoredCv.coverLetterDownloadUrl(coverLetter.id), '_blank');
                    }
                  }}
                  style={{
                    padding: '8px 18px',
                    borderRadius: 8,
                    border: 'none',
                    background: 'linear-gradient(135deg,#a855f7,#6366f1)',
                    color: '#fff',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    textDecoration: 'none',
                  }}
                >
                  <span>⬇️ Download PDF</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Opportunity Card ─────────────────────────────────────────────────────────

function OpportunityCard({
  opp,
  onOpen,
  onDelete,
  onReprocess,
  onBuildPack,
  buildingPack,
}: {
  opp: Opportunity;
  onOpen: () => void;
  onDelete: () => void;
  onReprocess: () => void;
  onBuildPack: () => void;
  buildingPack: boolean;
}) {
  const match = opp.match;
  const badge = statusBadge(opp.status);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm('Delete this opportunity?')) return;
    setDeleting(true);
    await onDelete();
  }

  return (
    <div
      onClick={onOpen}
      style={{
        cursor: 'pointer',
        background: 'rgba(255,255,255,.03)',
        border: '1px solid rgba(255,255,255,.07)',
        borderRadius: 12,
        padding: '18px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        transition: 'all .2s',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,.06)';
        (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(99,102,241,.3)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,.03)';
        (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,.07)';
      }}
    >
      {/* Score ring */}
      <div style={{ flexShrink: 0 }}>
        {match ? (
          <ScoreRing score={match.score} />
        ) : (
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: '50%',
              background: 'rgba(255,255,255,.04)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 11,
              color: '#64748b',
              border: '1px dashed rgba(255,255,255,.1)',
              textAlign: 'center',
              lineHeight: 1.3,
            }}
          >
            No<br />score
          </div>
        )}
      </div>

      {/* Main info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
          <h3
            style={{
              margin: 0,
              fontSize: 15,
              fontWeight: 700,
              color: '#f1f5f9',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: 260,
            }}
          >
            {opp.title ?? 'Processing…'}
          </h3>
          <span
            style={{
              padding: '2px 8px',
              borderRadius: 4,
              fontSize: 11,
              fontWeight: 600,
              color: badge.color,
              background: badge.bg,
              whiteSpace: 'nowrap',
            }}
          >
            {badge.label}
          </span>
        </div>
        <div style={{ fontSize: 13, color: '#64748b', marginBottom: 6 }}>
          {opp.company ?? '—'} {opp.country ? `· ${opp.country}` : ''} {opp.city ? `· ${opp.city}` : ''}
        </div>
        <div style={{ display: 'flex', gap: 12, fontSize: 11, color: '#475569', flexWrap: 'wrap', alignItems: 'center' }}>
          <span
            style={{
              padding: '1px 6px',
              borderRadius: 4,
              fontSize: 10,
              fontWeight: 700,
              background: opp.type === 'FREELANCE' ? 'rgba(16,185,129,.15)' : 'rgba(99,102,241,.15)',
              color: opp.type === 'FREELANCE' ? '#34d399' : '#818cf8',
              border: `1px solid ${opp.type === 'FREELANCE' ? 'rgba(16,185,129,.3)' : 'rgba(99,102,241,.3)'}`,
            }}
          >
            {opp.type === 'FREELANCE' ? '💼 UPWORK' : '🏢 JOB'}
          </span>
          {opp.requirement?.fieldsJson && (() => {
            const f = opp.requirement!.fieldsJson as JobRequirementFields;
            if (opp.type === 'FREELANCE' && f.freelanceRateMax) {
              const rateStr = f.freelanceRateType === 'HOURLY'
                ? `$${f.freelanceRateMin ? `${f.freelanceRateMin}-$` : ''}${f.freelanceRateMax}/hr`
                : `$${f.freelanceRateMax.toLocaleString()} Fixed`;
              return <span style={{ color: '#34d399', fontWeight: 600 }}>💰 {rateStr}</span>;
            }
            return f.remote ? <span>🌐 Remote</span> : null;
          })()}
          <span>📅 {formatDate(opp.createdAt)}</span>
        </div>
      </div>

      {/* Action buttons */}
      <div
        style={{ display: 'flex', gap: 6, flexShrink: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        {!opp.requirement && (
          <button
            onClick={onReprocess}
            title="Run AI extraction"
            style={{
              padding: '6px 10px',
              borderRadius: 6,
              border: '1px solid rgba(99,102,241,.3)',
              background: 'rgba(99,102,241,.1)',
              color: '#818cf8',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            ✨ Analyse
          </button>
        )}
        {opp.match && opp.status === 'QUALIFIED' && (
          <button
            onClick={(e) => { e.stopPropagation(); onBuildPack(); }}
            disabled={buildingPack}
            title={opp.type === 'FREELANCE' ? 'Generate tailored Upwork proposal' : 'Generate apply pack'}
            style={{
              padding: '6px 10px',
              borderRadius: 6,
              border: '1px solid rgba(34,197,94,.3)',
              background: buildingPack ? 'rgba(34,197,94,.05)' : 'rgba(34,197,94,.1)',
              color: buildingPack ? '#64748b' : '#22c55e',
              cursor: buildingPack ? 'not-allowed' : 'pointer',
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            {buildingPack ? '⏳ Drafting…' : (opp.type === 'FREELANCE' ? '📝 Proposal' : '📦 Pack')}
          </button>
        )}
        <button
          onClick={handleDelete}
          disabled={deleting}
          title="Delete"
          style={{
            padding: '6px 10px',
            borderRadius: 6,
            border: '1px solid rgba(239,68,68,.2)',
            background: 'rgba(239,68,68,.07)',
            color: '#f87171',
            cursor: deleting ? 'not-allowed' : 'pointer',
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          🗑
        </button>
      </div>
    </div>
  );
}

// ─── Main Dashboard Page ──────────────────────────────────────────────────────

export default function JobsDashboard() {
  const [opps, setOpps] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [showImport, setShowImport] = useState(false);
  const [showAtsSettings, setShowAtsSettings] = useState(false);
  const [selectedOpp, setSelectedOpp] = useState<Opportunity | null>(null);
  const [reprocessingId, setReprocessingId] = useState<string | null>(null);
  const [buildingPackId, setBuildingPackId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterType, setFilterType] = useState<'ALL' | 'JOB' | 'FREELANCE'>('ALL');
  const [syncing, setSyncing] = useState(false);

  async function handleSyncConnectors() {
    setSyncing(true);
    try {
      const res = await api.connectors.syncAll();
      const atsMsg = res.ats
        ? `ATS Boards (${res.ats.companiesChecked} companies checked):\n• ${res.ats.jobsFound ?? res.ats.jobsEnqueued} total postings found\n• ${res.ats.jobsEnqueued} newly enqueued\n• ${res.ats.duplicatesSkipped ?? 0} duplicates skipped (already tracked)\n• ${res.ats.locationFiltered ?? 0} filtered by location`
        : 'ATS: no data';
      alert(
        `Sync Complete!\n\nEmail Alerts: ${res.email.jobsEnqueued} newly enqueued (${res.email.totalProcessed} processed)\n\n${atsMsg}`,
      );
      await load();
    } catch (err: unknown) {
      alert(`Sync failed: ${String(err)}`);
    } finally {
      setSyncing(false);
    }
  }

  const load = useCallback(async () => {
    try {
      const data = await api.opportunities.list();
      setOpps(data);
    } catch {
      // silent — will show empty state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function handleImported(opp: Opportunity) {
    setOpps((prev) => [opp, ...prev.filter((o) => o.id !== opp.id)]);
  }

  async function handleDelete(id: string) {
    await api.opportunities.delete(id);
    setOpps((prev) => prev.filter((o) => o.id !== id));
  }

  async function handleReprocess(id: string) {
    setReprocessingId(id);
    try {
      const updated = await api.opportunities.reprocess(id);
      setOpps((prev) => prev.map((o) => (o.id === id ? updated : o)));
      if (selectedOpp?.id === id) setSelectedOpp(updated);
    } finally {
      setReprocessingId(null);
    }
  }

  async function handleBuildPack(id: string) {
    setBuildingPackId(id);
    try {
      await api.opportunities.buildPack(id);
      // Reload to get updated status
      const updated = await api.opportunities.get(id);
      setOpps((prev) => prev.map((o) => (o.id === id ? updated : o)));
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Pack generation failed');
    } finally {
      setBuildingPackId(null);
    }
  }

  const statuses = ['ALL', 'DISCOVERED', 'QUALIFIED', 'DRAFT_READY', 'APPLIED', 'SHORTLISTED', 'REJECTED'];
  const filtered = opps.filter((o) => {
    const statusMatch = filterStatus === 'ALL' || o.status === filterStatus;
    const typeMatch = filterType === 'ALL' || o.type === filterType;
    return statusMatch && typeMatch;
  });

  // Stats
  const avgScore =
    opps.filter((o) => o.match).length > 0
      ? Math.round(opps.filter((o) => o.match).reduce((a, o) => a + (o.match?.score ?? 0), 0) / opps.filter((o) => o.match).length)
      : null;

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <Header
          title="Job Opportunities"
          description={`${opps.length} tracked · ${opps.filter((o) => o.match).length} scored${avgScore !== null ? ` · avg ${avgScore}/100` : ''}`}
          breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Opportunities' }]}
          backHref="/"
          backLabel="Dashboard"
          nextHref="/approvals"
          nextLabel="Approval Queue"
          onSync={handleSyncConnectors}
          syncing={syncing}
        />

        <main className="p-6 sm:p-8 max-w-6xl mx-auto w-full space-y-6">
          {/* Action Row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/40 pb-4">
            <div>
              <h2 className="text-base font-semibold text-foreground">Discovered Pipeline</h2>
              <p className="text-xs text-muted-foreground">Scored against your Master Profile ATS criteria.</p>
            </div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <a
                href="/"
                target="_blank"
                rel="noreferrer"
                className="text-xs text-slate-300 hover:text-white transition-colors flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 hover:bg-white/5"
              >
                <span>🌐 View Showcase</span>
              </a>
              <Button
                onClick={() => setShowAtsSettings(true)}
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/10"
              >
                <span>⚙️ ATS &amp; Location Settings</span>
              </Button>
              <Button
                onClick={() => setShowImport(true)}
                size="sm"
                className="gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-medium shadow-md shadow-indigo-500/20 text-xs"
              >
                <span>＋</span> Import Job (URL or Text)
              </Button>
            </div>
          </div>
        {/* Stats row */}
        {opps.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12, marginBottom: 24 }}>
            {[
              { label: 'Total', value: opps.length, icon: '📋' },
              { label: 'Qualified', value: opps.filter((o) => o.status === 'QUALIFIED').length, icon: '✅' },
              { label: 'Applied', value: opps.filter((o) => o.status === 'APPLIED').length, icon: '📨' },
              { label: 'Avg Score', value: avgScore != null ? `${avgScore}` : '—', icon: '🎯' },
            ].map((s) => (
              <div
                key={s.label}
                style={{
                  background: 'rgba(255,255,255,.03)',
                  border: '1px solid rgba(255,255,255,.07)',
                  borderRadius: 10,
                  padding: '14px 18px',
                }}
              >
                <div style={{ fontSize: 20, marginBottom: 4 }}>{s.icon}</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: '#f1f5f9' }}>{s.value}</div>
                <div style={{ fontSize: 12, color: '#64748b' }}>{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Stream / Opportunity Type selector */}
        {opps.length > 0 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            {[
              { id: 'ALL', label: '🌐 All Opportunities', count: opps.length },
              { id: 'JOB', label: '🏢 Full-Time Jobs', count: opps.filter((o) => o.type !== 'FREELANCE').length },
              { id: 'FREELANCE', label: '💼 Upwork Freelance', count: opps.filter((o) => o.type === 'FREELANCE').length },
            ].map((t) => {
              const active = filterType === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setFilterType(t.id as any)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 8,
                    border: `1px solid ${active ? 'rgba(99,102,241,.6)' : 'rgba(255,255,255,.08)'}`,
                    background: active ? 'rgba(99,102,241,.25)' : 'rgba(255,255,255,.03)',
                    color: active ? '#fff' : '#94a3b8',
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: 600,
                    transition: 'all .2s',
                  }}
                >
                  {t.label} ({t.count})
                </button>
              );
            })}
          </div>
        )}

        {/* Filter bar */}
        {opps.length > 0 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
            {statuses.map((s) => {
              const count = s === 'ALL' ? opps.length : opps.filter((o) => o.status === s).length;
              const active = filterStatus === s;
              return (
                <button
                  key={s}
                  onClick={() => setFilterStatus(s)}
                  style={{
                    padding: '5px 12px',
                    borderRadius: 20,
                    border: `1px solid ${active ? 'rgba(99,102,241,.5)' : 'rgba(255,255,255,.07)'}`,
                    background: active ? 'rgba(99,102,241,.2)' : 'transparent',
                    color: active ? '#818cf8' : '#64748b',
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: 600,
                    transition: 'all .2s',
                  }}
                >
                  {s === 'ALL' ? 'All' : statusBadge(s).label} ({count})
                </button>
              );
            })}
          </div>
        )}

        {/* List */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '80px 0', color: '#475569' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
            <p>Loading opportunities…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '80px 0',
              border: '1px dashed rgba(255,255,255,.08)',
              borderRadius: 16,
            }}
          >
            <div style={{ fontSize: 48, marginBottom: 16 }}>📭</div>
            <h2 style={{ color: '#475569', margin: '0 0 8px', fontWeight: 600 }}>
              {filterStatus === 'ALL' ? 'No opportunities yet' : `No ${statusBadge(filterStatus).label} opportunities`}
            </h2>
            <p style={{ color: '#334155', margin: '0 0 24px', fontSize: 14 }}>
              Paste a job description or a URL and the AI will extract & score it for you.
            </p>
            {filterStatus === 'ALL' && (
              <button
                onClick={() => setShowImport(true)}
                style={{
                  padding: '12px 28px',
                  borderRadius: 10,
                  border: 'none',
                  background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: 14,
                  fontWeight: 700,
                  boxShadow: '0 4px 15px rgba(99,102,241,.4)',
                }}
              >
                ＋ Import First Job
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filtered.map((opp) => (
              <OpportunityCard
                key={opp.id}
                opp={reprocessingId === opp.id ? { ...opp, title: '⏳ Re-analysing…' } : opp}
                onOpen={() => setSelectedOpp(opp)}
                onDelete={() => handleDelete(opp.id)}
                onReprocess={() => handleReprocess(opp.id)}
                onBuildPack={() => handleBuildPack(opp.id)}
                buildingPack={buildingPackId === opp.id}
              />
            ))}
          </div>
        )}
        </main>
      </div>

      {/* Modals */}
      <AtsSettingsModal
        isOpen={showAtsSettings}
        onClose={() => setShowAtsSettings(false)}
        onSyncTriggered={load}
      />
      {showImport && (
        <ImportDialog onClose={() => setShowImport(false)} onImported={handleImported} />
      )}
      {selectedOpp && (
        <EvidenceDrawer
          opp={selectedOpp}
          onClose={() => setSelectedOpp(null)}
          onUpdated={(updated) => {
            setOpps((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
            setSelectedOpp(updated);
          }}
        />
      )}
    </div>
  );
}
