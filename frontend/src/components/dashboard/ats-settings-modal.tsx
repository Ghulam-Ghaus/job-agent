'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Plus,
  Trash2,
  Globe,
  Building2,
  Sliders,
  Check,
  RefreshCw,
  Loader2,
  Sparkles,
  Search,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api, type AtsTarget, type AtsDetectionResult } from '@/lib/api-client';

const DEFAULT_TARGETS: AtsTarget[] = [
  { platform: 'greenhouse', slug: 'careem' },
  { platform: 'greenhouse', slug: 'noon' },
  { platform: 'greenhouse', slug: 'tabby' },
  { platform: 'greenhouse', slug: 'tamara' },
  { platform: 'lever', slug: 'jahez' },
  { platform: 'lever', slug: 'hungerstation' },
];

const PRESET_LOCATIONS = [
  'Saudi Arabia',
  'Riyadh',
  'UAE',
  'Dubai',
  'Remote',
  'Europe',
  'Qatar',
];

interface AtsSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSyncTriggered?: () => void;
}

export function AtsSettingsModal({
  isOpen,
  onClose,
  onSyncTriggered,
}: AtsSettingsModalProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncingNow, setSyncingNow] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [targets, setTargets] = useState<AtsTarget[]>(DEFAULT_TARGETS);
  const [newPlatform, setNewPlatform] = useState<'greenhouse' | 'lever' | 'ashby' | 'workable'>('greenhouse');
  const [newSlug, setNewSlug] = useState('');

  // ATS Detector state
  const [detectorUrl, setDetectorUrl] = useState('');
  const [detecting, setDetecting] = useState(false);
  const [detectionResult, setDetectionResult] = useState<AtsDetectionResult | null>(null);
  const [detectorError, setDetectorError] = useState<string | null>(null);

  const [locations, setLocations] = useState<string[]>(['Saudi Arabia', 'UAE', 'Remote']);
  const [newLocation, setNewLocation] = useState('');

  const [cvStyle, setCvStyle] = useState<'AUTO' | 'GULF' | 'EUROPE'>('AUTO');

  useEffect(() => {
    if (!isOpen) return;
    async function loadPrefs() {
      try {
        setLoading(true);
        const prefs = await api.preferences.get();
        if (prefs) {
          if (prefs.atsTargets && prefs.atsTargets.length > 0) {
            setTargets(prefs.atsTargets);
          }
          if (prefs.locationFilters && prefs.locationFilters.length > 0) {
            setLocations(prefs.locationFilters);
          }
          if (prefs.cvStyle) {
            setCvStyle(prefs.cvStyle);
          }
        }
      } catch {
        // Fallback to defaults
      } finally {
        setLoading(false);
      }
    }
    loadPrefs();
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAddTarget = () => {
    const slug = newSlug.trim().toLowerCase();
    if (!slug) return;
    if (targets.some((t) => t.platform === newPlatform && t.slug === slug)) return;
    setTargets([...targets, { platform: newPlatform, slug }]);
    setNewSlug('');
  };

  const handleRemoveTarget = (index: number) => {
    setTargets(targets.filter((_, i) => i !== index));
  };

  const handleAddLocation = (locToAdd?: string) => {
    const loc = (locToAdd ?? newLocation).trim();
    if (!loc) return;
    if (locations.some((l) => l.toLowerCase() === loc.toLowerCase())) return;
    setLocations([...locations, loc]);
    if (!locToAdd) setNewLocation('');
  };

  const handleDetectAts = async (urlToDetect?: string) => {
    const target = (urlToDetect ?? detectorUrl).trim();
    if (!target) return;
    try {
      setDetecting(true);
      setDetectorError(null);
      setDetectionResult(null);
      const res = await api.connectors.detectAts(target);
      setDetectionResult(res);
    } catch (err: unknown) {
      setDetectorError(err instanceof Error ? err.message : 'Failed to analyze careers page');
    } finally {
      setDetecting(false);
    }
  };

  const handleAddDetectedTarget = (result: AtsDetectionResult) => {
    if (!result.provider || !result.slug) return;
    const supported = ['greenhouse', 'lever', 'ashby', 'workable'].includes(result.provider);
    if (!supported) return;
    const platform = result.provider as 'greenhouse' | 'lever' | 'ashby' | 'workable';
    const slug = result.slug.toLowerCase();
    if (targets.some((t) => t.platform === platform && t.slug === slug)) return;
    setTargets([...targets, { platform, slug }]);
  };

  const handleRemoveLocation = (index: number) => {
    setLocations(locations.filter((_, i) => i !== index));
  };

  const handleSave = async (triggerSync = false) => {
    setSaving(true);
    try {
      await api.preferences.upsert({
        atsTargets: targets,
        locationFilters: locations,
        cvStyle,
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);

      if (triggerSync) {
        setSyncingNow(true);
        const res = await api.connectors.syncAts(targets);
        alert(
          `ATS Sync Complete!\n• ${res.companiesChecked} company boards checked\n• ${res.jobsFound ?? res.jobsEnqueued} postings found\n• ${res.jobsEnqueued} newly enqueued\n• ${res.duplicatesSkipped ?? 0} duplicates skipped\n• ${res.locationFiltered ?? 0} filtered by location`,
        );
        onSyncTriggered?.();
        onClose();
      }
    } catch (err: unknown) {
      alert(`Failed to save settings: ${String(err)}`);
    } finally {
      setSaving(false);
      setSyncingNow(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-2xl bg-[#0f172a] border border-white/15 rounded-2xl shadow-2xl p-6 sm:p-7 space-y-6 max-h-[90vh] overflow-y-auto text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-white/10 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
                <Sliders className="h-4 w-4" />
              </div>
              <h2 className="text-base font-bold text-white tracking-tight">
                ATS Ingestion &amp; Location Filters
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Control which company boards are crawled and restrict ingestion to your target countries and cities.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {loading ? (
          <div className="py-12 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />
            <span>Loading preferences...</span>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Section 1: Location Filters */}
            <div className="space-y-3 bg-white/[0.02] border border-white/5 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-emerald-400" />
                  <span className="text-xs font-semibold text-white uppercase tracking-wider">
                    Target Location Filters
                  </span>
                </div>
                <span className="text-[11px] text-slate-400 font-mono">
                  {locations.length === 0 ? 'Matching All Locations' : `${locations.length} Active`}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Only postings matching these locations will be enqueued. Country names automatically expand to major tech hubs (e.g. &ldquo;Saudi Arabia&rdquo; matches Riyadh, Jeddah; &ldquo;UAE&rdquo; matches Dubai, Abu Dhabi).
              </p>

              {/* Preset Chips */}
              <div className="flex items-center gap-1.5 flex-wrap pt-1">
                <span className="text-[10px] text-slate-500 uppercase font-mono mr-1">Presets:</span>
                {PRESET_LOCATIONS.map((preset) => {
                  const active = locations.some((l) => l.toLowerCase() === preset.toLowerCase());
                  return (
                    <button
                      key={preset}
                      type="button"
                      disabled={active}
                      onClick={() => handleAddLocation(preset)}
                      className={`text-[11px] px-2.5 py-1 rounded-lg border transition-all ${
                        active
                          ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300 opacity-60'
                          : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:border-white/20'
                      }`}
                    >
                      {active ? `✓ ${preset}` : `+ ${preset}`}
                    </button>
                  );
                })}
              </div>

              {/* Active Location Chips */}
              <div className="flex items-center gap-2 flex-wrap pt-2">
                {locations.map((loc, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-medium"
                  >
                    <span>{loc}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveLocation(idx)}
                      className="hover:text-white transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                {locations.length === 0 && (
                  <span className="text-xs text-amber-300/80 italic">
                    No filters set — all jobs will be ingested regardless of location.
                  </span>
                )}
              </div>

              {/* Custom Location Input */}
              <div className="flex items-center gap-2 pt-2">
                <input
                  type="text"
                  placeholder="Add custom city or country (e.g. Dammam, Berlin, Qatar)..."
                  value={newLocation}
                  onChange={(e) => setNewLocation(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddLocation();
                    }
                  }}
                  className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={() => handleAddLocation()}
                  className="h-8 text-xs bg-white/10 hover:bg-white/15 text-white border border-white/10"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add
                </Button>
              </div>
            </div>

            {/* Section 2: Instant ATS Careers Page Detector */}
            <div className="space-y-3 bg-gradient-to-b from-indigo-500/[0.08] to-purple-500/[0.04] border border-indigo-500/20 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Search className="h-4 w-4 text-indigo-400" />
                  <span className="text-xs font-semibold text-white uppercase tracking-wider">
                    Instant ATS Detector
                  </span>
                </div>
                <span className="text-[11px] text-indigo-300 font-mono">
                  8 Providers · 7d Cache · robots.txt safe
                </span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Paste any company’s career page URL. The agent detects if they use <strong>Greenhouse, Lever, Ashby, Workable, SmartRecruiters, Recruitee, Personio, or BambooHR</strong> and verifies public board access.
              </p>

              {/* Quick Presets */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] text-slate-400 uppercase font-mono mr-1">Test targets:</span>
                {[
                  { name: 'Maqsam', url: 'https://www.maqsam.com' },
                  { name: 'Salla', url: 'https://salla.com' },
                  { name: 'Tamara', url: 'https://tamara.co/careers' },
                  { name: 'Tabby', url: 'https://tabby.ai/careers' },
                  { name: 'Careem', url: 'https://boards.greenhouse.io/careem' },
                ].map((item) => (
                  <button
                    key={item.name}
                    type="button"
                    disabled={detecting}
                    onClick={() => {
                      setDetectorUrl(item.url);
                      void handleDetectAts(item.url);
                    }}
                    className="text-[11px] px-2 py-0.5 rounded border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 transition-colors"
                  >
                    {item.name}
                  </button>
                ))}
              </div>

              {/* Input Row */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="text"
                  placeholder="https://company.com/careers or https://jobs.lever.co/company..."
                  value={detectorUrl}
                  onChange={(e) => setDetectorUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void handleDetectAts();
                    }
                  }}
                  className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
                />
                <Button
                  type="button"
                  size="sm"
                  disabled={detecting || !detectorUrl.trim()}
                  onClick={() => handleDetectAts()}
                  className="h-8 text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
                >
                  {detecting ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> Detecting…
                    </>
                  ) : (
                    <>
                      <Search className="h-3.5 w-3.5 mr-1" /> Detect ATS
                    </>
                  )}
                </Button>
              </div>

              {/* Error */}
              {detectorError && (
                <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-xs">
                  ⚠ {detectorError}
                </div>
              )}

              {/* Detection Result Card */}
              {detectionResult && (
                <div className="p-3.5 rounded-lg bg-black/50 border border-white/15 space-y-2">
                  {detectionResult.detected ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-base">🎯</span>
                          <span className="text-xs font-bold text-white capitalize">
                            {detectionResult.provider}
                          </span>
                          {detectionResult.slug && (
                            <code className="text-xs px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                              slug: {detectionResult.slug}
                            </code>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                              detectionResult.verified
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                            }`}
                          >
                            {detectionResult.verified
                              ? '✓ Verified Public API'
                              : `${Math.round(detectionResult.confidence * 100)}% Confidence`}
                          </span>
                          {detectionResult.source === 'cache' && (
                            <span className="text-[10px] text-slate-400">⚡ 7d cache</span>
                          )}
                        </div>
                      </div>

                      {/* 1-Click Add Button */}
                      {['greenhouse', 'lever', 'ashby', 'workable'].includes(detectionResult.provider || '') &&
                        detectionResult.slug && (
                          <div className="pt-1 flex items-center justify-between">
                            <span className="text-[11px] text-slate-400">
                              Free public job board ingestion available for {detectionResult.provider}.
                            </span>
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => handleAddDetectedTarget(detectionResult)}
                              disabled={targets.some(
                                (t) =>
                                  t.platform === detectionResult.provider &&
                                  t.slug.toLowerCase() === (detectionResult.slug || '').toLowerCase(),
                              )}
                              className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                            >
                              {targets.some(
                                (t) =>
                                  t.platform === detectionResult.provider &&
                                  t.slug.toLowerCase() === (detectionResult.slug || '').toLowerCase(),
                              )
                                ? '✓ Already Added'
                                : `+ Add "${detectionResult.slug}" to Target Boards`}
                            </Button>
                          </div>
                        )}
                    </div>
                  ) : (
                    <div className="text-xs text-amber-300/90 flex items-center gap-2">
                      <span>ℹ</span>
                      <span>
                        No standard ATS found for this URL (may be custom careers portal or protected by robots.txt).
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Section 3: Target Companies */}
            <div className="space-y-3 bg-white/[0.02] border border-white/5 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-indigo-400" />
                  <span className="text-xs font-semibold text-white uppercase tracking-wider">
                    Target ATS Company Boards ({targets.length})
                  </span>
                </div>
                <span className="text-[11px] text-slate-400 font-mono">
                  Greenhouse, Lever, Ashby, Workable
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Add public ATS company boards to sync on-demand or automatically during background runs.
              </p>

              {/* Companies List */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                {targets.map((t, idx) => {
                  const badgeMap: Record<string, { label: string; cls: string }> = {
                    greenhouse: { label: 'GH', cls: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
                    lever: { label: 'LEVER', cls: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
                    ashby: { label: 'ASHBY', cls: 'bg-pink-500/20 text-pink-300 border-pink-500/30' },
                    workable: { label: 'WORKABLE', cls: 'bg-sky-500/20 text-sky-300 border-sky-500/30' },
                  };
                  const badge = badgeMap[t.platform] ?? { label: t.platform.toUpperCase(), cls: 'bg-slate-500/20 text-slate-300 border-slate-500/30' };
                  return (
                    <div
                      key={idx}
                      className="flex items-center justify-between px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono uppercase font-bold border ${badge.cls}`}>
                          {badge.label}
                        </span>
                        <span className="font-semibold text-white truncate">{t.slug}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveTarget(idx)}
                        className="text-slate-500 hover:text-red-400 transition-colors p-1"
                        title="Remove board"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Add Company Input */}
              <div className="flex items-center gap-2 pt-2">
                <select
                  value={newPlatform}
                  onChange={(e) => setNewPlatform(e.target.value as 'greenhouse' | 'lever' | 'ashby' | 'workable')}
                  className="bg-black/40 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="greenhouse">Greenhouse</option>
                  <option value="lever">Lever</option>
                  <option value="ashby">Ashby</option>
                  <option value="workable">Workable</option>
                </select>
                <input
                  type="text"
                  placeholder="company-slug (e.g. salla, tamara, careem)..."
                  value={newSlug}
                  onChange={(e) => setNewSlug(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddTarget();
                    }
                  }}
                  className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={handleAddTarget}
                  className="h-8 text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add Board
                </Button>
              </div>
            </div>

            {/* Section 3: Default CV Style */}
            <div className="space-y-3 bg-white/[0.02] border border-white/5 rounded-xl p-4">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-purple-400" />
                <span className="text-xs font-semibold text-white uppercase tracking-wider">
                  Default CV Layout Strategy
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Choose how tailored CVs are formatted when generated. The agent can auto-detect by job country or force a specific regional format.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                {[
                  {
                    id: 'AUTO',
                    label: '⚡ Auto-Detect',
                    desc: 'Gulf layout for GCC jobs, European layout for UK/EU/Remote.',
                  },
                  {
                    id: 'GULF',
                    label: '🇸🇦 Gulf / GCC',
                    desc: 'Highlights Iqama/visa, notice period, location mobility, direct WhatsApp.',
                  },
                  {
                    id: 'EUROPE',
                    label: '🇪🇺 European ATS',
                    desc: 'Strictly GDPR compliant, zero personal bias fields, heavy STAR metrics.',
                  },
                ].map((opt) => {
                  const active = cvStyle === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setCvStyle(opt.id as 'AUTO' | 'GULF' | 'EUROPE')}
                      className={`text-left p-3 rounded-xl border transition-all ${
                        active
                          ? 'border-indigo-500 bg-indigo-500/15 text-white shadow-md shadow-indigo-500/10'
                          : 'border-white/10 bg-black/30 text-slate-400 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <div className="font-bold text-xs flex items-center justify-between">
                        <span>{opt.label}</span>
                        {active && <Check className="h-3.5 w-3.5 text-indigo-400" />}
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1 leading-snug">
                        {opt.desc}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-white/10 pt-4 flex-wrap gap-3">
          <div className="text-xs text-emerald-400 font-medium">
            {saveSuccess && '✓ Settings saved successfully!'}
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-xs text-slate-400 hover:text-white"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={saving || syncingNow}
              onClick={() => handleSave(false)}
              className="text-xs bg-white/10 hover:bg-white/15 text-white border border-white/15"
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={saving || syncingNow}
              onClick={() => handleSave(true)}
              className="text-xs bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-medium gap-1.5 shadow-md shadow-indigo-500/20"
            >
              {syncingNow ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  <span>Syncing ATS Boards...</span>
                </>
              ) : (
                <>
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>Save &amp; Sync ATS Now</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
