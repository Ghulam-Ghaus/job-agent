'use client';

import React, { useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  User, Briefcase, Wrench, FileUp, SlidersHorizontal,
  ChevronRight, ChevronLeft, Check, Plus, X, Upload,
  Loader2, AlertCircle, Star,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { api, ApiClientError } from '@/lib/api-client';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SkillEntry { name: string; level: 'BEGINNER' | 'INTERMEDIATE' | 'EXPERT'; yearsOfExp: number; category: string; }
interface ExperienceEntry { title: string; company: string; location: string; startDate: string; endDate: string; isCurrent: boolean; bullets: string; techStack: string; }

interface StepState {
  // Step 1: Basic profile
  fullName: string; headline: string; summary: string; phone: string;
  location: string; country: string; linkedinUrl: string; githubUrl: string;
  portfolioUrl: string; visaStatus: string; noticePeriodDays: string;
  willingToRelocate: boolean; telegramChatId: string;
  // Step 2: Skills
  skills: SkillEntry[];
  // Step 3: Experience
  experiences: ExperienceEntry[];
  // Step 4: CV upload handled separately
  // Step 5: Preferences
  targetRoles: string; targetCountries: string; minSalaryUsd: string;
  remoteOk: boolean; preferredIndustries: string;
}

const INITIAL: StepState = {
  fullName: '', headline: '', summary: '', phone: '',
  location: '', country: '', linkedinUrl: '', githubUrl: '',
  portfolioUrl: '', visaStatus: '', noticePeriodDays: '',
  willingToRelocate: false, telegramChatId: '',
  skills: [],
  experiences: [],
  targetRoles: '', targetCountries: '', minSalaryUsd: '',
  remoteOk: true, preferredIndustries: '',
};

const STEPS = [
  { id: 1, label: 'Profile', icon: User },
  { id: 2, label: 'Skills', icon: Wrench },
  { id: 3, label: 'Experience', icon: Briefcase },
  { id: 4, label: 'Upload CV', icon: FileUp },
  { id: 5, label: 'Preferences', icon: SlidersHorizontal },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</label>
      {children}
    </div>
  );
}

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-2 mb-10">
      {STEPS.map((step, i) => {
        const Icon = step.icon;
        const done = current > step.id;
        const active = current === step.id;
        return (
          <React.Fragment key={step.id}>
            <div className="flex flex-col items-center gap-1.5">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all duration-300
                ${done ? 'bg-emerald-500 border-emerald-500 text-white' : active ? 'bg-indigo-500/20 border-indigo-500 text-indigo-400' : 'bg-card border-border text-muted-foreground'}`}>
                {done ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
              </div>
              <span className={`text-[10px] font-medium ${active ? 'text-indigo-400' : done ? 'text-emerald-400' : 'text-muted-foreground'}`}>
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-px mb-5 transition-all duration-300 ${done ? 'bg-emerald-500/60' : 'bg-border'}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ─── Step 1: Basic Profile ────────────────────────────────────────────────────

function Step1Profile({ state, set }: { state: StepState; set: (k: keyof StepState, v: unknown) => void }) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold">Basic Profile</h2>
        <p className="text-sm text-muted-foreground mt-1">This is the foundation the AI uses to match and personalise every application.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Full Name *">
          <Input id="ob-fullname" value={state.fullName} onChange={e => set('fullName', e.target.value)} placeholder="Ghulam Ghaus" className="bg-background/60" />
        </Field>
        <Field label="Professional Headline">
          <Input id="ob-headline" value={state.headline} onChange={e => set('headline', e.target.value)} placeholder="Senior Full-Stack Engineer | NestJS · Next.js" className="bg-background/60" />
        </Field>
        <Field label="Phone">
          <Input id="ob-phone" value={state.phone} onChange={e => set('phone', e.target.value)} placeholder="+966 5x xxx xxxx" className="bg-background/60" />
        </Field>
        <Field label="Location / City">
          <Input id="ob-location" value={state.location} onChange={e => set('location', e.target.value)} placeholder="Riyadh" className="bg-background/60" />
        </Field>
        <Field label="Country">
          <Input id="ob-country" value={state.country} onChange={e => set('country', e.target.value)} placeholder="Saudi Arabia" className="bg-background/60" />
        </Field>
        <Field label="Visa Status">
          <Input id="ob-visa" value={state.visaStatus} onChange={e => set('visaStatus', e.target.value)} placeholder="e.g. Iqama, Citizen, Work Permit" className="bg-background/60" />
        </Field>
        <Field label="Notice Period (days)">
          <Input id="ob-notice" type="number" value={state.noticePeriodDays} onChange={e => set('noticePeriodDays', e.target.value)} placeholder="30" className="bg-background/60" />
        </Field>
        <Field label="Telegram Chat ID">
          <Input id="ob-telegram" value={state.telegramChatId} onChange={e => set('telegramChatId', e.target.value)} placeholder="Link later via /start" className="bg-background/60" />
        </Field>
        <Field label="LinkedIn URL">
          <Input id="ob-linkedin" value={state.linkedinUrl} onChange={e => set('linkedinUrl', e.target.value)} placeholder="https://linkedin.com/in/..." className="bg-background/60" />
        </Field>
        <Field label="GitHub URL">
          <Input id="ob-github" value={state.githubUrl} onChange={e => set('githubUrl', e.target.value)} placeholder="https://github.com/..." className="bg-background/60" />
        </Field>
      </div>
      <Field label="Summary / Bio">
        <textarea
          id="ob-summary"
          rows={4}
          value={state.summary}
          onChange={e => set('summary', e.target.value)}
          placeholder="Experienced full-stack engineer specialising in NestJS backends and Next.js frontends with 8+ years..."
          className="w-full rounded-md border border-input bg-background/60 px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
        />
      </Field>
      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input
          id="ob-relocate"
          type="checkbox"
          checked={state.willingToRelocate}
          onChange={e => set('willingToRelocate', e.target.checked)}
          className="rounded border-input"
        />
        <span className="text-sm">Willing to relocate internationally</span>
      </label>
    </div>
  );
}

// ─── Step 2: Skills ───────────────────────────────────────────────────────────

const SKILL_LEVELS: SkillEntry['level'][] = ['BEGINNER', 'INTERMEDIATE', 'EXPERT'];

function Step2Skills({ state, set }: { state: StepState; set: (k: keyof StepState, v: unknown) => void }) {
  const [draft, setDraft] = useState<SkillEntry>({ name: '', level: 'INTERMEDIATE', yearsOfExp: 1, category: '' });

  const addSkill = () => {
    if (!draft.name.trim()) return;
    set('skills', [...state.skills, { ...draft, name: draft.name.trim() }]);
    setDraft({ name: '', level: 'INTERMEDIATE', yearsOfExp: 1, category: '' });
  };

  const remove = (i: number) => set('skills', state.skills.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold">Skills</h2>
        <p className="text-sm text-muted-foreground mt-1">Add every skill with an honest level — the scoring engine uses this to compute technical fit.</p>
      </div>

      {/* Add skill form */}
      <Card className="border-border/40 bg-card/30">
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="col-span-2">
              <Field label="Skill name">
                <Input id="ob-skill-name" value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && addSkill()}
                  placeholder="e.g. NestJS" className="bg-background/60" />
              </Field>
            </div>
            <Field label="Level">
              <select
                id="ob-skill-level"
                value={draft.level}
                onChange={e => setDraft(d => ({ ...d, level: e.target.value as SkillEntry['level'] }))}
                className="w-full h-9 rounded-md border border-input bg-background/60 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {SKILL_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </Field>
            <Field label="Years exp">
              <Input id="ob-skill-years" type="number" min={0} max={40} value={draft.yearsOfExp}
                onChange={e => setDraft(d => ({ ...d, yearsOfExp: Number(e.target.value) }))}
                className="bg-background/60" />
            </Field>
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <Field label="Category (optional)">
                <Input id="ob-skill-cat" value={draft.category}
                  onChange={e => setDraft(d => ({ ...d, category: e.target.value }))}
                  placeholder="Backend / Frontend / DevOps / Language" className="bg-background/60" />
              </Field>
            </div>
            <div className="pt-6">
              <Button id="ob-skill-add" onClick={addSkill} size="sm" className="gap-1.5">
                <Plus className="h-3.5 w-3.5" /> Add
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Skills list */}
      {state.skills.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {state.skills.map((s, i) => (
            <Badge key={i} variant="secondary" className="gap-1.5 py-1 pr-1 text-sm font-normal">
              <Star className="h-3 w-3 text-amber-400" />
              <span>{s.name}</span>
              <span className="text-muted-foreground text-[10px]">· {s.level} · {s.yearsOfExp}yr</span>
              <button id={`ob-skill-remove-${i}`} onClick={() => remove(i)} className="ml-1 rounded hover:text-destructive transition-colors">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
      {state.skills.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">No skills added yet.</p>
      )}
    </div>
  );
}

// ─── Step 3: Experience ───────────────────────────────────────────────────────

function Step3Experience({ state, set }: { state: StepState; set: (k: keyof StepState, v: unknown) => void }) {
  const [draft, setDraft] = useState<ExperienceEntry>({ title: '', company: '', location: '', startDate: '', endDate: '', isCurrent: false, bullets: '', techStack: '' });
  const [adding, setAdding] = useState(false);

  const addExp = () => {
    if (!draft.title.trim() || !draft.company.trim() || !draft.startDate) return;
    set('experiences', [...state.experiences, { ...draft }]);
    setDraft({ title: '', company: '', location: '', startDate: '', endDate: '', isCurrent: false, bullets: '', techStack: '' });
    setAdding(false);
  };

  const remove = (i: number) => set('experiences', state.experiences.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Work Experience</h2>
          <p className="text-sm text-muted-foreground mt-1">Add your roles — the AI uses these for experience-level matching.</p>
        </div>
        {!adding && (
          <Button id="ob-exp-open" onClick={() => setAdding(true)} size="sm" variant="outline" className="gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Add Role
          </Button>
        )}
      </div>

      {adding && (
        <Card className="border-indigo-500/30 bg-card/30">
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Job Title *">
                <Input id="ob-exp-title" value={draft.title} onChange={e => setDraft(d => ({ ...d, title: e.target.value }))} placeholder="Senior Backend Engineer" className="bg-background/60" />
              </Field>
              <Field label="Company *">
                <Input id="ob-exp-company" value={draft.company} onChange={e => setDraft(d => ({ ...d, company: e.target.value }))} placeholder="Acme Corp" className="bg-background/60" />
              </Field>
              <Field label="Location">
                <Input id="ob-exp-location" value={draft.location} onChange={e => setDraft(d => ({ ...d, location: e.target.value }))} placeholder="Riyadh / Remote" className="bg-background/60" />
              </Field>
              <Field label="Start Date *">
                <Input id="ob-exp-start" type="month" value={draft.startDate} onChange={e => setDraft(d => ({ ...d, startDate: e.target.value }))} className="bg-background/60" />
              </Field>
              {!draft.isCurrent && (
                <Field label="End Date">
                  <Input id="ob-exp-end" type="month" value={draft.endDate} onChange={e => setDraft(d => ({ ...d, endDate: e.target.value }))} className="bg-background/60" />
                </Field>
              )}
              <div className="flex items-center gap-2 pt-6">
                <input id="ob-exp-current" type="checkbox" checked={draft.isCurrent} onChange={e => setDraft(d => ({ ...d, isCurrent: e.target.checked, endDate: '' }))} className="rounded" />
                <label htmlFor="ob-exp-current" className="text-sm cursor-pointer">Currently working here</label>
              </div>
            </div>
            <Field label="Key bullets (one per line)">
              <textarea id="ob-exp-bullets" rows={3} value={draft.bullets} onChange={e => setDraft(d => ({ ...d, bullets: e.target.value }))}
                placeholder="Built REST APIs serving 1M requests/day&#10;Reduced query latency by 40% via indexing"
                className="w-full rounded-md border border-input bg-background/60 px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
            </Field>
            <Field label="Tech stack (comma-separated)">
              <Input id="ob-exp-tech" value={draft.techStack} onChange={e => setDraft(d => ({ ...d, techStack: e.target.value }))} placeholder="NestJS, PostgreSQL, Redis, Docker" className="bg-background/60" />
            </Field>
            <div className="flex gap-2 pt-1">
              <Button id="ob-exp-save" onClick={addExp} size="sm" className="gap-1.5"><Plus className="h-3.5 w-3.5" /> Save Role</Button>
              <Button id="ob-exp-cancel" onClick={() => setAdding(false)} size="sm" variant="ghost">Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {state.experiences.length > 0 ? (
        <div className="space-y-3">
          {state.experiences.map((exp, i) => (
            <Card key={i} className="border-border/40 bg-card/30">
              <CardContent className="p-4 flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <p className="font-semibold text-sm">{exp.title}</p>
                  <p className="text-xs text-muted-foreground">{exp.company} · {exp.location}</p>
                  <p className="text-xs text-muted-foreground font-mono">{exp.startDate} → {exp.isCurrent ? 'Present' : exp.endDate}</p>
                </div>
                <button id={`ob-exp-remove-${i}`} onClick={() => remove(i)} className="text-muted-foreground hover:text-destructive transition-colors shrink-0 mt-0.5">
                  <X className="h-4 w-4" />
                </button>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : !adding && (
        <p className="text-sm text-muted-foreground text-center py-4">No experience added yet. Click "Add Role" to start.</p>
      )}
    </div>
  );
}

// ─── Step 4: CV Upload ────────────────────────────────────────────────────────

function Step4CvUpload({ onUploaded }: { onUploaded: (cv: { id: string; label: string }) => void }) {
  const [label, setLabel] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) setFile(f);
  }, []);

  const handleUpload = async () => {
    if (!file || !label.trim()) { setError('Please select a file and give it a label.'); return; }
    setError('');
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('label', label.trim());
      fd.append('isDefault', 'true');
      const result = await api.cvs.upload(fd);
      setDone(true);
      onUploaded(result.cv);
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  if (done) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center">
          <Check className="h-8 w-8 text-emerald-400" />
        </div>
        <p className="font-semibold text-lg">CV uploaded successfully!</p>
        <p className="text-sm text-muted-foreground">You can upload more CVs later from the CVs page.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold">Upload Your CV</h2>
        <p className="text-sm text-muted-foreground mt-1">PDF or DOCX, max 10 MB. You can add multiple CVs (e.g. Backend, Full-Stack) after onboarding.</p>
      </div>

      <Field label="CV Label *">
        <Input id="ob-cv-label" value={label} onChange={e => setLabel(e.target.value)} placeholder='e.g. "Backend NodeJS" or "Full Stack"' className="bg-background/60" />
      </Field>

      {/* Drop zone */}
      <div
        id="ob-cv-dropzone"
        onDrop={handleDrop}
        onDragOver={e => e.preventDefault()}
        onClick={() => fileRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all duration-200 
          ${file ? 'border-indigo-500/60 bg-indigo-500/5' : 'border-border/60 hover:border-indigo-500/40 hover:bg-card/40'}`}
      >
        <div className="w-12 h-12 rounded-full bg-card flex items-center justify-center border border-border/60">
          <Upload className="h-5 w-5 text-muted-foreground" />
        </div>
        {file ? (
          <>
            <p className="font-medium text-sm text-indigo-400">{file.name}</p>
            <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(0)} KB · Click to change</p>
          </>
        ) : (
          <>
            <p className="font-medium text-sm">Drop file here or click to browse</p>
            <p className="text-xs text-muted-foreground">PDF, DOCX, or DOC · Max 10 MB</p>
          </>
        )}
        <input
          ref={fileRef}
          id="ob-cv-file-input"
          type="file"
          accept=".pdf,.docx,.doc,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="hidden"
          onChange={e => setFile(e.target.files?.[0] ?? null)}
        />
      </div>

      {error && (
        <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 rounded-lg px-4 py-3">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <Button id="ob-cv-upload-btn" onClick={handleUpload} disabled={uploading || !file || !label.trim()} className="w-full gap-2">
        {uploading ? <><Loader2 className="h-4 w-4 animate-spin" /> Uploading…</> : <><FileUp className="h-4 w-4" /> Upload CV</>}
      </Button>
    </div>
  );
}

// ─── Step 5: Job Preferences ──────────────────────────────────────────────────

function Step5Preferences({ state, set }: { state: StepState; set: (k: keyof StepState, v: unknown) => void }) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold">Job Preferences</h2>
        <p className="text-sm text-muted-foreground mt-1">These filters determine which opportunities the system qualifies and how it scores location/salary fit.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Target Roles (comma-separated)">
          <Input id="ob-pref-roles" value={state.targetRoles} onChange={e => set('targetRoles', e.target.value)} placeholder="Backend Engineer, Full Stack Engineer" className="bg-background/60" />
        </Field>
        <Field label="Target Countries (comma-separated)">
          <Input id="ob-pref-countries" value={state.targetCountries} onChange={e => set('targetCountries', e.target.value)} placeholder="Saudi Arabia, UAE, Remote" className="bg-background/60" />
        </Field>
        <Field label="Minimum Salary (USD/year)">
          <Input id="ob-pref-salary" type="number" value={state.minSalaryUsd} onChange={e => set('minSalaryUsd', e.target.value)} placeholder="60000" className="bg-background/60" />
        </Field>
        <Field label="Preferred Industries (comma-separated)">
          <Input id="ob-pref-industries" value={state.preferredIndustries} onChange={e => set('preferredIndustries', e.target.value)} placeholder="Fintech, SaaS, Government IT" className="bg-background/60" />
        </Field>
      </div>
      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input
          id="ob-pref-remote"
          type="checkbox"
          checked={state.remoteOk}
          onChange={e => set('remoteOk', e.target.checked)}
          className="rounded border-input"
        />
        <span className="text-sm">Open to remote / hybrid roles</span>
      </label>
    </div>
  );
}

