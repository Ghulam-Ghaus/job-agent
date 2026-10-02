'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  User,
  Wrench,
  Briefcase,
  SlidersHorizontal,
  FileText,
  Upload,
  Plus,
  Trash2,
  Check,
  Star,
  Loader2,
  Save,
  AlertCircle,
} from 'lucide-react';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  api,
  Profile,
  Skill,
  Experience,
  JobPreference,
  Cv,
} from '@/lib/api-client';

export default function ProfilePage() {
  const [activeTab, setActiveTab] = useState<'facts' | 'skills' | 'preferences' | 'cvs' | 'experience'>('skills');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // ── State ──────────────────────────────────────────────────────────────────
  const [profile, setProfile] = useState<Partial<Profile>>({});
  const [skills, setSkills] = useState<Skill[]>([]);
  const [preferences, setPreferences] = useState<Partial<JobPreference>>({
    targetRoles: [],
    targetCountries: [],
    minSalaryUsd: 0,
    remoteOk: true,
    blacklistCompanies: [],
  });
  const [cvs, setCvs] = useState<Cv[]>([]);
  const [experiences, setExperiences] = useState<Experience[]>([]);

  // ── Form helpers for inputs ───────────────────────────────────────────────
  const [newSkill, setNewSkill] = useState({ name: '', level: 'INTERMEDIATE' as const, yearsOfExp: 3, category: 'Backend' });
  const [newExp, setNewExp] = useState({
    title: '',
    company: '',
    location: '',
    startDate: '',
    endDate: '',
    isCurrent: false,
    bullets: '',
    techStack: '',
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingCv, setUploadingCv] = useState(false);

  // ── Load all candidate data ────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [profData, skillsData, prefsData, cvsData, expData] = await Promise.all([
        api.profile.get().catch(() => null),
        api.skills.list().catch(() => []),
        api.preferences.get().catch(() => null),
        api.cvs.list().catch(() => []),
        api.experience.list().catch(() => []),
      ]);

      if (profData) setProfile(profData);
      if (skillsData) setSkills(skillsData);
      if (prefsData) setPreferences(prefsData);
      if (cvsData) setCvs(cvsData);
      if (expData) setExperiences(expData);
    } catch {
      setMessage({ type: 'error', text: 'Failed to load master profile facts.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Auto-clear notification messages
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  // ── Save Profile Facts ─────────────────────────────────────────────────────
  const saveProfileFacts = async () => {
    try {
      setSaving(true);
      await api.profile.upsert(profile);
      setMessage({ type: 'success', text: 'Master profile facts saved successfully!' });
    } catch {
      setMessage({ type: 'error', text: 'Error saving profile facts.' });
    } finally {
      setSaving(false);
    }
  };

  // ── Save Preferences / Search Zones ────────────────────────────────────────
  const savePreferences = async () => {
    try {
      setSaving(true);
      await api.preferences.upsert(preferences);
      setMessage({ type: 'success', text: 'Search zone & job preferences updated!' });
    } catch {
      setMessage({ type: 'error', text: 'Error saving search preferences.' });
    } finally {
      setSaving(false);
    }
  };

  // ── Add / Delete Skills ────────────────────────────────────────────────────
  const handleAddSkill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSkill.name.trim()) return;

    try {
      setSaving(true);
      const created = await api.skills.create({
        name: newSkill.name.trim(),
        level: newSkill.level,
        yearsOfExp: Number(newSkill.yearsOfExp) || 0,
        category: newSkill.category,
      });
      setSkills((prev) => [...prev, created]);
      setNewSkill({ name: '', level: 'INTERMEDIATE', yearsOfExp: 3, category: 'Backend' });
      setMessage({ type: 'success', text: `Skill "${created.name}" added to ATS pool!` });
    } catch {
      setMessage({ type: 'error', text: 'Failed to add skill.' });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSkill = async (id: string, name: string) => {
    try {
      await api.skills.delete(id);
      setSkills((prev) => prev.filter((s) => s.id !== id));
      setMessage({ type: 'success', text: `Skill "${name}" removed.` });
    } catch {
      setMessage({ type: 'error', text: 'Failed to remove skill.' });
    }
  };

  // ── Add Experience ─────────────────────────────────────────────────────────
  const handleAddExperience = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExp.title.trim() || !newExp.company.trim()) return;

    try {
      setSaving(true);
      const created = await api.experience.create({
        title: newExp.title.trim(),
        company: newExp.company.trim(),
        location: newExp.location.trim() || undefined,
        startDate: newExp.startDate ? new Date(newExp.startDate).toISOString() : new Date().toISOString(),
        endDate: newExp.endDate && !newExp.isCurrent ? new Date(newExp.endDate).toISOString() : undefined,
        isCurrent: newExp.isCurrent,
        bullets: newExp.bullets ? newExp.bullets.split('\n').filter(Boolean) : [],
        techStack: newExp.techStack ? newExp.techStack.split(',').map((s) => s.trim()).filter(Boolean) : [],
      });
      setExperiences((prev) => [...prev, created]);
      setNewExp({ title: '', company: '', location: '', startDate: '', endDate: '', isCurrent: false, bullets: '', techStack: '' });
      setMessage({ type: 'success', text: 'Work experience added!' });
    } catch {
      setMessage({ type: 'error', text: 'Failed to add experience.' });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteExperience = async (id: string) => {
    try {
      await api.experience.delete(id);
      setExperiences((prev) => prev.filter((e) => e.id !== id));
      setMessage({ type: 'success', text: 'Experience deleted.' });
    } catch {
      setMessage({ type: 'error', text: 'Failed to delete experience.' });
    }
  };

  // ── CV Upload & Set Default ────────────────────────────────────────────────
  const handleUploadCv = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('label', file.name.replace(/\.[^/.]+$/, ''));
    formData.append('tags', 'Primary,Full-Stack');

    try {
      setUploadingCv(true);
      const res = await api.cvs.upload(formData);
      setCvs((prev) => [...prev, res.cv]);
      setMessage({ type: 'success', text: `CV "${file.name}" uploaded successfully!` });
    } catch {
      setMessage({ type: 'error', text: 'CV upload failed.' });
    } finally {
      setUploadingCv(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSetDefaultCv = async (id: string) => {
    try {
      await api.cvs.update(id, { isDefault: true });
      setCvs((prev) =>
        prev.map((c) => ({
          ...c,
          isDefault: c.id === id,
        }))
      );
      setMessage({ type: 'success', text: 'Default CV updated for Apply Packs.' });
    } catch {
      setMessage({ type: 'error', text: 'Failed to update default CV.' });
    }
  };

  const handleDeleteCv = async (id: string) => {
    try {
      await api.cvs.delete(id);
      setCvs((prev) => prev.filter((c) => c.id !== id));
      setMessage({ type: 'success', text: 'CV deleted.' });
    } catch {
      setMessage({ type: 'error', text: 'Failed to delete CV.' });
    }
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <Header
          title="Master Profile"
          description="Candidate ground-truth facts for ATS scoring & verified Apply Packs"
          breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Master Profile' }]}
          backHref="/dashboard"
          backLabel="Opportunities"
          nextHref="/approvals"
          nextLabel="Approval Queue"
        />

        <main className="p-8 max-w-6xl mx-auto w-full space-y-6">
          {/* Header Title */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/50 pb-5">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                <FileText className="h-6 w-6 text-primary" />
                Master Profile & Facts
              </h1>
              <p className="text-xs text-muted-foreground mt-1">
                Your single source of ground-truth candidate facts. The AI uses these facts to compute match scores and prevents unverified claims.
              </p>
            </div>
            {message && (
              <div
                className={`text-xs px-3 py-1.5 rounded-lg flex items-center gap-2 border ${
                  message.type === 'success'
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    : 'bg-red-500/10 text-red-400 border-red-500/20'
                }`}
              >
                {message.type === 'success' ? <Check className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
                <span>{message.text}</span>
              </div>
            )}
          </div>

          {/* Navigation Tabs */}
          <div className="flex flex-wrap gap-2 border-b border-border/50 pb-2">
            {[
              { id: 'skills', label: `Skills & ATS Pool (${skills.length})`, icon: Wrench },
              { id: 'preferences', label: 'Job Zones & Search Prefs', icon: SlidersHorizontal },
              { id: 'cvs', label: `CV Documents (${cvs.length})`, icon: FileText },
              { id: 'experience', label: `Experience (${experiences.length})`, icon: Briefcase },
              { id: 'facts', label: 'Personal & Relocation', icon: User },
            ].map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium transition-all ${
                    active
                      ? 'bg-primary text-primary-foreground shadow-sm font-semibold'
                      : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-xs text-muted-foreground">Loading master candidate facts...</p>
            </div>
          ) : (
            <>
              {/* ── TAB 1: SKILLS & ATS MATCH POOL ─────────────────────────────────── */}
              {activeTab === 'skills' && (
                <div className="space-y-6">
                  <Card className="border-border/50 bg-card/60">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-semibold flex items-center justify-between">
                        <span>Add New ATS Match Skill</span>
                        <span className="text-[11px] font-normal text-muted-foreground">
                          Technical overlap accounts for 40 pts in scoring
                        </span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <form onSubmit={handleAddSkill} className="flex flex-wrap gap-3 items-end">
                        <div className="flex-1 min-w-[200px] space-y-1">
                          <label className="text-[11px] text-muted-foreground">Skill Name (e.g. NestJS, Redis, React)</label>
                          <Input
                            placeholder="e.g. PostgreSQL"
                            value={newSkill.name}
                            onChange={(e) => setNewSkill({ ...newSkill, name: e.target.value })}
                            className="bg-background/80 text-xs"
                          />
                        </div>
                        <div className="w-[140px] space-y-1">
                          <label className="text-[11px] text-muted-foreground">Level</label>
                          <select
                            value={newSkill.level}
                            onChange={(e) => setNewSkill({ ...newSkill, level: e.target.value as any })}
                            className="w-full h-9 rounded-md border border-input bg-background/80 px-2 text-xs"
                          >
                            <option value="BEGINNER">BEGINNER</option>
                            <option value="INTERMEDIATE">INTERMEDIATE</option>
                            <option value="EXPERT">EXPERT</option>
                          </select>
                        </div>
                        <div className="w-[110px] space-y-1">
                          <label className="text-[11px] text-muted-foreground">Years of Exp</label>
                          <Input
                            type="number"
                            min="0"
                            step="0.5"
                            value={newSkill.yearsOfExp}
                            onChange={(e) => setNewSkill({ ...newSkill, yearsOfExp: parseFloat(e.target.value) || 0 })}
                            className="bg-background/80 text-xs"
                          />
                        </div>
                        <div className="w-[140px] space-y-1">
                          <label className="text-[11px] text-muted-foreground">Category</label>
                          <Input
                            placeholder="e.g. Backend"
                            value={newSkill.category}
                            onChange={(e) => setNewSkill({ ...newSkill, category: e.target.value })}
                            className="bg-background/80 text-xs"
                          />
                        </div>
                        <Button type="submit" size="sm" disabled={saving || !newSkill.name.trim()} className="gap-1.5">
                          <Plus className="h-3.5 w-3.5" />
                          Add Skill
                        </Button>
                      </form>
                    </CardContent>
                  </Card>

                  {/* Skills Grid */}
                  <Card className="border-border/50 bg-card/60">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-semibold">Active Verified Skills ({skills.length})</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {skills.length === 0 ? (
                        <p className="text-xs text-muted-foreground py-4 text-center">
                          No skills added yet. Add your core languages, frameworks, and databases above.
                        </p>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                          {skills.map((skill) => (
                            <div
                              key={skill.id}
                              className="p-3 rounded-lg border border-border/40 bg-accent/20 flex items-center justify-between"
                            >
                              <div className="min-w-0 pr-2">
                                <p className="text-xs font-semibold text-foreground truncate">{skill.name}</p>
                                <div className="flex items-center gap-1.5 mt-1">
                                  <Badge variant="outline" className="text-[9px] py-0 px-1">
                                    {skill.level}
                                  </Badge>
                                  {skill.yearsOfExp ? (
                                    <span className="text-[10px] text-muted-foreground">{skill.yearsOfExp}y exp</span>
                                  ) : null}
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteSkill(skill.id, skill.name)}
                                className="h-6 w-6 text-muted-foreground hover:text-destructive"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* ── TAB 2: SEARCH ZONE & JOB PREFERENCES ────────────────────────────── */}
              {activeTab === 'preferences' && (
                <Card className="border-border/50 bg-card/60">
                  <CardHeader>
                    <CardTitle className="text-sm font-semibold">Job Zones, Target Locations & Compensation</CardTitle>
                    <p className="text-xs text-muted-foreground">
                      Defines where the agent filters and scores job matches (Location: 15 pts, Salary: 10 pts).
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-foreground">Target Countries (comma separated)</label>
                        <Input
                          value={Array.isArray(preferences.targetCountries) ? preferences.targetCountries.join(', ') : ''}
                          onChange={(e) =>
                            setPreferences({
                              ...preferences,
                              targetCountries: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                            })
                          }
                          placeholder="Saudi Arabia, UAE, Qatar, Remote"
                          className="bg-background/80 text-xs"
                        />
                        <span className="text-[10px] text-muted-foreground">e.g. Saudi Arabia, UAE, United Arab Emirates, Remote</span>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-foreground">Target Roles / Job Titles</label>
                        <Input
                          value={Array.isArray(preferences.targetRoles) ? preferences.targetRoles.join(', ') : ''}
                          onChange={(e) =>
                            setPreferences({
                              ...preferences,
                              targetRoles: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                            })
                          }
                          placeholder="Senior Backend Engineer, Full Stack Developer"
                          className="bg-background/80 text-xs"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-foreground">Minimum Salary (USD/yr)</label>
                        <Input
                          type="number"
                          step="1000"
                          value={preferences.minSalaryUsd || ''}
                          onChange={(e) => setPreferences({ ...preferences, minSalaryUsd: parseInt(e.target.value, 10) || 0 })}
                          placeholder="50000"
                          className="bg-background/80 text-xs"
                        />
                      </div>

                      <div className="space-y-1.5 flex flex-col justify-end">
                        <label className="text-xs font-medium text-foreground mb-2">Remote Work Policy</label>
                        <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
                          <input
                            type="checkbox"
                            checked={preferences.remoteOk ?? true}
                            onChange={(e) => setPreferences({ ...preferences, remoteOk: e.target.checked })}
                            className="rounded border-input text-primary focus:ring-primary h-4 w-4"
                          />
                          <span>Allow Remote Opportunities (Full Remote OK)</span>
                        </label>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-border/40 flex justify-end">
                      <Button onClick={savePreferences} disabled={saving} className="gap-2">
                        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                        Save Job Zone Preferences
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* ── TAB 3: CV MANAGEMENT ───────────────────────────────────────────── */}
              {activeTab === 'cvs' && (
                <div className="space-y-6">
                  <Card className="border-border/50 bg-card/60">
                    <CardHeader className="pb-3 flex flex-row items-center justify-between">
                      <div>
                        <CardTitle className="text-sm font-semibold">Uploaded CV Versions</CardTitle>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          The system recommends the best matching CV for each opportunity (stored on local disk storage).
                        </p>
                      </div>
                      <div>
                        <input
                          type="file"
                          ref={fileInputRef}
                          onChange={handleUploadCv}
                          accept=".pdf,.docx,.doc,.txt"
                          className="hidden"
                        />
                        <Button
                          size="sm"
                          disabled={uploadingCv}
                          onClick={() => fileInputRef.current?.click()}
                          className="gap-2"
                        >
                          {uploadingCv ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                          Upload New CV
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {cvs.length === 0 ? (
                        <div className="py-8 text-center border border-dashed border-border/50 rounded-lg">
                          <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                          <p className="text-xs text-muted-foreground">No CV uploaded yet.</p>
                          <Button
                            variant="link"
                            size="sm"
                            onClick={() => fileInputRef.current?.click()}
                            className="text-xs mt-1"
                          >
                            Upload your first PDF CV
                          </Button>
                        </div>
                      ) : (
                        <div className="divide-y divide-border/40">
                          {cvs.map((cv) => (
                            <div key={cv.id} className="py-3.5 flex items-center justify-between gap-4">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="text-xs font-semibold text-foreground truncate">{cv.label || cv.filename}</p>
                                  {cv.isDefault && (
                                    <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[9px] py-0">
                                      Default Pick
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-[10px] text-muted-foreground mt-0.5">
                                  {cv.filename} · {(cv.sizeBytes / 1024).toFixed(1)} KB · Added {new Date(cv.createdAt).toLocaleDateString()}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                {!cv.isDefault && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleSetDefaultCv(cv.id)}
                                    className="text-xs h-7 gap-1"
                                  >
                                    <Star className="h-3 w-3" />
                                    Make Default
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDeleteCv(cv.id)}
                                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* ── TAB 4: WORK EXPERIENCE ─────────────────────────────────────────── */}
              {activeTab === 'experience' && (
                <div className="space-y-6">
                  <Card className="border-border/50 bg-card/60">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-semibold">Add Career Experience</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <form onSubmit={handleAddExperience} className="space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <Input
                            placeholder="Title (e.g. Senior Software Engineer)"
                            value={newExp.title}
                            onChange={(e) => setNewExp({ ...newExp, title: e.target.value })}
                            className="bg-background/80 text-xs"
                          />
                          <Input
                            placeholder="Company (e.g. Tech Solutions)"
                            value={newExp.company}
                            onChange={(e) => setNewExp({ ...newExp, company: e.target.value })}
                            className="bg-background/80 text-xs"
                          />
                          <Input
                            placeholder="Location / Country"
                            value={newExp.location}
                            onChange={(e) => setNewExp({ ...newExp, location: e.target.value })}
                            className="bg-background/80 text-xs"
                          />
                          <div className="grid grid-cols-2 gap-2">
                            <Input
                              type="date"
                              value={newExp.startDate}
                              onChange={(e) => setNewExp({ ...newExp, startDate: e.target.value })}
                              className="bg-background/80 text-xs"
                            />
                            <Input
                              type="date"
                              disabled={newExp.isCurrent}
                              value={newExp.endDate}
                              onChange={(e) => setNewExp({ ...newExp, endDate: e.target.value })}
                              className="bg-background/80 text-xs"
                            />
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                            <input
                              type="checkbox"
                              checked={newExp.isCurrent}
                              onChange={(e) => setNewExp({ ...newExp, isCurrent: e.target.checked })}
                              className="rounded border-input text-primary h-3.5 w-3.5"
                            />
                            <span>Currently working here</span>
                          </label>
                        </div>
                        <Input
                          placeholder="Tech stack (comma separated: NestJS, Redis, PostgreSQL)"
                          value={newExp.techStack}
                          onChange={(e) => setNewExp({ ...newExp, techStack: e.target.value })}
                          className="bg-background/80 text-xs"
                        />
                        <Button type="submit" size="sm" disabled={saving || !newExp.title || !newExp.company} className="gap-1.5">
                          <Plus className="h-3.5 w-3.5" />
                          Add Experience Record
                        </Button>
                      </form>
                    </CardContent>
                  </Card>

                  {/* List of experiences */}
                  <div className="space-y-3">
                    {experiences.map((exp) => (
                      <Card key={exp.id} className="border-border/50 bg-card/60">
                        <CardContent className="p-4 flex items-start justify-between">
                          <div className="space-y-1">
                            <h4 className="text-xs font-semibold text-foreground">{exp.title} · {exp.company}</h4>
                            <p className="text-[10px] text-muted-foreground">
                              {exp.location || 'Location unstated'} · {new Date(exp.startDate).getFullYear()} – {exp.isCurrent ? 'Present' : exp.endDate ? new Date(exp.endDate).getFullYear() : 'Present'}
                            </p>
                            {exp.techStack && exp.techStack.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1.5">
                                {exp.techStack.map((tech, idx) => (
                                  <Badge key={idx} variant="outline" className="text-[9px] py-0 px-1">
                                    {tech}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteExperience(exp.id)}
                            className="h-6 w-6 text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {/* ── TAB 5: PERSONAL & RELOCATION FACTS ──────────────────────────────── */}
              {activeTab === 'facts' && (
                <Card className="border-border/50 bg-card/60">
                  <CardHeader>
                    <CardTitle className="text-sm font-semibold">Personal & Relocation Ground Truth</CardTitle>
                    <p className="text-xs text-muted-foreground">
                      These values are strictly used to score Visa sponsorship (5 pts) and prevent hallucinations in Apply Packs.
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-foreground">Full Name</label>
                        <Input
                          value={profile.fullName || ''}
                          onChange={(e) => setProfile({ ...profile, fullName: e.target.value })}
                          placeholder="Your Name"
                          className="bg-background/80 text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-foreground">Headline</label>
                        <Input
                          value={profile.headline || ''}
                          onChange={(e) => setProfile({ ...profile, headline: e.target.value })}
                          placeholder="e.g. Senior Backend Engineer"
                          className="bg-background/80 text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-foreground">Current Country of Residence</label>
                        <Input
                          value={profile.country || ''}
                          onChange={(e) => setProfile({ ...profile, country: e.target.value })}
                          placeholder="e.g. Pakistan, Saudi Arabia, UAE"
                          className="bg-background/80 text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-foreground">Visa / Work Authorization Status</label>
                        <Input
                          value={profile.visaStatus || ''}
                          onChange={(e) => setProfile({ ...profile, visaStatus: e.target.value })}
                          placeholder="e.g. Need visa sponsorship, or Citizen"
                          className="bg-background/80 text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-foreground">Notice Period (Days)</label>
                        <Input
                          type="number"
                          value={profile.noticePeriodDays || ''}
                          onChange={(e) => setProfile({ ...profile, noticePeriodDays: parseInt(e.target.value, 10) || 0 })}
                          placeholder="30"
                          className="bg-background/80 text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-foreground">Telegram Chat ID</label>
                        <Input
                          value={profile.telegramChatId || ''}
                          onChange={(e) => setProfile({ ...profile, telegramChatId: e.target.value })}
                          placeholder="Enter your Telegram chat ID"
                          className="bg-background/80 text-xs"
                        />
                      </div>
                    </div>

                    <div className="pt-4 border-t border-border/40 flex justify-end">
                      <Button onClick={saveProfileFacts} disabled={saving} className="gap-2">
                        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                        Save Personal Facts
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
