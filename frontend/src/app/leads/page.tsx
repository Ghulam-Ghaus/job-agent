'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Building2,
  Search,
  Sparkles,
  Mail,
  Send,
  CheckCircle2,
  AlertTriangle,
  Globe,
  Phone,
  MapPin,
  Clock,
  ShieldAlert,
  Plus,
  Trash2,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  X,
  Loader2,
  Calendar,
  Ban,
  Check,
} from 'lucide-react';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  api,
  type Company,
  type DiscoveredPlace,
  type QuotaInfo,
  type SuppressionEntry,
  type LeadStatus,
} from '@/lib/api-client';

// ─── Helpers & Score Ring ─────────────────────────────────────────────────────

function scoreColor(score?: number | null): string {
  if (!score) return '#94a3b8';
  if (score >= 75) return '#22c55e';
  if (score >= 50) return '#f59e0b';
  return '#ef4444';
}

function ScoreRing({ score, size = 48 }: { score?: number | null; size?: number }) {
  const s = score ?? 0;
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (s / 100) * circ;
  const color = scoreColor(score);

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="4" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="4"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset .6s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-xs font-bold leading-none" style={{ color }}>
          {score !== null && score !== undefined ? score : '—'}
        </span>
        <span className="text-[9px] text-muted-foreground leading-none mt-0.5">FIT</span>
      </div>
    </div>
  );
}

