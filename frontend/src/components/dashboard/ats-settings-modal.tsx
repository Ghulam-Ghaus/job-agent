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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api, type AtsTarget } from '@/lib/api-client';

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
  const [newPlatform, setNewPlatform] = useState<'greenhouse' | 'lever'>('greenhouse');
  const [newSlug, setNewSlug] = useState('');

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

            {/* Section 2: Target Companies */}
            <div className="space-y-3 bg-white/[0.02] border border-white/5 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-indigo-400" />
                  <span className="text-xs font-semibold text-white uppercase tracking-wider">
                    Target ATS Company Boards ({targets.length})
                  </span>
                </div>
                <span className="text-[11px] text-slate-400 font-mono">
                  Greenhouse &amp; Lever APIs
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Enter the exact company board slug used by Greenhouse (<code>boards.greenhouse.io/[slug]</code>) or Lever (<code>jobs.lever.co/[slug]</code>).
              </p>

              {/* Companies List */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                {targets.map((t, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`text-[9px] px-1.5 py-0.5 rounded font-mono uppercase font-bold ${
                          t.platform === 'greenhouse'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                        }`}
                      >
                        {t.platform === 'greenhouse' ? 'GH' : 'LEVER'}
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
                ))}
              </div>

              {/* Add Company Input */}
              <div className="flex items-center gap-2 pt-2">
                <select
                  value={newPlatform}
                  onChange={(e) => setNewPlatform(e.target.value as 'greenhouse' | 'lever')}
                  className="bg-black/40 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="greenhouse">Greenhouse</option>
                  <option value="lever">Lever</option>
                </select>
                <input
                  type="text"
                  placeholder="company-slug (e.g. postman, tabby, talabat)..."
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
