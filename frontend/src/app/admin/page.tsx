'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  Users,
  Cpu,
  Layers,
  FileText,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  ExternalLink,
  Shield,
  Key,
  X,
  Activity,
  DollarSign,
} from 'lucide-react';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  api,
  type AdminUser,
  type LlmMetrics,
  type AuditLogEntry,
  type SourcesStatus,
} from '@/lib/api-client';

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<'users' | 'llm' | 'sources' | 'audit'>('users');
  const [loading, setLoading] = useState(true);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Data states
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [llmMetrics, setLlmMetrics] = useState<LlmMetrics | null>(null);
  const [sources, setSources] = useState<SourcesStatus | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);

  // 2FA modal state
  const [show2FaModal, setShow2FaModal] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [secretKey, setSecretKey] = useState<string | null>(null);
  const [twoFaCode, setTwoFaCode] = useState('');
  const [twoFaLoading, setTwoFaLoading] = useState(false);

  const loadAdminData = useCallback(async () => {
    try {
      setLoading(true);
      const [u, l, s, a] = await Promise.all([
        api.admin.getUsers().catch(() => []),
        api.admin.getLlmMetrics().catch(() => null),
        api.admin.getSources().catch(() => null),
        api.admin.getAuditLogs().catch(() => []),
      ]);
      setUsers(u);
      setLlmMetrics(l);
      setSources(s);
      setAuditLogs(a);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAdminData();
  }, [loadAdminData]);

  const showFeedback = (text: string, type: 'success' | 'error' = 'success') => {
    setFeedbackMsg({ text, type });
    setTimeout(() => setFeedbackMsg(null), 4000);
  };

  const handleToggleUserStatus = async (user: AdminUser) => {
    try {
      const updated = await api.admin.updateUser(user.id, { isActive: !user.isActive });
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, isActive: updated.isActive } : u)));
      showFeedback(`User ${user.email} ${updated.isActive ? 'activated' : 'deactivated'}.`);
    } catch {
      showFeedback('Failed to update user status.', 'error');
    }
  };

  const handleChangeRole = async (user: AdminUser, newRole: 'SUPER_ADMIN' | 'USER') => {
    try {
      const updated = await api.admin.updateUser(user.id, { role: newRole });
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, role: updated.role } : u)));
      showFeedback(`User role changed to ${newRole}.`);
    } catch {
      showFeedback('Failed to update role.', 'error');
    }
  };

  const handleStart2Fa = async () => {
    setTwoFaLoading(true);
    try {
      const res = await api.auth.generate2Fa();
      setQrCodeUrl(res.qrCodeDataUrl);
      setSecretKey(res.secret);
      setShow2FaModal(true);
    } catch {
      showFeedback('Could not generate 2FA key.', 'error');
    } finally {
      setTwoFaLoading(false);
    }
  };

  const handleEnable2Fa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!twoFaCode.trim()) return;
    setTwoFaLoading(true);
    try {
      await api.auth.enable2Fa(twoFaCode);
      showFeedback('Two-factor authentication enabled successfully!');
      setShow2FaModal(false);
      setTwoFaCode('');
      loadAdminData();
    } catch {
      showFeedback('Invalid authentication code. Please check your app.', 'error');
    } finally {
      setTwoFaLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden text-foreground">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <Header
          title="Super Admin Console"
          description="Manage users, audit system logs, monitor AI token consumption, and inspect data ingestion connectors."
          breadcrumbs={[
            { label: 'Home', href: '/' },
            { label: 'Admin Console' },
          ]}
          backHref="/dashboard"
          backLabel="Opportunities"
        />

        <main className="flex-1 p-6 max-w-7xl mx-auto w-full space-y-6">
          {/* Top Feedback Banner */}
          {feedbackMsg && (
            <div
              className={`p-3 text-xs rounded-xl border flex items-center gap-2 ${
                feedbackMsg.type === 'success'
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                  : 'bg-destructive/10 border-destructive/20 text-destructive'
              }`}
            >
              {feedbackMsg.type === 'success' ? (
                <CheckCircle2 className="h-4 w-4 shrink-0" />
              ) : (
                <AlertTriangle className="h-4 w-4 shrink-0" />
              )}
              <span>{feedbackMsg.text}</span>
            </div>
          )}

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-card/40 border border-border/50 backdrop-blur-sm space-y-2">
              <div className="flex items-center justify-between text-muted-foreground text-xs">
                <span>Active Users</span>
                <Users className="h-4 w-4 text-indigo-400" />
              </div>
              <div className="text-2xl font-bold font-mono">{users.length}</div>
              <div className="text-[11px] text-muted-foreground">
                {users.filter((u) => u.role === 'SUPER_ADMIN').length} Super Admins
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-card/40 border border-border/50 backdrop-blur-sm space-y-2">
              <div className="flex items-center justify-between text-muted-foreground text-xs">
                <span>Total LLM Calls</span>
                <Cpu className="h-4 w-4 text-purple-400" />
              </div>
              <div className="text-2xl font-bold font-mono">
                {llmMetrics?.summary.totalCalls ?? 0}
              </div>
              <div className="text-[11px] text-muted-foreground">
                {llmMetrics?.summary.cacheHitRate ?? 0}% Cache Hit Rate
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-card/40 border border-border/50 backdrop-blur-sm space-y-2">
              <div className="flex items-center justify-between text-muted-foreground text-xs">
                <span>LLM Cost Accrued</span>
                <DollarSign className="h-4 w-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-bold font-mono">
                ${(llmMetrics?.summary.totalCostUsd ?? 0).toFixed(4)}
              </div>
              <div className="text-[11px] text-muted-foreground">
                Avg Latency: {llmMetrics?.summary.avgLatencyMs ?? 0}ms
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-card/40 border border-border/50 backdrop-blur-sm space-y-2">
              <div className="flex items-center justify-between text-muted-foreground text-xs">
                <span>Security &amp; 2FA</span>
                <ShieldCheck className="h-4 w-4 text-amber-400" />
              </div>
              <div className="text-sm font-semibold text-foreground pt-1">
                TOTP Authenticator
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleStart2Fa}
                disabled={twoFaLoading}
                className="w-full text-xs h-7 gap-1 border-border/60 hover:bg-accent/40"
              >
                <Key className="h-3 w-3 text-amber-400" />
                <span>Configure 2FA</span>
              </Button>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex items-center justify-between border-b border-border/40 pb-3 flex-wrap gap-3">
            <div className="flex items-center gap-2 bg-accent/20 p-1 rounded-xl border border-border/40 overflow-x-auto">
              {[
                { id: 'users', label: 'Users & Permissions', icon: Users },
                { id: 'llm', label: 'LLM Metrics & Cost', icon: Cpu },
                { id: 'sources', label: 'Ingestion Sources', icon: Layers },
                { id: 'audit', label: 'Audit Trail', icon: FileText },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as typeof activeTab)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    activeTab === tab.id
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <tab.icon className="h-3.5 w-3.5" />
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <a
                href="http://localhost:4000/admin/queues"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-8 gap-1.5 border-border/60 hover:bg-accent/40"
                >
                  <Activity className="h-3.5 w-3.5 text-indigo-400" />
                  <span>BullMQ Live Queues</span>
                  <ExternalLink className="h-2.5 w-2.5" />
                </Button>
              </a>

              <Button
                variant="outline"
                size="sm"
                onClick={loadAdminData}
                disabled={loading}
                className="text-xs h-8 gap-1 border-border/60"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </Button>
            </div>
          </div>

          {/* Tab 1: Users */}
          {activeTab === 'users' && (
            <div className="p-5 rounded-2xl bg-card/40 border border-border/50 backdrop-blur-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Registered Users</h3>
                  <p className="text-xs text-muted-foreground">
                    Control roles, view account activity, and manage platform permissions.
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="border-b border-border/40 text-muted-foreground uppercase text-[10px] font-mono">
                    <tr>
                      <th className="py-2.5 px-3">User</th>
                      <th className="py-2.5 px-3">Role</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">2FA</th>
                      <th className="py-2.5 px-3">Public Slug</th>
                      <th className="py-2.5 px-3 text-center">Pipeline Stats</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {users.map((u) => (
                      <tr key={u.id} className="hover:bg-accent/20 transition-colors">
                        <td className="py-3 px-3">
                          <div className="font-semibold text-foreground">{u.email}</div>
                          <div className="text-[10px] text-muted-foreground">{u.fullName || 'No name'}</div>
                        </td>
                        <td className="py-3 px-3">
                          <Badge
                            variant={u.role === 'SUPER_ADMIN' ? 'default' : 'secondary'}
                            className="text-[10px]"
                          >
                            {u.role}
                          </Badge>
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                              u.isActive
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                : 'bg-red-500/10 text-red-400 border-red-500/20'
                            }`}
                          >
                            {u.isActive ? 'Active' : 'Disabled'}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-mono text-[10px]">
                          {u.twoFactorEnabled ? (
                            <span className="text-emerald-400">Enabled</span>
                          ) : (
                            <span className="text-muted-foreground">Disabled</span>
                          )}
                        </td>
                        <td className="py-3 px-3 font-mono text-[11px] text-indigo-400">
                          {u.slug ? (
                            <Link href={`/u/${u.slug}`} className="hover:underline flex items-center gap-1">
                              <span>/u/{u.slug}</span>
                              <ExternalLink className="h-2.5 w-2.5" />
                            </Link>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <div className="inline-flex gap-2 text-[10px] font-mono text-muted-foreground">
                            <span>{u.stats.opportunities} jobs</span>
                            <span>•</span>
                            <span>{u.stats.applyPacks} packs</span>
                            <span>•</span>
                            <span>{u.stats.leads} leads</span>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleChangeRole(u, u.role === 'SUPER_ADMIN' ? 'USER' : 'SUPER_ADMIN')}
                              className="text-[10px] h-6 px-2 border-border/60"
                            >
                              Toggle Role
                            </Button>
                            <Button
                              variant={u.isActive ? 'destructive' : 'default'}
                              size="sm"
                              onClick={() => handleToggleUserStatus(u)}
                              className="text-[10px] h-6 px-2"
                            >
                              {u.isActive ? 'Deactivate' : 'Activate'}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Tab 2: LLM Metrics */}
          {activeTab === 'llm' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-5 rounded-2xl bg-card/40 border border-border/50 backdrop-blur-sm space-y-3">
                  <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider font-mono">
                    Provider Distribution
                  </h4>
                  <div className="space-y-2">
                    {llmMetrics?.providers.map((p) => (
                      <div key={p.provider} className="flex items-center justify-between text-xs">
                        <span className="font-mono text-indigo-400">{p.provider}</span>
                        <span className="font-bold">{p.count} calls</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-5 rounded-2xl bg-card/40 border border-border/50 backdrop-blur-sm space-y-3">
                  <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider font-mono">
                    Model Breakdown
                  </h4>
                  <div className="space-y-2">
                    {llmMetrics?.models.map((m) => (
                      <div key={m.model} className="flex items-center justify-between text-xs">
                        <span className="font-mono text-purple-400 truncate max-w-[180px]">{m.model}</span>
                        <span className="font-bold">{m.count}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-5 rounded-2xl bg-card/40 border border-border/50 backdrop-blur-sm space-y-3">
                  <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider font-mono">
                    Token Economics
                  </h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Tokens In:</span>
                      <span className="font-mono">{(llmMetrics?.summary.totalTokensIn ?? 0).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Tokens Out:</span>
                      <span className="font-mono">{(llmMetrics?.summary.totalTokensOut ?? 0).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between font-bold text-emerald-400 pt-1 border-t border-border/30">
                      <span>Total Cost:</span>
                      <span className="font-mono">${(llmMetrics?.summary.totalCostUsd ?? 0).toFixed(4)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Recent LLM Calls Log */}
              <div className="p-5 rounded-2xl bg-card/40 border border-border/50 backdrop-blur-sm space-y-3">
                <h4 className="text-xs font-semibold text-foreground">Recent LLM Call Audit Trail</h4>
                <div className="overflow-x-auto max-h-96">
                  <table className="w-full text-xs text-left">
                    <thead className="border-b border-border/40 text-muted-foreground uppercase text-[10px] font-mono">
                      <tr>
                        <th className="py-2 px-3">Time</th>
                        <th className="py-2 px-3">Provider / Model</th>
                        <th className="py-2 px-3">Purpose</th>
                        <th className="py-2 px-3">Tokens (In / Out)</th>
                        <th className="py-2 px-3">Cost</th>
                        <th className="py-2 px-3">Cached</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30 font-mono text-[11px]">
                      {llmMetrics?.recentCalls.map((c) => (
                        <tr key={c.id} className="hover:bg-accent/20">
                          <td className="py-2 px-3 text-muted-foreground">{new Date(c.createdAt).toLocaleTimeString()}</td>
                          <td className="py-2 px-3 text-foreground font-semibold">{c.model}</td>
                          <td className="py-2 px-3 text-indigo-400">{c.purpose || 'inference'}</td>
                          <td className="py-2 px-3 text-muted-foreground">
                            {c.tokensIn ?? 0} / {c.tokensOut ?? 0}
                          </td>
                          <td className="py-2 px-3 text-emerald-400">${(c.costUsd ?? 0).toFixed(5)}</td>
                          <td className="py-2 px-3">
                            {c.cached ? (
                              <span className="text-emerald-400">HIT</span>
                            ) : (
                              <span className="text-muted-foreground">MISS</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Tab 3: Ingestion Sources */}
          {activeTab === 'sources' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {sources?.sources.map((src) => (
                  <div
                    key={src.id}
                    className="p-5 rounded-2xl bg-card/40 border border-border/50 backdrop-blur-sm space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-semibold text-sm text-foreground">{src.name}</h4>
                        <span className="text-[10px] font-mono text-muted-foreground uppercase">{src.type}</span>
                      </div>
                      <Badge
                        variant={src.status === 'HEALTHY' ? 'default' : 'secondary'}
                        className="text-[10px]"
                      >
                        {src.status}
                      </Badge>
                    </div>

                    <p className="text-xs text-muted-foreground">{src.details}</p>

                    <div className="pt-2 border-t border-border/30 flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Items Ingested / Tracked</span>
                      <span className="font-mono font-bold text-foreground">
                        {Object.values(src.metrics)[0] ?? 0}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tab 4: Audit Trail */}
          {activeTab === 'audit' && (
            <div className="p-5 rounded-2xl bg-card/40 border border-border/50 backdrop-blur-sm space-y-3">
              <h4 className="text-sm font-semibold text-foreground">Security &amp; Action Audit Trail</h4>
              <div className="overflow-x-auto max-h-[500px]">
                <table className="w-full text-xs text-left">
                  <thead className="border-b border-border/40 text-muted-foreground uppercase text-[10px] font-mono">
                    <tr>
                      <th className="py-2.5 px-3">Timestamp</th>
                      <th className="py-2.5 px-3">Action</th>
                      <th className="py-2.5 px-3">User</th>
                      <th className="py-2.5 px-3">Entity</th>
                      <th className="py-2.5 px-3">IP Address</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30 text-xs">
                    {auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-accent/20">
                        <td className="py-2.5 px-3 text-muted-foreground font-mono text-[11px]">
                          {new Date(log.createdAt).toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="font-mono text-[10px] font-semibold px-2 py-0.5 rounded bg-accent/40 text-foreground">
                            {log.action}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-indigo-400">
                          {log.user?.email || 'System'}
                        </td>
                        <td className="py-2.5 px-3 text-muted-foreground">
                          {log.entity ? `${log.entity} (${log.entityId?.slice(0, 8)}...)` : '—'}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-muted-foreground">
                          {log.ipAddress || '127.0.0.1'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 2FA Setup Modal */}
          {show2FaModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/70 backdrop-blur-sm animate-in fade-in duration-200">
              <div
                className="w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl p-6 space-y-5 animate-in zoom-in-95 duration-200 text-foreground"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between border-b border-border/40 pb-3">
                  <div className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-indigo-400" />
                    <h3 className="text-sm font-semibold text-foreground">Configure Authenticator 2FA</h3>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShow2FaModal(false)}
                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                <div className="space-y-4 text-xs">
                  <p className="text-muted-foreground">
                    Scan the QR code below using Google Authenticator, Authy, or 1Password:
                  </p>

                  {qrCodeUrl && (
                    <div className="flex justify-center p-4 bg-white rounded-2xl">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={qrCodeUrl} alt="2FA QR Code" className="h-44 w-44" />
                    </div>
                  )}

                  {secretKey && (
                    <div className="p-2.5 rounded-xl bg-accent/40 border border-border/40 text-center font-mono text-[11px]">
                      Secret Key: <span className="font-bold text-indigo-400 select-all">{secretKey}</span>
                    </div>
                  )}

                  <form onSubmit={handleEnable2Fa} className="space-y-3 pt-2">
                    <div>
                      <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                        Enter 6-Digit Authenticator Code
                      </label>
                      <input
                        type="text"
                        required
                        maxLength={6}
                        placeholder="123456"
                        value={twoFaCode}
                        onChange={(e) => setTwoFaCode(e.target.value)}
                        className="w-full text-center tracking-widest font-mono text-lg py-2 bg-background border border-border rounded-xl focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>

                    <Button
                      type="submit"
                      disabled={twoFaLoading || twoFaCode.length < 6}
                      className="w-full text-xs h-9 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl gap-1.5"
                    >
                      {twoFaLoading ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      )}
                      <span>Verify &amp; Activate 2FA</span>
                    </Button>
                  </form>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