// ─── Main Onboarding Page ─────────────────────────────────────────────────────

function splitCsv(s: string): string[] {
  return s.split(',').map(t => t.trim()).filter(Boolean);
}

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [state, setState] = useState<StepState>(INITIAL);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [cvUploaded, setCvUploaded] = useState(false);

  React.useEffect(() => {
    api.profile.get().then(p => {
      if (p) {
        setState(prev => ({
          ...prev,
          fullName: p.fullName ?? '',
          headline: p.headline ?? '',
          summary: p.summary ?? '',
          phone: p.phone ?? '',
          location: p.location ?? '',
          country: p.country ?? '',
          linkedinUrl: p.linkedinUrl ?? '',
          githubUrl: p.githubUrl ?? '',
          portfolioUrl: p.portfolioUrl ?? '',
          visaStatus: p.visaStatus ?? '',
          noticePeriodDays: p.noticePeriodDays ? String(p.noticePeriodDays) : '',
          willingToRelocate: p.willingToRelocate ?? false,
          telegramChatId: p.telegramChatId ?? '',
        }));
      }
    }).catch(err => {
      if (err instanceof ApiClientError && err.statusCode === 401) {
        router.push('/login');
      }
    });
  }, [router]);

  const set = useCallback((k: keyof StepState, v: unknown) => {
    setState(prev => ({ ...prev, [k]: v }));
  }, []);

  const next = () => setStep(s => Math.min(s + 1, 5));
  const back = () => setStep(s => Math.max(s - 1, 1));

  const saveStep = async () => {
    setError('');
    setSaving(true);
    try {
      if (step === 1) {
        await api.profile.upsert({
          fullName: state.fullName || undefined,
          headline: state.headline || undefined,
          summary: state.summary || undefined,
          phone: state.phone || undefined,
          location: state.location || undefined,
          country: state.country || undefined,
          linkedinUrl: state.linkedinUrl || undefined,
          githubUrl: state.githubUrl || undefined,
          portfolioUrl: state.portfolioUrl || undefined,
          visaStatus: state.visaStatus || undefined,
          noticePeriodDays: state.noticePeriodDays ? Number(state.noticePeriodDays) : undefined,
          willingToRelocate: state.willingToRelocate,
          telegramChatId: state.telegramChatId || undefined,
        });
        next();
      } else if (step === 2) {
        // Save skills sequentially
        for (const skill of state.skills) {
          await api.skills.create({
            name: skill.name,
            level: skill.level,
            yearsOfExp: skill.yearsOfExp,
            category: skill.category || undefined,
          } as Parameters<typeof api.skills.create>[0]);
        }
        next();
      } else if (step === 3) {
        for (const exp of state.experiences) {
          await api.experience.create({
            title: exp.title,
            company: exp.company,
            location: exp.location || undefined,
            startDate: new Date(exp.startDate).toISOString(),
            endDate: exp.endDate ? new Date(exp.endDate).toISOString() : undefined,
            isCurrent: exp.isCurrent,
            bullets: exp.bullets.split('\n').map(l => l.trim()).filter(Boolean),
            techStack: splitCsv(exp.techStack),
          } as Parameters<typeof api.experience.create>[0]);
        }
        next();
      } else if (step === 4) {
        // CV upload is handled inside Step4CvUpload component — just proceed
        next();
      } else if (step === 5) {
        // Save preferences + mark onboarding done
        await api.preferences.upsert({
          targetRoles: splitCsv(state.targetRoles),
          targetCountries: splitCsv(state.targetCountries),
          minSalaryUsd: state.minSalaryUsd ? Number(state.minSalaryUsd) : undefined,
          remoteOk: state.remoteOk,
          preferredIndustries: splitCsv(state.preferredIndustries),
        });
        await api.profile.upsert({ onboardingDone: true });
        router.push('/');
      }
    } catch (e) {
      if (e instanceof ApiClientError && e.statusCode === 401) {
        router.push('/login');
        return;
      }
      setError(e instanceof ApiClientError ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const isStep4 = step === 4;
  const canProceedStep4 = isStep4 && cvUploaded;

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
      <div className="w-full max-w-3xl">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-medium mb-4">
            <span className="animate-pulse">●</span> One-time setup
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
            Build Your Agent Brain
          </h1>
          <p className="text-muted-foreground text-sm mt-2">
            Fill this once — the AI uses it for every match, score, and application it generates.
          </p>
        </div>

        <StepIndicator current={step} />

        <Card className="border-border/40 bg-card/30 backdrop-blur-sm shadow-2xl">
          <CardContent className="p-8">
            {step === 1 && <Step1Profile state={state} set={set} />}
            {step === 2 && <Step2Skills state={state} set={set} />}
            {step === 3 && <Step3Experience state={state} set={set} />}
            {step === 4 && (
              <Step4CvUpload onUploaded={() => setCvUploaded(true)} />
            )}
            {step === 5 && <Step5Preferences state={state} set={set} />}

            {error && (
              <div className="mt-4 flex items-center gap-2 text-destructive text-sm bg-destructive/10 rounded-lg px-4 py-3">
                <AlertCircle className="h-4 w-4 shrink-0" /><span>{error}</span>
              </div>
            )}

            {/* Navigation */}
            <div className="flex items-center justify-between mt-8 pt-6 border-t border-border/40">
              <Button
                id="ob-back"
                variant="ghost"
                onClick={back}
                disabled={step === 1 || saving}
                className="gap-2"
              >
                <ChevronLeft className="h-4 w-4" /> Back
              </Button>

              <div className="flex items-center gap-3">
                {isStep4 && !cvUploaded && (
                  <Button
                    id="ob-skip-cv"
                    variant="ghost"
                    onClick={next}
                    disabled={saving}
                    className="text-muted-foreground text-sm"
                  >
                    Skip for now
                  </Button>
                )}
                <Button
                  id="ob-next"
                  onClick={saveStep}
                  disabled={saving || (isStep4 && !cvUploaded && false) /* skip allowed */}
                  className="gap-2 min-w-32"
                >
                  {saving ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</>
                  ) : step === 5 ? (
                    <><Check className="h-4 w-4" /> Finish Setup</>
                  ) : (
                    <>Continue <ChevronRight className="h-4 w-4" /></>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-4">
          You can edit all of this later from the Profile page.
        </p>
      </div>
    </div>
  );
}
