'use client';

import { useState } from 'react';
import { api, type Opportunity, type OutreachPackResult } from '@/lib/api-client';

interface OutreachModalProps {
  opportunity: Opportunity;
  onClose: () => void;
  onUpdated?: (updated: Opportunity) => void;
}

export function OutreachModal({
  opportunity,
  onClose,
  onUpdated,
}: OutreachModalProps) {
  const [currentOpp, setCurrentOpp] = useState<Opportunity>(opportunity);
  const [pack, setPack] = useState<OutreachPackResult | null>(
    (currentOpp.outreachPack as OutreachPackResult | null) || null,
  );
  const [loading, setLoading] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'recruiter' | 'connection' | 'founder' | 'referral' | 'followup'>('recruiter');

  // Local draft state for editing before copying
  const [draftRecruiter, setDraftRecruiter] = useState(pack?.recruiterDm ?? '');
  const [draftConnection, setDraftConnection] = useState(pack?.connectionNote ?? '');
  const [draftFounder, setDraftFounder] = useState(pack?.founderDm ?? '');
  const [draftReferral, setDraftReferral] = useState(pack?.referralRequest ?? '');
  const [draftFollowUp, setDraftFollowUp] = useState(pack?.followUpDm ?? '');

  const company = currentOpp.company || 'Company';
  const jobTitle = currentOpp.title || 'Role';

  const defaultLinkedInRecruiter =
    pack?.linkedInUrls?.talentAcquisition ||
    `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(
      company + ' technical recruiter OR talent acquisition',
    )}`;
  const defaultLinkedInEM =
    pack?.linkedInUrls?.engineeringManager ||
    `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(
      company + ' engineering manager OR vp engineering',
    )}`;

  // Generate pack
  const handleGenerate = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.opportunities.generateOutreach(currentOpp.id);
      setPack(res);
      setDraftRecruiter(res.recruiterDm);
      setDraftConnection(res.connectionNote);
      setDraftFounder(res.founderDm || '');
      setDraftReferral(res.referralRequest);
      setDraftFollowUp(res.followUpDm);
      
      const updatedOpp: Opportunity = {
        ...currentOpp,
        outreachPack: res,
      };
      setCurrentOpp(updatedOpp);
      onUpdated?.(updatedOpp);
      setActionMsg('Tailored outreach pack generated successfully!');
      setTimeout(() => setActionMsg(null), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to generate outreach pack');
    } finally {
      setLoading(false);
    }
  };

  // Update outreach status (not_sent | sent | replied)
  const handleStatusChange = async (newStatus: 'not_sent' | 'sent' | 'replied') => {
    try {
      setUpdatingStatus(true);
      setError(null);
      const updated = await api.opportunities.updateOutreachStatus(currentOpp.id, newStatus);
      setCurrentOpp(updated);
      onUpdated?.(updated);
      if (newStatus === 'sent') {
        setActionMsg('Marked as Sent! 7-day follow-up reminder scheduled.');
      } else if (newStatus === 'replied') {
        setActionMsg('Marked as Replied! Great job!');
      } else {
        setActionMsg('Status reset to Not Sent.');
      }
      setTimeout(() => setActionMsg(null), 3500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update outreach status');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const getCharBadge = (len: number, max: number) => {
    const isOver = len > max;
    return (
      <span
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: isOver ? '#ef4444' : len > max * 0.9 ? '#f59e0b' : '#10b981',
          background: isOver ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.1)',
          padding: '2px 8px',
          borderRadius: 6,
          border: `1px solid ${isOver ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.2)'}`,
        }}
      >
        {len} / {max} chars {isOver ? '⚠ OVER LIMIT' : '✓'}
      </span>
    );
  };

  const followUpDueText = currentOpp.outreachFollowUpDue
    ? new Date(currentOpp.outreachFollowUpDue).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

  const isFollowUpDueNow =
    currentOpp.outreachStatus === 'sent' &&
    currentOpp.outreachFollowUpDue &&
    new Date(currentOpp.outreachFollowUpDue).getTime() <= Date.now();

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.75)',
        backdropFilter: 'blur(6px)',
        padding: 16,
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 780,
          maxHeight: '92vh',
          background: '#0b1120',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: 16,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.7)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(180deg, rgba(99, 102, 241, 0.12) 0%, transparent 100%)',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 24 }}>✉️</span>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#f8fafc' }}>
                Tailored Outreach Pack
              </h2>
              {pack?.isStartup && (
                <span
                  style={{
                    fontSize: 11,
                    padding: '2px 8px',
                    borderRadius: 12,
                    background: 'rgba(236, 72, 153, 0.2)',
                    color: '#f472b6',
                    border: '1px solid rgba(236, 72, 153, 0.4)',
                    fontWeight: 700,
                  }}
                >
                  🚀 Early-Stage Startup
                </span>
              )}
            </div>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#94a3b8' }}>
              Targeting <strong style={{ color: '#e2e8f0' }}>{jobTitle}</strong> at{' '}
              <strong style={{ color: '#818cf8' }}>{company}</strong>
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              fontSize: 24,
              cursor: 'pointer',
              lineHeight: 1,
              padding: 4,
            }}
          >
            &times;
          </button>
        </div>

        {/* Scrollable Content */}
        <div style={{ padding: 24, overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 20 }}>
          {error && (
            <div
              style={{
                padding: '12px 16px',
                borderRadius: 8,
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#fca5a5',
                fontSize: 13,
              }}
            >
              ⚠ {error}
            </div>
          )}

          {actionMsg && (
            <div
              style={{
                padding: '12px 16px',
                borderRadius: 8,
                background: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                color: '#6ee7b7',
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              ✓ {actionMsg}
            </div>
          )}

          {/* Status Tracker Bar */}
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.03)',
              borderRadius: 12,
              padding: '14px 18px',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            <div>
              <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>
                Outreach Status
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color:
                      currentOpp.outreachStatus === 'replied'
                        ? '#34d399'
                        : currentOpp.outreachStatus === 'sent'
                        ? '#818cf8'
                        : '#94a3b8',
                  }}
                >
                  {currentOpp.outreachStatus === 'replied'
                    ? '🎉 Replied'
                    : currentOpp.outreachStatus === 'sent'
                    ? '📨 Outreach Sent'
                    : '⏳ Not Sent'}
                </span>
                {currentOpp.outreachStatus === 'sent' && followUpDueText && (
                  <span
                    style={{
                      fontSize: 11,
                      padding: '2px 8px',
                      borderRadius: 6,
                      background: isFollowUpDueNow ? 'rgba(239, 68, 68, 0.2)' : 'rgba(99, 102, 241, 0.15)',
                      color: isFollowUpDueNow ? '#f87171' : '#c7d2fe',
                      border: `1px solid ${isFollowUpDueNow ? 'rgba(239, 68, 68, 0.4)' : 'rgba(99, 102, 241, 0.3)'}`,
                      fontWeight: 600,
                    }}
                  >
                    {isFollowUpDueNow ? '🚨 Follow-up Due Today!' : `Follow-up Due: ${followUpDueText}`}
                  </span>
                )}
              </div>
            </div>

            {/* Status Change Buttons */}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                disabled={updatingStatus || currentOpp.outreachStatus === 'not_sent'}
                onClick={() => handleStatusChange('not_sent')}
                style={{
                  padding: '6px 12px',
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: currentOpp.outreachStatus === 'not_sent' ? 'default' : 'pointer',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  background: currentOpp.outreachStatus === 'not_sent' ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                  color: currentOpp.outreachStatus === 'not_sent' ? '#f1f5f9' : '#64748b',
                }}
              >
                Reset
              </button>
              <button
                disabled={updatingStatus || currentOpp.outreachStatus === 'sent'}
                onClick={() => handleStatusChange('sent')}
                style={{
                  padding: '6px 14px',
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: currentOpp.outreachStatus === 'sent' ? 'default' : 'pointer',
                  border: '1px solid rgba(99, 102, 241, 0.4)',
                  background: currentOpp.outreachStatus === 'sent' ? 'rgba(99, 102, 241, 0.25)' : 'rgba(99, 102, 241, 0.12)',
                  color: currentOpp.outreachStatus === 'sent' ? '#a5b4fc' : '#818cf8',
                }}
              >
                ✓ Mark as Sent (+7d Follow-up)
              </button>
              <button
                disabled={updatingStatus || currentOpp.outreachStatus === 'replied'}
                onClick={() => handleStatusChange('replied')}
                style={{
                  padding: '6px 14px',
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: currentOpp.outreachStatus === 'replied' ? 'default' : 'pointer',
                  border: '1px solid rgba(16, 185, 129, 0.4)',
                  background: currentOpp.outreachStatus === 'replied' ? 'rgba(16, 185, 129, 0.25)' : 'rgba(16, 185, 129, 0.12)',
                  color: currentOpp.outreachStatus === 'replied' ? '#6ee7b7' : '#34d399',
                }}
              >
                🎉 Mark as Replied
              </button>
            </div>
          </div>

          {/* LinkedIn Quick Search Row */}
          <div
            style={{
              display: 'flex',
              gap: 12,
              alignItems: 'center',
              flexWrap: 'wrap',
              background: 'rgba(10, 102, 194, 0.08)',
              padding: '12px 16px',
              borderRadius: 12,
              border: '1px solid rgba(10, 102, 194, 0.25)',
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 700, color: '#60a5fa' }}>
              LinkedIn Contacts:
            </span>
            <a
              href={defaultLinkedInRecruiter}
              target="_blank"
              rel="noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                borderRadius: 8,
                background: 'rgba(10, 102, 194, 0.2)',
                border: '1px solid rgba(10, 102, 194, 0.4)',
                color: '#93c5fd',
                fontSize: 12,
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              🔍 Find Recruiter / Talent Acquisition ↗
            </a>
            <a
              href={defaultLinkedInEM}
              target="_blank"
              rel="noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                borderRadius: 8,
                background: 'rgba(10, 102, 194, 0.2)',
                border: '1px solid rgba(10, 102, 194, 0.4)',
                color: '#93c5fd',
                fontSize: 12,
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              🔍 Find Engineering Manager / VP Eng ↗
            </a>
            <div style={{ marginLeft: 'auto' }}>
              <button
                disabled={loading}
                onClick={handleGenerate}
                style={{
                  padding: '7px 16px',
                  borderRadius: 8,
                  border: 'none',
                  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  color: '#fff',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
                }}
              >
                {loading ? 'Generating…' : pack ? '🔄 Regenerate Pack' : '✨ Generate Outreach Pack'}
              </button>
            </div>
          </div>

          {!pack && !loading && (
            <div
              style={{
                textAlign: 'center',
                padding: '40px 20px',
                borderRadius: 12,
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px dashed rgba(255, 255, 255, 0.1)',
              }}
            >
              <div style={{ fontSize: 32, marginBottom: 8 }}>💬</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#f1f5f9' }}>
                No Outreach Pack Generated Yet
              </div>
              <p style={{ fontSize: 13, color: '#94a3b8', maxWidth: 440, margin: '8px auto 16px' }}>
                Generate 5 tailored outreach messages strictly grounded in your profile experience, respecting
                all character boundaries (recruiter DM &le;450, connection note &le;280, referral &le;450, follow-up &le;450).
              </p>
              <button
                onClick={handleGenerate}
                style={{
                  padding: '10px 20px',
                  borderRadius: 10,
                  border: 'none',
                  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                ✨ Generate Now
              </button>
            </div>
          )}

          {pack && (
            <>
              {/* Message Tabs */}
              <div style={{ display: 'flex', gap: 6, borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: 8 }}>
                {[
                  { id: 'recruiter', label: 'Recruiter DM', max: 450, count: draftRecruiter.length },
                  { id: 'connection', label: 'Connection Note', max: 280, count: draftConnection.length },
                  ...(pack.isStartup || draftFounder
                    ? [{ id: 'founder', label: 'Founder DM', max: 450, count: draftFounder.length }]
                    : []),
                  { id: 'referral', label: 'Referral Request', max: 450, count: draftReferral.length },
                  { id: 'followup', label: '7-Day Follow-Up', max: 450, count: draftFollowUp.length },
                ].map((t) => {
                  const active = activeTab === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setActiveTab(t.id as any)}
                      style={{
                        padding: '8px 14px',
                        borderRadius: 8,
                        border: 'none',
                        background: active ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
                        color: active ? '#a5b4fc' : '#94a3b8',
                        fontSize: 12,
                        fontWeight: active ? 700 : 500,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                      }}
                    >
                      <span>{t.label}</span>
                      <span
                        style={{
                          fontSize: 10,
                          opacity: 0.8,
                          color: t.count > t.max ? '#ef4444' : 'inherit',
                        }}
                      >
                        ({t.count}c)
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Active Message View & Editor */}
              {activeTab === 'recruiter' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: 12, color: '#94a3b8' }}>
                      Message for Recruiter or Hiring Manager (Mentions profile highlights &amp; relocation status)
                    </div>
                    {getCharBadge(draftRecruiter.length, 450)}
                  </div>
                  <textarea
                    rows={5}
                    value={draftRecruiter}
                    onChange={(e) => setDraftRecruiter(e.target.value)}
                    style={{
                      width: '100%',
                      background: 'rgba(15, 23, 42, 0.6)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: 10,
                      padding: '12px 14px',
                      color: '#f1f5f9',
                      fontSize: 13,
                      lineHeight: 1.5,
                      fontFamily: 'inherit',
                      resize: 'vertical',
                      boxSizing: 'border-box',
                    }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => handleCopy(draftRecruiter, 'recruiter')}
                      style={{
                        padding: '8px 16px',
                        borderRadius: 8,
                        border: '1px solid rgba(99, 102, 241, 0.3)',
                        background: 'rgba(99, 102, 241, 0.15)',
                        color: '#c7d2fe',
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      {copiedKey === 'recruiter' ? '✓ Copied to Clipboard!' : '📋 Copy Recruiter DM'}
                    </button>
                  </div>
                </div>
              )}

              {activeTab === 'connection' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: 12, color: '#94a3b8' }}>
                      LinkedIn Connection Request Note (Strictly &le;280 chars)
                    </div>
                    {getCharBadge(draftConnection.length, 280)}
                  </div>
                  <textarea
                    rows={4}
                    value={draftConnection}
                    onChange={(e) => setDraftConnection(e.target.value)}
                    style={{
                      width: '100%',
                      background: 'rgba(15, 23, 42, 0.6)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: 10,
                      padding: '12px 14px',
                      color: '#f1f5f9',
                      fontSize: 13,
                      lineHeight: 1.5,
                      fontFamily: 'inherit',
                      resize: 'vertical',
                      boxSizing: 'border-box',
                    }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => handleCopy(draftConnection, 'connection')}
                      style={{
                        padding: '8px 16px',
                        borderRadius: 8,
                        border: '1px solid rgba(99, 102, 241, 0.3)',
                        background: 'rgba(99, 102, 241, 0.15)',
                        color: '#c7d2fe',
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      {copiedKey === 'connection' ? '✓ Copied to Clipboard!' : '📋 Copy Connection Note'}
                    </button>
                  </div>
                </div>
              )}

              {activeTab === 'founder' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: 12, color: '#94a3b8' }}>
                      Startup Founder / CTO DM (Focus on speed of execution, ownership &amp; scaling)
                    </div>
                    {getCharBadge(draftFounder.length, 450)}
                  </div>
                  <textarea
                    rows={5}
                    value={draftFounder}
                    onChange={(e) => setDraftFounder(e.target.value)}
                    placeholder="Enter founder DM or click Regenerate..."
                    style={{
                      width: '100%',
                      background: 'rgba(15, 23, 42, 0.6)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: 10,
                      padding: '12px 14px',
                      color: '#f1f5f9',
                      fontSize: 13,
                      lineHeight: 1.5,
                      fontFamily: 'inherit',
                      resize: 'vertical',
                      boxSizing: 'border-box',
                    }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => handleCopy(draftFounder, 'founder')}
                      style={{
                        padding: '8px 16px',
                        borderRadius: 8,
                        border: '1px solid rgba(236, 72, 153, 0.3)',
                        background: 'rgba(236, 72, 153, 0.15)',
                        color: '#f472b6',
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      {copiedKey === 'founder' ? '✓ Copied to Clipboard!' : '📋 Copy Founder DM'}
                    </button>
                  </div>
                </div>
              )}

              {activeTab === 'referral' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: 12, color: '#94a3b8' }}>
                      Referral Request (Polite note for existing engineer at {company})
                    </div>
                    {getCharBadge(draftReferral.length, 450)}
                  </div>
                  <textarea
                    rows={5}
                    value={draftReferral}
                    onChange={(e) => setDraftReferral(e.target.value)}
                    style={{
                      width: '100%',
                      background: 'rgba(15, 23, 42, 0.6)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: 10,
                      padding: '12px 14px',
                      color: '#f1f5f9',
                      fontSize: 13,
                      lineHeight: 1.5,
                      fontFamily: 'inherit',
                      resize: 'vertical',
                      boxSizing: 'border-box',
                    }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => handleCopy(draftReferral, 'referral')}
                      style={{
                        padding: '8px 16px',
                        borderRadius: 8,
                        border: '1px solid rgba(99, 102, 241, 0.3)',
                        background: 'rgba(99, 102, 241, 0.15)',
                        color: '#c7d2fe',
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      {copiedKey === 'referral' ? '✓ Copied to Clipboard!' : '📋 Copy Referral Request'}
                    </button>
                  </div>
                </div>
              )}

              {activeTab === 'followup' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: 12, color: '#94a3b8' }}>
                      7-Day Follow-Up Message (Friendly check-in if no response received)
                    </div>
                    {getCharBadge(draftFollowUp.length, 450)}
                  </div>
                  <textarea
                    rows={5}
                    value={draftFollowUp}
                    onChange={(e) => setDraftFollowUp(e.target.value)}
                    style={{
                      width: '100%',
                      background: 'rgba(15, 23, 42, 0.6)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: 10,
                      padding: '12px 14px',
                      color: '#f1f5f9',
                      fontSize: 13,
                      lineHeight: 1.5,
                      fontFamily: 'inherit',
                      resize: 'vertical',
                      boxSizing: 'border-box',
                    }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => handleCopy(draftFollowUp, 'followup')}
                      style={{
                        padding: '8px 16px',
                        borderRadius: 8,
                        border: '1px solid rgba(99, 102, 241, 0.3)',
                        background: 'rgba(99, 102, 241, 0.15)',
                        color: '#c7d2fe',
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      {copiedKey === 'followup' ? '✓ Copied to Clipboard!' : '📋 Copy Follow-Up Message'}
                    </button>
                  </div>
                </div>
              )}

              {/* Fact-Grounding & Truth Audit */}
              <div
                style={{
                  background: 'rgba(255, 255, 255, 0.02)',
                  borderRadius: 12,
                  padding: '14px 18px',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>
                  🛡️ Fact-Grounding &amp; Truth Audit
                </div>
                <div style={{ fontSize: 12, color: '#cbd5e1' }}>
                  <strong>Highlighted Profile Achievements:</strong>{' '}
                  {pack.highlightedProfileItems && pack.highlightedProfileItems.length > 0
                    ? pack.highlightedProfileItems.join(' · ')
                    : '4+ yrs backend/AI, NestJS, Python, Voice AI'}
                </div>
                <div>
                  {pack.unknownTechnologiesFlagged && pack.unknownTechnologiesFlagged.length > 0 ? (
                    <div style={{ fontSize: 12, color: '#f87171' }}>
                      ⚠️ <strong>Foreign skills flagged:</strong>{' '}
                      {pack.unknownTechnologiesFlagged.join(', ')} (verify before sending)
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: '#34d399' }}>
                      ✓ <strong>100% Truth Grounded:</strong> No ungrounded technologies detected. All experience maps
                      to candidate profile.
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