function statusBadgeVariant(status: LeadStatus): { label: string; bg: string; text: string; border: string } {
  switch (status) {
    case 'QUALIFIED':
      return { label: 'Qualified', bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20' };
    case 'DRAFT_READY':
      return { label: 'Draft Ready', bg: 'bg-indigo-500/10', text: 'text-indigo-400', border: 'border-indigo-500/20' };
    case 'CONTACTED':
      return { label: 'Contacted', bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20' };
    case 'MEETING':
      return { label: 'Meeting Set', bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/20' };
    case 'WON':
      return { label: 'Won Client', bg: 'bg-emerald-500/20', text: 'text-emerald-300', border: 'border-emerald-500/40' };
    case 'NOT_INTERESTED':
    case 'LOST':
      return { label: 'Declined', bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/20' };
    default:
      return { label: 'Researching', bg: 'bg-slate-500/10', text: 'text-slate-400', border: 'border-slate-500/20' };
  }
}

export default function LeadsPage() {
  const [leads, setLeads] = useState<Company[]>([]);
  const [quota, setQuota] = useState<QuotaInfo | null>(null);
  const [suppressions, setSuppressions] = useState<SuppressionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState<Company | null>(null);

  // Discovery State
  const [searchQuery, setSearchQuery] = useState('');
  const [locationBias, setLocationBias] = useState('');
  const [discovering, setDiscovering] = useState(false);
  const [discoveredPlaces, setDiscoveredPlaces] = useState<DiscoveredPlace[]>([]);
  const [importingPlaceId, setImportingPlaceId] = useState<string | null>(null);

  // Outreach & Actions State
  const [drafting, setDrafting] = useState(false);
  const [sending, setSending] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Modals & Drawers
  const [showDiscoveryModal, setShowDiscoveryModal] = useState(false);
  const [showSuppressionModal, setShowSuppressionModal] = useState(false);
  const [suppressionDomain, setSuppressionDomain] = useState('');
  const [suppressionReason, setSuppressionReason] = useState('competitor');
  const [savingSuppression, setSavingSuppression] = useState(false);

  // Filter tabs
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [clientSearch, setClientSearch] = useState('');

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [leadsRes, quotaRes, suppRes] = await Promise.all([
        api.leads.list(),
        api.leads.getQuota(),
        api.leads.getSuppressions(),
      ]);
      setLeads(leadsRes);
      setQuota(quotaRes);
      setSuppressions(suppRes);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load leads data';
      setActionError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle Google Places Discovery
  const handleDiscover = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setDiscovering(true);
    setActionError(null);
    try {
      const places = await api.leads.discover(searchQuery, locationBias || undefined);
      setDiscoveredPlaces(places);
      setShowDiscoveryModal(true);
      // Refresh quota
      const q = await api.leads.getQuota();
      setQuota(q);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Discovery search failed';
      setActionError(msg);
    } finally {
      setDiscovering(false);
    }
  };

  // Import and analyze signals for discovered place
  const handleImport = async (place: DiscoveredPlace) => {
    const idKey = place.placeId || place.name;
    setImportingPlaceId(idKey);
    setActionError(null);
    try {
      const imported = await api.leads.import(place);
      setLeads((prev) => [imported, ...prev.filter((l) => l.id !== imported.id)]);
      setSelectedLead(imported);
      setActionSuccess(`Imported & analyzed "${imported.name}" with ${imported.needSignalsJson.length} need-signals.`);
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to import place';
      setActionError(msg);
    } finally {
      setImportingPlaceId(null);
    }
  };

  // Draft outreach message
  const handleDraftOutreach = async (leadId: string) => {
    setDrafting(true);
    setActionError(null);
    try {
      const msg = await api.leads.draftOutreach(leadId);
      setLeads((prev) =>
        prev.map((l) => {
          if (l.id === leadId) {
            return {
              ...l,
              status: 'DRAFT_READY',
              outreachMessages: [msg, ...l.outreachMessages.filter((m) => m.id !== msg.id)],
            };
          }
          return l;
        })
      );
      if (selectedLead?.id === leadId) {
        setSelectedLead((prev) =>
          prev
            ? {
                ...prev,
                status: 'DRAFT_READY',
                outreachMessages: [msg, ...prev.outreachMessages.filter((m) => m.id !== msg.id)],
              }
            : null
        );
      }
      setActionSuccess('Outreach email drafted with verified website need signals.');
      setTimeout(() => setActionSuccess(null), 3000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to draft outreach';
      setActionError(msg);
    } finally {
      setDrafting(false);
    }
  };

  // Approve and send outreach message
  const handleApproveAndSend = async (outreachId: string) => {
    setSending(true);
    setActionError(null);
    try {
      const res = await api.leads.approveAndSend(outreachId);
      setActionSuccess(res.message);
      // Reload leads and selected lead
      await loadData();
      if (selectedLead) {
        const updated = await api.leads.get(selectedLead.id);
        setSelectedLead(updated);
      }
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to approve and send outreach';
      setActionError(msg);
    } finally {
      setSending(false);
    }
  };

  // Add domain to suppression list
  const handleAddSuppression = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!suppressionDomain.trim()) return;
    setSavingSuppression(true);
    setActionError(null);
    try {
      const entry = await api.leads.addSuppression({
        domain: suppressionDomain.trim().toLowerCase(),
        reason: suppressionReason,
      });
      setSuppressions((prev) => [entry, ...prev]);
      setSuppressionDomain('');
      setActionSuccess(`Domain ${entry.domain} suppressed.`);
      setTimeout(() => setActionSuccess(null), 3000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to add suppression';
      setActionError(msg);
    } finally {
      setSavingSuppression(false);
    }
  };

  // Remove suppression
  const handleRemoveSuppression = async (id: string) => {
    try {
      await api.leads.removeSuppression(id);
      setSuppressions((prev) => prev.filter((s) => s.id !== id));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to remove suppression';
      setActionError(msg);
    }
  };

  // Filtered Leads
  const filteredLeads = leads.filter((lead) => {
    const matchesStatus =
      statusFilter === 'ALL' ||
      (statusFilter === 'QUALIFIED' && lead.status === 'QUALIFIED') ||
      (statusFilter === 'DRAFT_READY' && lead.status === 'DRAFT_READY') ||
      (statusFilter === 'CONTACTED' && (lead.status === 'CONTACTED' || lead.status === 'REPLIED')) ||
      (statusFilter === 'MEETING' && (lead.status === 'MEETING' || lead.status === 'WON'));

    const matchesSearch =
      !clientSearch ||
      lead.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
      (lead.businessType && lead.businessType.toLowerCase().includes(clientSearch.toLowerCase())) ||
      (lead.city && lead.city.toLowerCase().includes(clientSearch.toLowerCase()));

    return matchesStatus && matchesSearch;
  });

  // Calculate outreach sent today
  const outreachTodayCount = leads.reduce((acc, lead) => {
    const sentToday = lead.outreachMessages.filter((m) => {
      if (m.status !== 'SENT' || !m.sentAt) return false;
      const today = new Date().toDateString();
      return new Date(m.sentAt).toDateString() === today;
    }).length;
    return acc + sentToday;
  }, 0);

  return (
    <div className="flex h-screen bg-background overflow-hidden text-foreground">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <Header
          title="Direct Clients & Need Signals"
          description="Identify target businesses, analyze verified website need-signals, and conduct consultative cold outreach."
          breadcrumbs={[
            { label: 'Home', href: '/' },
            { label: 'Direct Clients' },
          ]}
          backHref="/approvals"
          backLabel="Approvals"
          nextHref="/dashboard"
          nextLabel="Opportunities"
        />

        <main className="flex-1 p-6 max-w-7xl mx-auto w-full space-y-6">
          {/* Top Banner Alert / Feedback */}
          {actionSuccess && (
            <div className="flex items-center gap-2 p-3 text-xs rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{actionSuccess}</span>
            </div>
          )}
          {actionError && (
            <div className="flex items-center gap-2 p-3 text-xs rounded-xl bg-destructive/10 border border-destructive/20 text-destructive">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{actionError}</span>
            </div>
          )}

          {/* Metric KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Google Places Quota Card */}
            <div className="p-4 rounded-2xl bg-card/40 border border-border/50 backdrop-blur-sm relative overflow-hidden group">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider">
                  Places Quota Guard
                </span>
                <Globe className="h-4 w-4 text-indigo-400" />
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-2xl font-bold font-mono">
                  {quota?.callsThisMonth ?? 0}
                </span>
                <span className="text-xs text-muted-foreground">
                  / {quota?.monthlyLimit ?? 500} calls
                </span>
              </div>
              {/* Progress bar */}
              <div className="mt-2 h-1.5 w-full bg-accent/40 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(100, (((quota?.callsThisMonth ?? 0) / (quota?.monthlyLimit ?? 500)) * 100))}%`,
                  }}
                />
              </div>
              <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
                <span>Cost: ${(quota?.costThisMonthUsd ?? 0).toFixed(2)}</span>
                <span className="text-emerald-400">{quota?.remaining ?? 500} remaining</span>
              </div>
            </div>

            {/* Daily Send Cap Card */}
            <div className="p-4 rounded-2xl bg-card/40 border border-border/50 backdrop-blur-sm relative overflow-hidden group">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider">
                  Daily Send Cap
                </span>
                <Send className="h-4 w-4 text-emerald-400" />
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-2xl font-bold font-mono">
                  {outreachTodayCount}
                </span>
                <span className="text-xs text-muted-foreground">/ 15 dispatched</span>
              </div>
              <div className="mt-2 h-1.5 w-full bg-accent/40 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, (outreachTodayCount / 15) * 100)}%` }}
                />
              </div>
              <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
                <span>Anti-Spam Safety</span>
                <span className="text-emerald-400 font-medium">{Math.max(0, 15 - outreachTodayCount)} available</span>
              </div>
            </div>

            {/* Qualified Pipeline Card */}
            <div className="p-4 rounded-2xl bg-card/40 border border-border/50 backdrop-blur-sm relative overflow-hidden group">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider">
                  Active Pipeline
                </span>
                <TrendingUp className="h-4 w-4 text-purple-400" />
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-2xl font-bold font-mono">
                  {leads.length}
                </span>
                <span className="text-xs text-muted-foreground">client companies</span>
              </div>
              <div className="mt-2 flex items-center gap-1.5 text-[10px] text-muted-foreground flex-wrap">
                <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400">
                  {leads.filter((l) => l.status === 'QUALIFIED').length} qualified
                </span>
                <span className="px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400">
                  {leads.filter((l) => l.status === 'DRAFT_READY').length} drafts
                </span>
                <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400">
                  {leads.filter((l) => l.status === 'CONTACTED').length} sent
                </span>
              </div>
            </div>

            {/* Suppression & Opt-Outs Card */}
            <div className="p-4 rounded-2xl bg-card/40 border border-border/50 backdrop-blur-sm relative overflow-hidden group">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider">
                  Suppression List
                </span>
                <Ban className="h-4 w-4 text-amber-400" />
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-2xl font-bold font-mono">
                  {suppressions.length}
                </span>
                <span className="text-xs text-muted-foreground">suppressed domains</span>
              </div>
              <div className="mt-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowSuppressionModal(true)}
                  className="w-full text-xs h-7 gap-1.5 border-border/60 hover:bg-accent/40"
                >
                  <ShieldAlert className="h-3 w-3 text-amber-400" />
                  <span>Manage Suppressions</span>
                </Button>
              </div>
            </div>
          </div>

          {/* Discovery Search Form */}
          <div className="p-5 rounded-2xl bg-card/40 border border-border/50 backdrop-blur-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-indigo-400" />
                  <span>Google Places Business Discovery</span>
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Search local and specialized businesses to scrape, analyze need-signals, and draft consultative outreach.
                </p>
              </div>
              {quota && (
                <div className="text-right text-[11px] font-mono text-muted-foreground hidden sm:block">
                  FieldMask active: <span className="text-emerald-400">places.id, displayName, websiteUri</span>
                </div>
              )}
            </div>

            <form onSubmit={handleDiscover} className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="e.g. Dental clinics in Austin TX, Accounting firms in London, Logistics in Chicago..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-background/60 border border-border/60 rounded-xl text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div className="w-full sm:w-64">
                <input
                  type="text"
                  placeholder="Optional Location Bias (e.g. Austin, TX)"
                  value={locationBias}
                  onChange={(e) => setLocationBias(e.target.value)}
                  className="w-full px-3 py-2 bg-background/60 border border-border/60 rounded-xl text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <Button
                type="submit"
                disabled={discovering || !searchQuery.trim()}
                className="gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-medium text-xs h-9 px-5 rounded-xl shadow-md shadow-indigo-500/20"
              >
                {discovering ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Search className="h-3.5 w-3.5" />
                )}
                <span>{discovering ? 'Discovering...' : 'Discover Leads'}</span>
              </Button>
            </form>
          </div>

          {/* Discovery Results Modal / Box */}
          {showDiscoveryModal && discoveredPlaces.length > 0 && (
            <div className="p-5 rounded-2xl bg-indigo-950/20 border border-indigo-500/30 backdrop-blur-md space-y-4 animate-in fade-in duration-300">
              <div className="flex items-center justify-between border-b border-indigo-500/20 pb-3">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                    <Building2 className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-foreground">
                      Discovered {discoveredPlaces.length} Prospective Businesses
                    </h4>
                    <p className="text-[11px] text-muted-foreground">
                      Click &ldquo;Import &amp; Analyze Signals&rdquo; to scrape the website and extract verified tech needs.
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowDiscoveryModal(false)}
                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {discoveredPlaces.map((place, idx) => {
                  const placeKey = place.placeId || place.name || String(idx);
                  const isImporting = importingPlaceId === placeKey;
                  const alreadyImported = leads.some((l) => l.placeId === place.placeId || l.name === place.name);

                  return (
                    <div
                      key={placeKey}
                      className="p-3.5 rounded-xl bg-card/60 border border-border/50 hover:border-indigo-500/40 transition-all flex flex-col justify-between gap-3 text-xs"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <h5 className="font-semibold text-foreground truncate">{place.name}</h5>
                          {place.businessType && (
                            <Badge variant="secondary" className="text-[9px] px-1.5 py-0">
                              {place.businessType.replace(/_/g, ' ')}
                            </Badge>
                          )}
                        </div>
                        {place.address && (
                          <div className="flex items-center gap-1.5 text-muted-foreground text-[11px] truncate">
                            <MapPin className="h-3 w-3 shrink-0" />
                            <span className="truncate">{place.address}</span>
                          </div>
                        )}
                        {place.phone && (
                          <div className="flex items-center gap-1.5 text-muted-foreground text-[11px]">
                            <Phone className="h-3 w-3 shrink-0" />
                            <span>{place.phone}</span>
                          </div>
                        )}
                        {place.website && (
                          <div className="flex items-center gap-1.5 text-indigo-400 text-[11px] truncate">
                            <Globe className="h-3 w-3 shrink-0" />
                            <a
                              href={place.website}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="truncate hover:underline flex items-center gap-1"
                            >
                              <span>{place.website.replace(/^https?:\/\//, '')}</span>
                              <ExternalLink className="h-2.5 w-2.5 shrink-0" />
                            </a>
                          </div>
                        )}
                      </div>

                      <Button
                        size="sm"
                        disabled={isImporting || alreadyImported}
                        onClick={() => handleImport(place)}
                        className={`w-full text-xs h-8 gap-1.5 ${
                          alreadyImported
                            ? 'bg-accent/40 text-muted-foreground hover:bg-accent/40'
                            : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs'
                        }`}
                      >
                        {isImporting ? (
                          <>
                            <Loader2 className="h-3 w-3 animate-spin" />
                            <span>Analyzing Site Signals...</span>
                          </>
                        ) : alreadyImported ? (
                          <>
                            <Check className="h-3 w-3 text-emerald-400" />
                            <span>Already in Pipeline</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-3 w-3" />
                            <span>Import &amp; Analyze</span>
                          </>
                        )}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Pipeline Controls & Filters */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
            {/* Filter Tabs */}
            <div className="flex items-center gap-1.5 bg-accent/20 p-1 rounded-xl border border-border/40 w-full sm:w-auto overflow-x-auto">
              {[
                { id: 'ALL', label: 'All Leads' },
                { id: 'QUALIFIED', label: 'Qualified' },
                { id: 'DRAFT_READY', label: 'Draft Ready' },
                { id: 'CONTACTED', label: 'Contacted' },
                { id: 'MEETING', label: 'Meetings' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setStatusFilter(tab.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                    statusFilter === tab.id
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Quick Search in Pipeline */}
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Filter saved leads by name or type..."
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-background/50 border border-border/50 rounded-xl text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          {/* Leads Grid or Empty State */}
          {loading ? (
            <div className="p-16 flex flex-col items-center justify-center gap-3 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-xs">Loading client pipeline...</p>
            </div>
          ) : filteredLeads.length === 0 ? (
            <div className="p-16 rounded-2xl bg-card/20 border border-dashed border-border/60 text-center space-y-3">
              <Building2 className="h-10 w-10 text-muted-foreground/40 mx-auto" />
              <h4 className="text-sm font-semibold text-foreground">No leads found</h4>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Use the Google Places Discovery search bar above to discover businesses and extract actionable need-signals.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredLeads.map((lead) => {
                const badge = statusBadgeVariant(lead.status);
                const latestOutreach = lead.outreachMessages[0];

                return (
                  <div
                    key={lead.id}
                    onClick={() => setSelectedLead(lead)}
                    className="p-5 rounded-2xl bg-card/40 border border-border/50 hover:border-primary/40 backdrop-blur-sm transition-all cursor-pointer flex flex-col justify-between gap-4 group hover:shadow-lg hover:shadow-primary/5"
                  >
                    {/* Header */}
                    <div className="space-y-2.5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h4 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                            {lead.name}
                          </h4>
                          <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">
                            {lead.businessType && (
                              <span className="capitalize">{lead.businessType.replace(/_/g, ' ')}</span>
                            )}
                            {lead.city && <span>• {lead.city}</span>}
                          </div>
                        </div>

                        {/* Fit Score Ring */}
                        <ScoreRing score={lead.qualificationScore} size={42} />
                      </div>

                      {/* Status & Contacts summary */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${badge.bg} ${badge.text} ${badge.border}`}
                        >
                          {badge.label}
                        </span>

                        {latestOutreach && (
                          <span className="text-[10px] text-muted-foreground font-mono flex items-center gap-1">
                            <Mail className="h-3 w-3 text-indigo-400" />
                            <span>{latestOutreach.status}</span>
                          </span>
                        )}
                      </div>

                      {/* Verified Need Signals Pills */}
                      <div className="pt-2 border-t border-border/30 space-y-1.5">
                        <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider block">
                          Verified Signals ({lead.needSignalsJson.length})
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {lead.needSignalsJson.slice(0, 3).map((sig, i) => (
                            <div
                              key={i}
                              className={`text-[10px] px-2 py-0.5 rounded-md border flex items-center gap-1 ${
                                sig.severity === 'HIGH'
                                  ? 'bg-amber-500/10 border-amber-500/20 text-amber-400 font-medium'
                                  : 'bg-accent/40 border-border/40 text-muted-foreground'
                              }`}
                            >
                              <span className="truncate max-w-[150px]">{sig.signal}</span>
                            </div>
                          ))}
                          {lead.needSignalsJson.length > 3 && (
                            <span className="text-[10px] text-muted-foreground px-1.5 py-0.5">
                              +{lead.needSignalsJson.length - 3} more
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Bottom Metadata & CTA */}
                    <div className="pt-3 border-t border-border/30 flex items-center justify-between text-xs">
                      {lead.website ? (
                        <a
                          href={lead.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-[11px] text-indigo-400 hover:underline flex items-center gap-1 truncate max-w-[140px]"
                        >
                          <Globe className="h-3 w-3 shrink-0" />
                          <span className="truncate">{lead.website.replace(/^https?:\/\//, '')}</span>
                        </a>
                      ) : (
                        <span className="text-[11px] text-muted-foreground">No website</span>
                      )}

                      <div className="flex items-center gap-1 text-primary text-xs font-medium">
                        <span>Details</span>
                        <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Lead Detail & Outreach Drawer */}
          {selectedLead && (
            <div className="fixed inset-0 z-50 flex justify-end bg-background/70 backdrop-blur-sm animate-in fade-in duration-200">
              <div
                className="w-full max-w-2xl bg-card border-l border-border h-full flex flex-col shadow-2xl overflow-y-auto animate-in slide-in-from-right duration-300"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Drawer Header */}
                <div className="p-6 border-b border-border/50 sticky top-0 bg-card/95 backdrop-blur-md z-10 flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-semibold text-foreground">
                        {selectedLead.name}
                      </h3>
                      <ScoreRing score={selectedLead.qualificationScore} size={36} />
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      {selectedLead.businessType && (
                        <span className="capitalize">{selectedLead.businessType.replace(/_/g, ' ')}</span>
                      )}
                      {selectedLead.city && <span>• {selectedLead.city}, {selectedLead.country}</span>}
                      {selectedLead.website && (
                        <a
                          href={selectedLead.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-indigo-400 hover:underline flex items-center gap-1"
                        >
                          <Globe className="h-3 w-3" />
                          <span>Website</span>
                        </a>
                      )}
                    </div>
                  </div>

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setSelectedLead(null)}
                    className="h-8 w-8 text-muted-foreground hover:text-foreground rounded-lg"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                {/* Drawer Body */}
                <div className="p-6 space-y-6 flex-1">
                  {/* Verified Need Signals Section */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
                        <span>Verified Need Signals (Grounded in Website Content)</span>
                      </h4>
                      <Badge variant="outline" className="text-[10px]">
                        {selectedLead.needSignalsJson.length} signals
                      </Badge>
                    </div>

                    {selectedLead.needSignalsJson.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">No need signals detected.</p>
                    ) : (
                      <div className="space-y-2.5">
                        {selectedLead.needSignalsJson.map((sig, i) => (
                          <div
                            key={i}
                            className="p-3.5 rounded-xl bg-background/50 border border-border/40 space-y-2"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                                <span
                                  className={`h-2 w-2 rounded-full ${
                                    sig.severity === 'HIGH'
                                      ? 'bg-amber-400'
                                      : sig.severity === 'MED'
                                      ? 'bg-indigo-400'
                                      : 'bg-slate-400'
                                  }`}
                                />
                                {sig.signal}
                              </span>
                              <Badge
                                variant={sig.severity === 'HIGH' ? 'destructive' : 'secondary'}
                                className="text-[9px] uppercase"
                              >
                                {sig.severity}
                              </Badge>
                            </div>

                            {/* Evidence Quote from Website */}
                            {sig.evidence && (
                              <div className="p-2 rounded-lg bg-accent/30 border border-border/30 text-[11px] text-muted-foreground italic">
                                &ldquo;{sig.evidence}&rdquo;
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Outreach Section */}
                  <div className="space-y-3 pt-2 border-t border-border/40">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <Mail className="h-3.5 w-3.5 text-indigo-400" />
                        <span>Consultative Outreach Email</span>
                      </h4>

                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={drafting}
                          onClick={() => handleDraftOutreach(selectedLead.id)}
                          className="h-7 text-xs gap-1.5 border-border/60"
                        >
                          {drafting ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Sparkles className="h-3 w-3 text-indigo-400" />
                          )}
                          <span>{selectedLead.outreachMessages.length > 0 ? 'Regenerate Draft' : 'Draft Email'}</span>
                        </Button>
                      </div>
                    </div>

                    {selectedLead.outreachMessages.length === 0 ? (
                      <div className="p-6 rounded-xl bg-accent/20 border border-dashed border-border/50 text-center space-y-2">
                        <Mail className="h-6 w-6 text-muted-foreground/60 mx-auto" />
                        <p className="text-xs text-muted-foreground">
                          No outreach email drafted yet. Click &ldquo;Draft Email&rdquo; to generate a consultative proposition based on the verified need-signals above.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {selectedLead.outreachMessages.map((msg) => (
                          <div
                            key={msg.id}
                            className="p-4 rounded-xl bg-background/60 border border-border/50 space-y-3"
                          >
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-semibold text-foreground">
                                Subject: <span className="font-normal text-muted-foreground">{msg.subject}</span>
                              </span>
                              <Badge
                                variant={msg.status === 'SENT' ? 'default' : 'secondary'}
                                className="text-[10px]"
                              >
                                {msg.status}
                              </Badge>
                            </div>

                            <div className="p-3 rounded-lg bg-card/60 border border-border/30 text-xs font-mono leading-relaxed whitespace-pre-line text-foreground/90 max-h-64 overflow-y-auto">
                              {msg.body}
                            </div>

                            {/* Opt-out preview note */}
                            <div className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                              <ShieldAlert className="h-3 w-3 text-amber-400 shrink-0" />
                              <span>
                                Opt-out token generated: <code className="font-mono text-[9px]">{msg.optOutToken}</code>
                              </span>
                            </div>

                            {/* Approve & Send CTA */}
                            {msg.status !== 'SENT' && (
                              <div className="pt-2 flex items-center justify-between">
                                <span className="text-[11px] text-muted-foreground">
                                  Daily cap: {outreachTodayCount}/15 sent today
                                </span>
                                <Button
                                  size="sm"
                                  disabled={sending || outreachTodayCount >= 15}
                                  onClick={() => handleApproveAndSend(msg.id)}
                                  className="h-8 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs shadow-xs"
                                >
                                  {sending ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                  )}
                                  <span>Approve &amp; Send</span>
                                </Button>
                              </div>
                            )}

                            {msg.status === 'SENT' && msg.sentAt && (
                              <div className="text-[11px] text-emerald-400 flex items-center gap-1.5">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                <span>Sent on {new Date(msg.sentAt).toLocaleString()}</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Notes & Follow-up */}
                  <div className="space-y-3 pt-2 border-t border-border/40">
                    <h4 className="text-xs font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-indigo-400" />
                      <span>Pipeline Status &amp; Notes</span>
                    </h4>

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <label className="text-[11px] text-muted-foreground block mb-1">Status</label>
                        <select
                          value={selectedLead.status}
                          onChange={async (e) => {
                            const newStatus = e.target.value as LeadStatus;
                            await api.leads.update(selectedLead.id, { status: newStatus });
                            setSelectedLead((prev) => (prev ? { ...prev, status: newStatus } : null));
                            setLeads((prev) =>
                              prev.map((l) => (l.id === selectedLead.id ? { ...l, status: newStatus } : l))
                            );
                          }}
                          className="w-full p-2 bg-background/60 border border-border/60 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                        >
                          <option value="RESEARCHING">RESEARCHING</option>
                          <option value="QUALIFIED">QUALIFIED</option>
                          <option value="DRAFT_READY">DRAFT_READY</option>
                          <option value="CONTACTED">CONTACTED</option>
                          <option value="REPLIED">REPLIED</option>
                          <option value="MEETING">MEETING</option>
                          <option value="PROPOSAL_SENT">PROPOSAL_SENT</option>
                          <option value="WON">WON</option>
                          <option value="NOT_INTERESTED">NOT_INTERESTED</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[11px] text-muted-foreground block mb-1">Next Follow-Up</label>
                        <div className="flex items-center gap-1.5 p-2 bg-background/60 border border-border/60 rounded-xl text-xs text-muted-foreground">
                          <Calendar className="h-3.5 w-3.5" />
                          <span>
                            {selectedLead.nextFollowUpAt
                              ? new Date(selectedLead.nextFollowUpAt).toLocaleDateString()
                              : 'None scheduled'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] text-muted-foreground block mb-1">Internal Notes</label>
                      <textarea
                        defaultValue={selectedLead.notes || ''}
                        onBlur={async (e) => {
                          const val = e.target.value;
                          await api.leads.update(selectedLead.id, { notes: val });
                          setSelectedLead((prev) => (prev ? { ...prev, notes: val } : null));
                        }}
                        placeholder="Add private observations or call notes..."
                        rows={3}
                        className="w-full p-2.5 bg-background/60 border border-border/60 rounded-xl text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Suppression Management Modal */}
          {showSuppressionModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/70 backdrop-blur-sm animate-in fade-in duration-200">
              <div
                className="w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl p-6 space-y-5 animate-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between border-b border-border/40 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                      <Ban className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">Global Suppression List</h3>
                      <p className="text-xs text-muted-foreground">
                        Never contact these domains or emails. Checked before any outreach.
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowSuppressionModal(false)}
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                {/* Add Suppression Form */}
                <form onSubmit={handleAddSuppression} className="space-y-3">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="e.g. competitor.com or ceo@client.com"
                      value={suppressionDomain}
                      onChange={(e) => setSuppressionDomain(e.target.value)}
                      className="flex-1 px-3 py-2 bg-background/60 border border-border/60 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <select
                      value={suppressionReason}
                      onChange={(e) => setSuppressionReason(e.target.value)}
                      className="px-3 py-2 bg-background/60 border border-border/60 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="competitor">Competitor</option>
                      <option value="opt_out">Opted Out</option>
                      <option value="bounced">Bounced</option>
                      <option value="manual">Manual Filter</option>
                    </select>
                    <Button
                      type="submit"
                      disabled={savingSuppression || !suppressionDomain.trim()}
                      className="text-xs h-9 px-4 rounded-xl gap-1.5"
                    >
                      {savingSuppression ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                      <span>Add</span>
                    </Button>
                  </div>
                </form>

                {/* Suppressed List */}
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {suppressions.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-6">No suppressed domains or emails.</p>
                  ) : (
                    suppressions.map((entry) => (
                      <div
                        key={entry.id}
                        className="p-2.5 rounded-xl bg-background/50 border border-border/40 flex items-center justify-between text-xs"
                      >
                        <div className="space-y-0.5">
                          <span className="font-mono text-xs font-semibold text-foreground">
                            {entry.domain || entry.email}
                          </span>
                          <div className="text-[10px] text-muted-foreground flex items-center gap-2">
                            <span className="capitalize">{entry.reason.replace(/_/g, ' ')}</span>
                            <span>• {new Date(entry.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>

                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveSuppression(entry.id)}
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          title="Remove from suppression list"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>

                <div className="pt-2 border-t border-border/40 text-right">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowSuppressionModal(false)}
                    className="text-xs h-8"
                  >
                    Done
                  </Button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
