'use client';

import { useState, useEffect, useCallback } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import {
  api,
  type ApplyPack,
  type VerifierIssue,
  type ScoreBreakdown,
  type JobRequirementFields,
  type ScreeningAnswerResult,
} from '@/lib/api-client';
import { ScreeningQuestionsModal } from '@/components/opportunities/ScreeningQuestionsModal';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function scoreColor(score: number): string {
  if (score >= 75) return '#22c55e';
  if (score >= 50) return '#f59e0b';
  return '#ef4444';
}

function formatDate(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

// ─── Score Ring ───────────────────────────────────────────────────────────────

function ScoreRing({ score, size = 56 }: { score: number; size?: number }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const color = scoreColor(score);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,.06)" strokeWidth="5" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="5"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset .6s ease' }}
      />
      <text x={size / 2} y={size / 2 + 5} textAnchor="middle" fill={color} fontSize="13" fontWeight="700">
        {score}
      </text>
    </svg>
  );
}

// ─── Pack Review Card ─────────────────────────────────────────────────────────

function PackReviewCard({
  pack,
  onApprove,
  onReject,
}: {
  pack: ApplyPack;
  onApprove: () => void;
  onReject: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editedNote, setEditedNote] = useState(pack.coverNoteEdited ?? pack.coverNote);
  const [saving, setSaving] = useState(false);
  const [acting, setActing] = useState<'approving' | 'rejecting' | null>(null);
  const [copied, setCopied] = useState(false);
  const [showScreeningModal, setShowScreeningModal] = useState(false);
  const [screeningAnswers, setScreeningAnswers] = useState<ScreeningAnswerResult[]>(
    (pack.answersFilled as ScreeningAnswerResult[]) || [],
  );
  const [copiedAnswerIdx, setCopiedAnswerIdx] = useState<number | null>(null);

  const opp = pack.opportunity;
  const match = opp?.match;
  const fields = opp?.requirement?.fieldsJson as JobRequirementFields | undefined;
  const issues = (pack.verifierIssues ?? []) as VerifierIssue[];
  const isFreelance = opp?.type === 'FREELANCE';

  async function copyToClipboard() {
    const textToCopy = editedNote;
    if (!textToCopy) return;
    await navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  async function saveEdit() {
    if (!opp) return;
    setSaving(true);
    try {
      await api.opportunities.updateCoverNote(opp.id, editedNote);
    } finally {
      setSaving(false);
      setEditing(false);
    }
  }

  async function handleApprove() {
    setActing('approving');
    await onApprove();
    setActing(null);
  }

  async function handleReject() {
    setActing('rejecting');
    await onReject();
    setActing(null);
  }

  const verifierColor =
    pack.verifierStatus === 'passed'
      ? '#22c55e'
      : pack.verifierStatus === 'flagged'
        ? '#f59e0b'
        : '#64748b';

  return (
    <div
      style={{
        background: 'rgba(255,255,255,.03)',
        border: '1px solid rgba(255,255,255,.07)',
        borderRadius: 14,
        overflow: 'hidden',
        transition: 'all .2s',
      }}
    >
      {/* Header */}
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          padding: '16px 20px',
          cursor: 'pointer',
        }}
      >
        {match && <ScoreRing score={match.score} />}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#f1f5f9' }}>
              {opp?.title ?? 'Untitled'}
            </h3>
            {isFreelance && (
              <span
                style={{
                  padding: '2px 8px',
                  borderRadius: 4,
                  fontSize: 10,
                  fontWeight: 700,
                  color: '#34d399',
                  background: 'rgba(16,185,129,.15)',
                  border: '1px solid rgba(16,185,129,.3)',
                  textTransform: 'uppercase',
                }}
              >
                💼 Upwork Proposal
              </span>
            )}
            <span
              style={{
                padding: '2px 8px',
                borderRadius: 4,
                fontSize: 10,
                fontWeight: 700,
                color: verifierColor,
                background: `${verifierColor}20`,
                textTransform: 'uppercase',
                letterSpacing: '.05em',
              }}
            >
              {pack.verifierStatus === 'passed' ? '✓ Verified' : pack.verifierStatus === 'flagged' ? '⚠ Flagged' : '⏳ Pending'}
            </span>
          </div>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
            {opp?.company ?? '—'} {opp?.country ? `· ${opp.country}` : ''} · {formatDate(pack.createdAt)}
          </p>
        </div>
        <span style={{ color: '#475569', fontSize: 18, transition: 'transform .2s', transform: expanded ? 'rotate(180deg)' : 'none' }}>
          ▾
        </span>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div style={{ padding: '0 20px 20px', borderTop: '1px solid rgba(255,255,255,.05)' }}>
          {/* Verifier Issues */}
          {issues.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#f59e0b', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                ⚠ Verifier Flagged {issues.length} Issue{issues.length > 1 ? 's' : ''}
              </div>
              {issues.map((issue, i) => (
                <div
                  key={i}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 8,
                    background: 'rgba(245,158,11,.06)',
                    border: '1px solid rgba(245,158,11,.15)',
                    marginBottom: 6,
                    fontSize: 12,
                  }}
                >
                  <div style={{ color: '#fbbf24', fontWeight: 600 }}>Claim: &ldquo;{issue.claim}&rdquo;</div>
                  <div style={{ color: '#94a3b8', marginTop: 2 }}>Reason: {issue.reason}</div>
                </div>
              ))}
            </div>
          )}

          {/* Cover Note */}
          <div style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.05em' }}>
                {isFreelance ? '📝 Tailored Upwork Proposal' : '📄 Cover Note'}
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); setEditing(!editing); }}
                style={{
                  background: 'rgba(99,102,241,.1)',
                  border: '1px solid rgba(99,102,241,.3)',
                  borderRadius: 6,
                  padding: '4px 10px',
                  color: '#818cf8',
                  cursor: 'pointer',
                  fontSize: 11,
                  fontWeight: 600,
                }}
              >
                {editing ? 'Cancel' : '✏️ Edit'}
              </button>
            </div>

            {editing ? (
              <div>
                <textarea
                  value={editedNote}
                  onChange={(e) => setEditedNote(e.target.value)}
                  rows={10}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    background: 'rgba(0,0,0,.3)',
                    border: '1px solid rgba(255,255,255,.1)',
                    borderRadius: 10,
                    padding: '12px 14px',
                    color: '#f1f5f9',
                    fontSize: 13,
                    lineHeight: 1.6,
                    resize: 'vertical',
                    outline: 'none',
                    fontFamily: 'inherit',
                  }}
                />
                <button
                  onClick={saveEdit}
                  disabled={saving}
                  style={{
                    marginTop: 8,
                    padding: '8px 16px',
                    borderRadius: 8,
                    border: 'none',
                    background: 'rgba(99,102,241,.3)',
                    color: '#818cf8',
                    cursor: saving ? 'not-allowed' : 'pointer',
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  {saving ? 'Saving…' : '💾 Save Changes'}
                </button>
              </div>
            ) : (
              <pre
                style={{
                  margin: 0,
                  padding: '14px 16px',
                  borderRadius: 10,
                  background: 'rgba(0,0,0,.25)',
                  color: '#cbd5e1',
                  fontSize: 13,
                  lineHeight: 1.7,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  border: '1px solid rgba(255,255,255,.05)',
                }}
              >
                {pack.coverNoteEdited ?? pack.coverNote}
              </pre>
            )}
          </div>

          {/* Extracted Skills */}
          {fields?.skills && fields.skills.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                Job Requirements
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {fields.skills.map((s) => (
                  <span
                    key={s.name}
                    style={{
                      padding: '3px 10px',
                      borderRadius: 20,
                      fontSize: 11,
                      fontWeight: 600,
                      background: s.required ? 'rgba(99,102,241,.12)' : 'rgba(255,255,255,.04)',
                      color: s.required ? '#818cf8' : '#64748b',
                      border: `1px solid ${s.required ? 'rgba(99,102,241,.25)' : 'rgba(255,255,255,.06)'}`,
                    }}
                  >
                    {s.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Score Breakdown */}
          {match?.breakdownJson && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                Match Breakdown
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))', gap: 8 }}>
                {Object.entries(match.breakdownJson as ScoreBreakdown)
                  .filter(([, val]) => typeof val === 'number')
                  .map(([key, val]) => (
                    <div key={key} style={{ background: 'rgba(255,255,255,.03)', borderRadius: 8, padding: '8px 12px', textAlign: 'center' }}>
                      <div style={{ fontSize: 18, fontWeight: 800, color: '#f1f5f9' }}>{val as number}</div>
                      <div style={{ fontSize: 10, color: '#64748b', textTransform: 'capitalize' }}>{key}</div>
                    </div>
                  ))}
              </div>

              {/* Score Adjustments Pills (e.g. GCC/KSA priority, high remote fit) */}
              {Array.isArray((match.breakdownJson as any)?.adjustments) &&
                (match.breakdownJson as any).adjustments.length > 0 && (
                  <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>Adjustments:</span>
                    {(match.breakdownJson as any).adjustments.map((adj: any) => (
                      <span
                        key={adj.id || adj.label}
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          padding: '2px 8px',
                          borderRadius: 6,
                          background: adj.points >= 0 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                          color: adj.points >= 0 ? '#6ee7b7' : '#fca5a5',
                          border: `1px solid ${adj.points >= 0 ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                        }}
                      >
                        {adj.points > 0 ? `+${adj.points}` : adj.points} {adj.label}
                      </span>
                    ))}
                  </div>
                )}
            </div>
          )}

          {/* Screening Questions Q&A Section */}
          {screeningAnswers.length > 0 && (
            <div style={{ marginTop: 18 }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 8,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '.05em' }}>
                    💬 HR Screening Answers ({screeningAnswers.length})
                  </span>
                  <span
                    style={{
                      fontSize: 10,
                      padding: '1px 6px',
                      borderRadius: 10,
                      background: 'rgba(56, 189, 248, 0.15)',
                      color: '#38bdf8',
                    }}
                  >
                    Grounded &amp; Saved
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowScreeningModal(true)}
                  style={{
                    background: 'rgba(56,189,248,.1)',
                    border: '1px solid rgba(56,189,248,.3)',
                    borderRadius: 6,
                    padding: '3px 8px',
                    color: '#38bdf8',
                    cursor: 'pointer',
                    fontSize: 11,
                    fontWeight: 600,
                  }}
                >
                  + Add / Edit Questions
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {screeningAnswers.map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: '12px 14px',
                      borderRadius: 10,
                      background: 'rgba(0,0,0,.3)',
                      border: '1px solid rgba(255,255,255,.07)',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        gap: 10,
                        marginBottom: 6,
                      }}
                    >
                      <div style={{ fontWeight: 700, fontSize: 12, color: '#f1f5f9' }}>
                        Q: {item.question}
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          await navigator.clipboard.writeText(item.answer);
                          setCopiedAnswerIdx(idx);
                          setTimeout(() => setCopiedAnswerIdx(null), 2500);
                        }}
                        style={{
                          flexShrink: 0,
                          padding: '3px 8px',
                          borderRadius: 5,
                          background:
                            copiedAnswerIdx === idx
                              ? 'rgba(16,185,129,.2)'
                              : 'rgba(56,189,248,.15)',
                          border: `1px solid ${
                            copiedAnswerIdx === idx
                              ? 'rgba(16,185,129,.4)'
                              : 'rgba(56,189,248,.3)'
                          }`,
                          color: copiedAnswerIdx === idx ? '#34d399' : '#38bdf8',
                          cursor: 'pointer',
                          fontSize: 10,
                          fontWeight: 600,
                        }}
                      >
                        {copiedAnswerIdx === idx ? '✓ Copied' : '📋 Copy'}
                      </button>
                    </div>

                    <div
                      style={{
                        color: '#cbd5e1',
                        fontSize: 12,
                        lineHeight: 1.6,
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      {item.answer}
                    </div>

                    {item.keyProjectsCited && item.keyProjectsCited.length > 0 && (
                      <div
                        style={{
                          marginTop: 8,
                          display: 'flex',
                          gap: 6,
                          flexWrap: 'wrap',
                          alignItems: 'center',
                        }}
                      >
                        <span style={{ fontSize: 10, color: '#64748b' }}>Projects:</span>
                        {item.keyProjectsCited.map((p, pi) => (
                          <span
                            key={pi}
                            style={{
                              fontSize: 10,
                              padding: '1px 6px',
                              borderRadius: 4,
                              background: 'rgba(99,102,241,.15)',
                              color: '#a5b4fc',
                            }}
                          >
                            🚀 {p}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: 10, marginTop: 24, flexWrap: 'wrap' }}>
            {opp && (
              <button
                type="button"
                onClick={() => setShowScreeningModal(true)}
                style={{
                  padding: '12px 18px',
                  borderRadius: 10,
                  border: '1px solid rgba(56,189,248,.4)',
                  background: 'rgba(56,189,248,.12)',
                  color: '#38bdf8',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                💬 Answer HR Questions {screeningAnswers.length > 0 && `(${screeningAnswers.length})`}
              </button>
            )}

            {opp && (
              <button
                type="button"
                onClick={async () => {
                  try {
                    const cv = await api.tailoredCv.generate({ opportunityId: opp.id });
                    await api.tailoredCv.downloadPdf(cv.id);
                  } catch {
                    alert('Failed to generate or download tailored CV');
                  }
                }}
                style={{
                  padding: '12px 18px',
                  borderRadius: 10,
                  border: '1px solid rgba(99,102,241,.4)',
                  background: 'rgba(99,102,241,.15)',
                  color: '#c7d2fe',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                📄 Download Tailored CV (PDF)
              </button>
            )}

            {opp && (
              <a
                href={`/interview-prep?opportunityId=${opp.id}&role=${encodeURIComponent(opp.title || '')}`}
                style={{
                  padding: '12px 18px',
                  borderRadius: 10,
                  border: '1px solid rgba(34,197,94,.4)',
                  background: 'rgba(34,197,94,.12)',
                  color: '#86efac',
                  fontSize: 13,
                  fontWeight: 700,
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                🎯 Role Interview Prep
              </a>
            )}

            {opp?.url ? (
              <a
                id="approval-open-apply-url"
                href={opp.url}
                target="_blank"
                rel="noreferrer"
                style={{
                  padding: '12px 18px',
                  borderRadius: 10,
                  border: '1px solid rgba(99,102,241,.3)',
                  background: 'rgba(99,102,241,.1)',
                  color: '#818cf8',
                  fontSize: 13,
                  fontWeight: 700,
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                {isFreelance ? '🔗 Open Upwork' : '🔗 Open Application Page'}
              </a>
            ) : (
              <span style={{ padding: '12px 18px', fontSize: 12, color: '#f59e0b' }}>
                ⚠ No application URL captured — search the company careers page
              </span>
            )}
            <button
              type="button"
              onClick={copyToClipboard}
              style={{
                padding: '12px 18px',
                borderRadius: 10,
                border: '1px solid rgba(16,185,129,.4)',
                background: copied ? 'rgba(16,185,129,.25)' : 'rgba(16,185,129,.12)',
                color: '#34d399',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                transition: 'all .2s',
              }}
            >
              {copied
                ? '✅ Copied!'
                : isFreelance
                  ? '📋 Copy Proposal'
                  : '📋 Copy Cover Note'}
            </button>
            {opp?.url && (
              <div
                style={{
                  width: '100%',
                  fontSize: 11,
                  color: '#64748b',
                  wordBreak: 'break-all',
                }}
              >
                Apply at: {opp.url}
              </div>
            )}
            <button
              onClick={handleReject}
              disabled={acting !== null}
              style={{
                flex: 1,
                minWidth: 100,
                padding: '12px 0',
                borderRadius: 10,
                border: '1px solid rgba(239,68,68,.3)',
                background: acting === 'rejecting' ? 'rgba(239,68,68,.15)' : 'rgba(239,68,68,.07)',
                color: '#f87171',
                cursor: acting ? 'not-allowed' : 'pointer',
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              {acting === 'rejecting' ? '⏳ Rejecting…' : '✗ Dismiss'}
            </button>
            <button
              onClick={handleApprove}
              disabled={acting !== null}
              style={{
                flex: 2,
                minWidth: 160,
                padding: '12px 0',
                borderRadius: 10,
                border: 'none',
                background: acting === 'approving' ? '#334155' : 'linear-gradient(135deg,#22c55e,#16a34a)',
                color: acting === 'approving' ? '#64748b' : '#fff',
                cursor: acting ? 'not-allowed' : 'pointer',
                fontSize: 13,
                fontWeight: 700,
                boxShadow: acting ? 'none' : '0 4px 15px rgba(34,197,94,.3)',
              }}
            >
              {acting === 'approving' ? '⏳ Approving…' : '✓ Approve & Mark Applied'}
            </button>
          </div>
        </div>
      )}

      {showScreeningModal && opp && (
        <ScreeningQuestionsModal
          opportunityId={opp.id}
          jobTitle={opp.title}
          company={opp.company}
          initialAnswers={screeningAnswers}
          onClose={() => setShowScreeningModal(false)}
          onSaved={(newAnswers) => setScreeningAnswers(newAnswers)}
        />
      )}
    </div>
  );
}

// ─── Main Approval Queue Page ─────────────────────────────────────────────────

export default function ApprovalQueuePage() {
  const [packs, setPacks] = useState<ApplyPack[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'pending' | 'decided'>('pending');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.approvals.pending();
      setPacks(data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleApprove(packId: string) {
    await api.approvals.decide(packId, 'approved');
    setPacks((prev) => prev.filter((p) => p.id !== packId));
  }

  async function handleReject(packId: string) {
    await api.approvals.decide(packId, 'rejected');
    setPacks((prev) => prev.filter((p) => p.id !== packId));
  }

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <Header
          title="Approval Queue"
          description={`${packs.length} pack${packs.length !== 1 ? 's' : ''} awaiting your review`}
          breadcrumbs={[
            { label: 'Home', href: '/' },
            { label: 'Opportunities', href: '/dashboard' },
            { label: 'Approval Queue' },
          ]}
          backHref="/dashboard"
          backLabel="Opportunities"
        />

        <main className="p-6 sm:p-8 max-w-5xl mx-auto w-full space-y-6">
          {/* Subheader / Tabs row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/40 pb-4">
            <div>
              <h2 className="text-base font-semibold text-foreground">Pending Review & Verifier Check</h2>
              <p className="text-xs text-muted-foreground">Every claim is fact-checked against your master profile. Nothing is dispatched without human approval.</p>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-muted/40 border border-border/40 rounded-lg p-1">
              {(['pending', 'decided'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                    tab === t
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {t === 'pending' ? '📋 Pending' : '📁 History'}
                </button>
              ))}
            </div>
          </div>

          <div>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '80px 0', color: '#475569' }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
                <p>Loading approval queue…</p>
              </div>
            ) : tab === 'pending' && packs.length === 0 ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: '80px 0',
                  border: '1px dashed rgba(255,255,255,.08)',
                  borderRadius: 16,
                }}
              >
                <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
                <h2 style={{ color: '#475569', margin: '0 0 8px', fontWeight: 600 }}>
                  All caught up!
                </h2>
                <p style={{ color: '#334155', margin: 0, fontSize: 14 }}>
                  No apply packs awaiting review. Import jobs and generate packs to see them here.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {packs.map((pack) => (
                  <PackReviewCard
                    key={pack.id}
                    pack={pack}
                    onApprove={() => handleApprove(pack.id)}
                    onReject={() => handleReject(pack.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
