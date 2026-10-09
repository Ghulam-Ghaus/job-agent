'use client';

import { useState } from 'react';
import { api, type ApplyPack, type ApprovalRecord } from '@/lib/api-client';

interface DirectEmailModalProps {
  pack: ApplyPack;
  onClose: () => void;
  onSent: (record: ApprovalRecord) => void;
}

export function DirectEmailModal({ pack, onClose, onSent }: DirectEmailModalProps) {
  const opp = pack.opportunity;
  const company = opp?.company || 'Company';
  const roleTitle = opp?.title || 'Engineer';

  const initialBody = pack.coverNoteEdited || pack.coverNote || '';
  const initialSubject = `Application: ${roleTitle} - Ghulam Ghaus`;

  const [recipientEmail, setRecipientEmail] = useState('');
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState(initialBody);
  const [attachCv, setAttachCv] = useState(true);
  const [files, setFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selected = Array.from(e.target.files);
      setFiles((prev) => [...prev, ...selected]);
    }
  };

  const handleRemoveFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // 1. Direct Send via Resend
  const handleSend = async () => {
    if (!recipientEmail.trim()) {
      setError('Please provide a recipient email address (e.g. recruiter@company.com).');
      return;
    }
    if (!subject.trim()) {
      setError('Please provide an email subject line.');
      return;
    }
    if (!body.trim()) {
      setError('Email body cannot be empty.');
      return;
    }

    try {
      setSending(true);
      setError(null);

      const formData = new FormData();
      formData.append('recipientEmail', recipientEmail.trim());
      formData.append('subject', subject.trim());
      formData.append('body', body);
      formData.append('attachTailoredCv', String(attachCv));

      // Append uploaded documents
      for (const f of files) {
        formData.append('files', f);
      }

      const res = await api.approvals.sendEmail(pack.id, formData);
      setSuccessMsg(`Email successfully dispatched via Resend! (ID: ${res.emailId || 'sent'})`);
      setTimeout(() => {
        onSent(res.approvalRecord);
      }, 1500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to send email via Resend.');
    } finally {
      setSending(false);
    }
  };

  // 2. Open in Gmail Web compose (Fallback)
  const handleOpenGmail = async () => {
    if (attachCv && opp?.id) {
      try {
        const cv = await api.tailoredCv.generate({ opportunityId: opp.id });
        await api.tailoredCv.downloadPdf(cv.id);
      } catch {
        // Continue opening gmail anyway
      }
    }

    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(
      recipientEmail.trim(),
    )}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(gmailUrl, '_blank', 'noreferrer');

    // Register approval record in background
    try {
      const record = await api.approvals.decide(
        pack.id,
        'approved',
        `Dispatched via Gmail Web compose to ${recipientEmail || 'recruiter'}`,
      );
      onSent(record);
    } catch {
      // Ignored if already handled
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1150,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.78)',
        backdropFilter: 'blur(6px)',
        padding: 16,
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 720,
          maxHeight: '92vh',
          background: '#0b1120',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: 16,
          boxShadow: '0 24px 60px rgba(0,0,0,0.8)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(255, 255, 255, 0.02)',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 18 }}>✉️</span>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#f1f5f9' }}>
                Review &amp; Direct Email Recruiter
              </h2>
            </div>
            <p style={{ margin: '3px 0 0', fontSize: 12, color: '#94a3b8' }}>
              Sending for <strong>{roleTitle}</strong> at <strong>{company}</strong>
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              fontSize: 18,
              cursor: 'pointer',
              padding: '4px 8px',
            }}
          >
            ✕
          </button>
        </div>

        {/* Sender Info Badge */}
        <div
          style={{
            padding: '10px 24px',
            background: 'rgba(99, 102, 241, 0.08)',
            borderBottom: '1px solid rgba(99, 102, 241, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 12,
            color: '#cbd5e1',
            flexWrap: 'wrap',
            gap: 8,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: '#10b981', fontWeight: 700 }}>✓ From Domain:</span>
            <span style={{ color: '#a5b4fc', fontWeight: 600 }}>ghulam@ggitsols.com</span>
            <span style={{ color: '#64748b' }}>·</span>
            <span style={{ color: '#94a3b8' }}>Replies route directly to your personal Gmail</span>
          </div>
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: '#34d399',
              background: 'rgba(16, 185, 129, 0.15)',
              padding: '2px 8px',
              borderRadius: 6,
              border: '1px solid rgba(16, 185, 129, 0.3)',
            }}
          >
            Resend Verified
          </span>
        </div>

        {/* Body content */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {error && (
            <div
              style={{
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#f87171',
                padding: '10px 14px',
                borderRadius: 8,
                fontSize: 12,
              }}
            >
              ⚠️ {error}
            </div>
          )}

          {successMsg && (
            <div
              style={{
                background: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                color: '#34d399',
                padding: '10px 14px',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              🎉 {successMsg}
            </div>
          )}

          {/* Recipient Email */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#cbd5e1' }}>
              Recipient Email <span style={{ color: '#f87171' }}>*</span>
            </label>
            <input
              type="email"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              placeholder="e.g. recruiter@company.com or careers@company.com"
              style={{
                background: 'rgba(15, 23, 42, 0.7)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: 8,
                padding: '9px 12px',
                color: '#f1f5f9',
                fontSize: 13,
                fontFamily: 'inherit',
              }}
            />
          </div>

          {/* Subject Line */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#cbd5e1' }}>
              Subject Line <span style={{ color: '#f87171' }}>*</span>
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              style={{
                background: 'rgba(15, 23, 42, 0.7)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: 8,
                padding: '9px 12px',
                color: '#f1f5f9',
                fontSize: 13,
                fontFamily: 'inherit',
              }}
            />
          </div>

          {/* Message Body */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#cbd5e1' }}>
                Application Pitch &amp; Cover Note
              </label>
              <span style={{ fontSize: 11, color: '#64748b' }}>
                {body.split(/\s+/).filter(Boolean).length} words · {body.length} chars
              </span>
            </div>
            <textarea
              rows={9}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              style={{
                background: 'rgba(15, 23, 42, 0.7)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: 10,
                padding: '12px 14px',
                color: '#f1f5f9',
                fontSize: 13,
                lineHeight: 1.6,
                fontFamily: 'inherit',
                resize: 'vertical',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Attachments Section */}
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              borderRadius: 12,
              padding: '14px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 700, color: '#f1f5f9' }}>
              📎 Email Attachments
            </div>

            {/* Attach Tailored CV Checkbox */}
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 13,
                color: '#cbd5e1',
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={attachCv}
                onChange={(e) => setAttachCv(e.target.checked)}
                style={{ width: 16, height: 16, accentColor: '#6366f1' }}
              />
              <span>
                <strong>Attach Tailored CV (PDF)</strong>{' '}
                <span style={{ fontSize: 11, color: '#94a3b8' }}>
                  (Auto-compiled &amp; tailored for {roleTitle})
                </span>
              </span>
            </label>

            {/* Custom File Upload */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <label
                style={{
                  padding: '7px 14px',
                  borderRadius: 8,
                  border: '1px dashed rgba(99, 102, 241, 0.5)',
                  background: 'rgba(99, 102, 241, 0.1)',
                  color: '#a5b4fc',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <span>＋ Upload Additional Document</span>
                <input
                  type="file"
                  multiple
                  accept=".pdf,.docx,.doc"
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                />
              </label>
              <span style={{ fontSize: 11, color: '#64748b' }}>
                Accepts PDF or DOCX (Certificates, portfolio, recommendations)
              </span>
            </div>

            {/* Uploaded Files Chips */}
            {files.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                {files.map((file, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: 'rgba(15, 23, 42, 0.8)',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      padding: '4px 10px',
                      borderRadius: 6,
                      fontSize: 12,
                      color: '#f1f5f9',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <span>📄 {file.name}</span>
                    <span style={{ fontSize: 10, color: '#94a3b8' }}>({formatFileSize(file.size)})</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveFile(idx)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#f87171',
                        cursor: 'pointer',
                        fontWeight: 700,
                        padding: '0 2px',
                      }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer actions */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'rgba(255, 255, 255, 0.01)',
            flexWrap: 'wrap',
            gap: 10,
          }}
        >
          <button
            type="button"
            onClick={handleOpenGmail}
            style={{
              padding: '10px 16px',
              borderRadius: 8,
              border: '1px solid rgba(255, 255, 255, 0.15)',
              background: 'transparent',
              color: '#cbd5e1',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            ✉️ Open in Gmail Web
          </button>

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              onClick={onClose}
              disabled={sending}
              style={{
                padding: '10px 16px',
                borderRadius: 8,
                border: '1px solid rgba(255, 255, 255, 0.1)',
                background: 'transparent',
                color: '#94a3b8',
                fontSize: 12,
                fontWeight: 600,
                cursor: sending ? 'not-allowed' : 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSend}
              disabled={sending}
              style={{
                padding: '10px 22px',
                borderRadius: 8,
                border: 'none',
                background: sending
                  ? '#475569'
                  : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                color: '#fff',
                fontSize: 13,
                fontWeight: 700,
                cursor: sending ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 14px rgba(99, 102, 241, 0.35)',
              }}
            >
              {sending ? '⏳ Sending via Resend…' : '🚀 Send to Recruiter (Resend)'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
