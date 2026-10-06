'use client';

import { useState } from 'react';
import { api, type ScreeningAnswerResult } from '@/lib/api-client';

interface ScreeningQuestionsModalProps {
  opportunityId: string;
  jobTitle?: string;
  company?: string;
  initialAnswers?: ScreeningAnswerResult[];
  onClose: () => void;
  onSaved?: (answers: ScreeningAnswerResult[]) => void;
}

const PRESET_QUESTIONS = [
  'Why are you applying to this role and company?',
  'Why are you applying to the Builders Program at Tamara?',
  'Please provide details of any internships or co-op placements you have completed or are currently undertaking, including company name, focus, and dates.',
  'Describe a challenging technical project you worked on and your specific contributions.',
  'What is your availability, relocation status, and notice period?',
];

export function ScreeningQuestionsModal({
  opportunityId,
  jobTitle,
  company,
  initialAnswers = [],
  onClose,
  onSaved,
}: ScreeningQuestionsModalProps) {
  const [questions, setQuestions] = useState<string[]>(
    initialAnswers.length > 0
      ? initialAnswers.map((a) => a.question)
      : [
          company
            ? `Why are you applying to ${company}?`
            : 'Why are you applying to this role?',
          'Please provide details of any internships or co-op placements you have completed or are currently undertaking, including the company name, area of focus, and dates.',
        ],
  );
  const [answers, setAnswers] = useState<ScreeningAnswerResult[]>(initialAnswers);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  const handleAddQuestion = (qText: string = '') => {
    setQuestions((prev) => [...prev, qText]);
  };

  const handleUpdateQuestion = (index: number, text: string) => {
    setQuestions((prev) => {
      const next = [...prev];
      next[index] = text;
      return next;
    });
  };

  const handleRemoveQuestion = (index: number) => {
    setQuestions((prev) => prev.filter((_, i) => i !== index));
  };

  const handleGenerate = async () => {
    const validQuestions = questions.map((q) => q.trim()).filter(Boolean);
    if (validQuestions.length === 0) {
      setError('Please add at least one screening question');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const res = await api.opportunities.generateScreeningAnswers(
        opportunityId,
        validQuestions,
      );
      setAnswers(res.answers);
      onSaved?.(res.answers);
    } catch (err: any) {
      setError(err?.message || 'Failed to generate screening answers');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string, index: number) => {
    await navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2500);
  };

  const copyAllToClipboard = async () => {
    if (answers.length === 0) return;
    const formatted = answers
      .map(
        (a, i) =>
          `Q${i + 1}: ${a.question}\n\nA:\n${a.answer}${
            a.keyProjectsCited && a.keyProjectsCited.length > 0
              ? `\n\n[Projects Cited: ${a.keyProjectsCited.join(', ')}]`
              : ''
          }`,
      )
      .join('\n\n---\n\n');

    await navigator.clipboard.writeText(formatted);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2500);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 850,
          maxHeight: '90vh',
          backgroundColor: '#0f172a',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: 16,
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(180deg, rgba(99, 102, 241, 0.08) 0%, transparent 100%)',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 22 }}>💬</span>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#f8fafc' }}>
                AI Screening Q&amp;A Generator
              </h2>
              <span
                style={{
                  fontSize: 11,
                  padding: '2px 8px',
                  borderRadius: 12,
                  background: 'rgba(99, 102, 241, 0.2)',
                  color: '#a5b4fc',
                  border: '1px solid rgba(99, 102, 241, 0.4)',
                  fontWeight: 600,
                }}
              >
                Grounded in Real Projects
              </span>
            </div>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#94a3b8' }}>
              Targeting: <strong style={{ color: '#e2e8f0' }}>{jobTitle || 'Opportunity'}</strong> at{' '}
              <strong style={{ color: '#818cf8' }}>{company || 'Employer'}</strong>
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
        <div style={{ padding: 24, overflowY: 'auto', flex: 1 }}>
          {error && (
            <div
              style={{
                padding: '12px 16px',
                borderRadius: 8,
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#fca5a5',
                fontSize: 13,
                marginBottom: 16,
              }}
            >
              ⚠ {error}
            </div>
          )}

          {/* Quick Presets */}
          <div style={{ marginBottom: 20 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: '#94a3b8',
                textTransform: 'uppercase',
                letterSpacing: '.05em',
                marginBottom: 8,
              }}
            >
              Quick Presets (Click to Add)
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {PRESET_QUESTIONS.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleAddQuestion(preset)}
                  style={{
                    padding: '5px 10px',
                    borderRadius: 6,
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    color: '#cbd5e1',
                    fontSize: 11,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    textAlign: 'left',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.5)';
                    e.currentTarget.style.color = '#818cf8';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                    e.currentTarget.style.color = '#cbd5e1';
                  }}
                >
                  + {preset.length > 55 ? preset.slice(0, 55) + '…' : preset}
                </button>
              ))}
            </div>
          </div>

          {/* Questions Input List */}
          <div style={{ marginBottom: 24 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 10,
              }}
            >
              <label
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: '#cbd5e1',
                  textTransform: 'uppercase',
                  letterSpacing: '.05em',
                }}
              >
                Screening Questions ({questions.length})
              </label>
              <button
                type="button"
                onClick={() => handleAddQuestion('')}
                style={{
                  padding: '4px 10px',
                  borderRadius: 6,
                  background: 'rgba(99, 102, 241, 0.12)',
                  border: '1px solid rgba(99, 102, 241, 0.3)',
                  color: '#818cf8',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                + Add Another Question
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {questions.map((q, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 8,
                    background: 'rgba(0, 0, 0, 0.25)',
                    padding: 8,
                    borderRadius: 10,
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: '#64748b',
                      paddingTop: 6,
                      minWidth: 22,
                    }}
                  >
                    #{idx + 1}
                  </span>
                  <textarea
                    rows={2}
                    value={q}
                    onChange={(e) => handleUpdateQuestion(idx, e.target.value)}
                    placeholder="e.g. Why are you applying to Tamara's Builders Program? Or paste any question from the ATS..."
                    style={{
                      flex: 1,
                      backgroundColor: 'transparent',
                      border: 'none',
                      color: '#f1f5f9',
                      fontSize: 13,
                      lineHeight: 1.5,
                      resize: 'vertical',
                      outline: 'none',
                      fontFamily: 'inherit',
                    }}
                  />
                  {questions.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveQuestion(idx)}
                      title="Remove question"
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#64748b',
                        cursor: 'pointer',
                        fontSize: 16,
                        padding: '4px 8px',
                        lineHeight: 1,
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = '#64748b')}
                    >
                      &times;
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={handleGenerate}
                disabled={loading}
                style={{
                  padding: '10px 20px',
                  borderRadius: 10,
                  border: 'none',
                  background: loading
                    ? 'rgba(99, 102, 241, 0.4)'
                    : 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                  color: '#ffffff',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
                }}
              >
                {loading ? '⚡ Generating Grounded Answers…' : '⚡ Generate Grounded Answers'}
              </button>
            </div>
          </div>

          {/* Generated Answers Results */}
          {answers.length > 0 && (
            <div style={{ marginTop: 24, borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: 20 }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 16,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#34d399', textTransform: 'uppercase', letterSpacing: '.05em' }}>
                    ✓ Generated Answers ({answers.length})
                  </span>
                  <span
                    style={{
                      fontSize: 10,
                      padding: '2px 8px',
                      borderRadius: 10,
                      background: 'rgba(16, 185, 129, 0.15)',
                      color: '#34d399',
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                    }}
                  >
                    💾 Auto-saved to Apply Pack &amp; Answer Bank
                  </span>
                </div>
                <button
                  type="button"
                  onClick={copyAllToClipboard}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 8,
                    background: copiedAll ? 'rgba(16, 185, 129, 0.25)' : 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: copiedAll ? '#34d399' : '#cbd5e1',
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {copiedAll ? '✅ All Copied!' : '📋 Copy All Q&A'}
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {answers.map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: 12,
                      padding: 16,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        gap: 12,
                        marginBottom: 10,
                      }}
                    >
                      <h4
                        style={{
                          margin: 0,
                          fontSize: 13,
                          fontWeight: 700,
                          color: '#f8fafc',
                          lineHeight: 1.4,
                        }}
                      >
                        Q{idx + 1}: {item.question}
                      </h4>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(item.answer, idx)}
                        style={{
                          flexShrink: 0,
                          padding: '4px 10px',
                          borderRadius: 6,
                          background:
                            copiedIndex === idx
                              ? 'rgba(16, 185, 129, 0.25)'
                              : 'rgba(99, 102, 241, 0.15)',
                          border: `1px solid ${
                            copiedIndex === idx
                              ? 'rgba(16, 185, 129, 0.4)'
                              : 'rgba(99, 102, 241, 0.3)'
                          }`,
                          color: copiedIndex === idx ? '#34d399' : '#818cf8',
                          fontSize: 11,
                          fontWeight: 600,
                          cursor: 'pointer',
                          transition: 'all 0.15s',
                        }}
                      >
                        {copiedIndex === idx ? '✅ Copied' : '📋 Copy Answer'}
                      </button>
                    </div>

                    <div
                      style={{
                        padding: '12px 14px',
                        borderRadius: 8,
                        background: 'rgba(0, 0, 0, 0.35)',
                        border: '1px solid rgba(255, 255, 255, 0.04)',
                        color: '#cbd5e1',
                        fontSize: 13,
                        lineHeight: 1.6,
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      {item.answer}
                    </div>

                    {item.keyProjectsCited && item.keyProjectsCited.length > 0 && (
                      <div
                        style={{
                          marginTop: 10,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          flexWrap: 'wrap',
                        }}
                      >
                        <span style={{ fontSize: 10, color: '#64748b', fontWeight: 600 }}>
                          Verified Projects Cited:
                        </span>
                        {item.keyProjectsCited.map((proj, pIdx) => (
                          <span
                            key={pIdx}
                            style={{
                              padding: '2px 8px',
                              borderRadius: 4,
                              background: 'rgba(99, 102, 241, 0.12)',
                              color: '#a5b4fc',
                              fontSize: 10,
                              fontWeight: 600,
                              border: '1px solid rgba(99, 102, 241, 0.2)',
                            }}
                          >
                            🚀 {proj}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '14px 24px',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'rgba(0, 0, 0, 0.2)',
          }}
        >
          <span style={{ fontSize: 12, color: '#64748b' }}>
            Answers strictly cite real profile facts and verified client deliverables.
          </span>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: '#cbd5e1',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
