'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  User,
  Briefcase,
  Wrench,
  SlidersHorizontal,
  ChevronRight,
  ChevronLeft,
  Check,
  Plus,
  X,
  Upload,
  Loader2,
  AlertCircle,
  Sparkles,
  FileText,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { api, ApiClientError, Cv } from '@/lib/api-client';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SkillEntry {
  name: string;
  level: 'BEGINNER' | 'INTERMEDIATE' | 'EXPERT';
  yearsOfExp: number;
  category: string;
}

interface ExperienceEntry {
  title: string;
  company: string;
  location: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  bullets: string;
  techStack: string;
}

interface StepState {
  fullName: string;
  headline: string;
  summary: string;
  phone: string;
  location: string;
  country: string;
  linkedinUrl: string;
  githubUrl: string;
  portfolioUrl: string;
  visaStatus: string;
  noticePeriodDays: string;
  willingToRelocate: boolean;
  telegramChatId: string;
  skills: SkillEntry[];
  experiences: ExperienceEntry[];
  targetRoles: string;
  targetCountries: string;
  minSalaryUsd: string;
  remoteOk: boolean;
  preferredIndustries: string;
}

const INITIAL: StepState = {
  fullName: '',
  headline: '',
  summary: '',
  phone: '',
  location: '',
  country: '',
  linkedinUrl: '',
  githubUrl: '',
  portfolioUrl: '',
  visaStatus: '',
  noticePeriodDays: '',
  willingToRelocate: false,
  telegramChatId: '',
  skills: [],
  experiences: [],
  targetRoles: '',
  targetCountries: '',
  minSalaryUsd: '',
  remoteOk: true,
  preferredIndustries: '',
};

const STEPS = [
  { id: 1, label: 'Profile', icon: User },
  { id: 2, label: 'Skills', icon: Wrench },
  { id: 3, label: 'Experience', icon: Briefcase },
  { id: 4, label: 'Preferences', icon: SlidersHorizontal },
];

function splitCsv(val: string): string[] {
  return val
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseDateSafe(d?: string): string | undefined {
  if (!d) return undefined;
  const s = d.trim();
  if (/^\d{4}$/.test(s)) return new Date(`${s}-01-01`).toISOString();
  if (/^\d{4}-\d{2}$/.test(s)) return new Date(`${s}-01`).toISOString();
  const parsed = new Date(s);
  return isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        {label}
      </label>
      {children}
    </div>
  );
}

function StepIndicator({ current, total = 4 }: { current: number; total?: number }) {
  return (
    <div className="flex items-center gap-2 mb-8">
      {STEPS.slice(0, total).map((step, i) => {
        const Icon = step.icon;
        const done = current > step.id;
        const active = current === step.id;
        return (
          <React.Fragment key={step.id}>
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all duration-300
                ${
                  done
                    ? 'bg-emerald-500 border-emerald-500 text-white'
                    : active
                      ? 'bg-indigo-500/20 border-indigo-500 text-indigo-400'
                      : 'bg-card border-border text-muted-foreground'
                }`}
              >
                {done ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
              </div>
              <span
                className={`text-[10px] font-medium ${
                  active
                    ? 'text-indigo-400'
                    : done
                      ? 'text-emerald-400'
                      : 'text-muted-foreground'
                }`}
              >
                {step.label}
              </span>
            </div>
            {i < total - 1 && (
              <div
                className={`flex-1 h-px mb-5 transition-all duration-300 ${
                  done ? 'bg-emerald-500/60' : 'bg-border'
                }`}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ─── Step 1: Basic Profile ────────────────────────────────────────────────────

function Step1Profile({
  state,
  set,
}: {
  state: StepState;
  set: (k: keyof StepState, v: unknown) => void;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold">Basic Profile</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Review and adjust your profile details. The AI uses this as the foundation for matching and applications.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Full Name *">
          <Input
            id="ob-fullname"
            value={state.fullName}
            onChange={(e) => set('fullName', e.target.value)}
            placeholder="Ghulam Ghaus"
            className="bg-background/60"
          />
        </Field>
        <Field label="Professional Headline">
          <Input
            id="ob-headline"
            value={state.headline}
            onChange={(e) => set('headline', e.target.value)}
            placeholder="Senior Full-Stack Engineer | NestJS · Next.js"
            className="bg-background/60"
          />
        </Field>
        <Field label="Phone">
          <Input
            id="ob-phone"
            value={state.phone}
            onChange={(e) => set('phone', e.target.value)}
            placeholder="+966 5x xxx xxxx"
            className="bg-background/60"
          />
        </Field>
        <Field label="Location / City">
          <Input
            id="ob-location"
            value={state.location}
            onChange={(e) => set('location', e.target.value)}
            placeholder="Riyadh"
            className="bg-background/60"
          />
        </Field>
        <Field label="Country">
          <Input
            id="ob-country"
            value={state.country}
            onChange={(e) => set('country', e.target.value)}
            placeholder="Saudi Arabia"
            className="bg-background/60"
          />
        </Field>
        <Field label="Visa / Work Authorization">
          <Input
            id="ob-visa"
            value={state.visaStatus}
            onChange={(e) => set('visaStatus', e.target.value)}
            placeholder="e.g. Iqama (Transferable), Citizen, Work Visa"
            className="bg-background/60"
          />
        </Field>
        <Field label="Notice Period (days)">
          <Input
            id="ob-notice"
            type="number"
            value={state.noticePeriodDays}
            onChange={(e) => set('noticePeriodDays', e.target.value)}
            placeholder="30"
            className="bg-background/60"
          />
        </Field>
        <Field label="Telegram Chat ID (optional)">
          <Input
            id="ob-telegram"
            value={state.telegramChatId}
            onChange={(e) => set('telegramChatId', e.target.value)}
            placeholder="Link later via bot"
            className="bg-background/60"
          />
        </Field>
        <Field label="LinkedIn Profile / URL">
          <Input
            id="ob-linkedin"
            value={state.linkedinUrl}
            onChange={(e) => set('linkedinUrl', e.target.value)}
            placeholder="https://linkedin.com/in/..."
            className="bg-background/60"
          />
        </Field>
        <Field label="GitHub URL">
          <Input
            id="ob-github"
            value={state.githubUrl}
            onChange={(e) => set('githubUrl', e.target.value)}
            placeholder="https://github.com/..."
            className="bg-background/60"
          />
        </Field>
      </div>
      <Field label="Professional Summary / Bio">
        <textarea
          id="ob-summary"
          rows={4}
          value={state.summary}
          onChange={(e) => set('summary', e.target.value)}
          placeholder="Experienced full-stack engineer specialising in NestJS backends and Next.js frontends..."
          className="w-full rounded-md border border-input bg-background/60 px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
        />
      </Field>
      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input
          id="ob-relocate"
          type="checkbox"
          checked={state.willingToRelocate}
          onChange={(e) => set('willingToRelocate', e.target.checked)}
          className="rounded border-input"
        />
        <span className="text-sm">Willing to relocate internationally</span>
      </label>
    </div>
  );
}

// ─── Step 2: Skills ───────────────────────────────────────────────────────────

const SKILL_LEVELS: SkillEntry['level'][] = ['BEGINNER', 'INTERMEDIATE', 'EXPERT'];

function Step2Skills({
  state,
  set,
}: {
  state: StepState;
  set: (k: keyof StepState, v: unknown) => void;
}) {
  const [draft, setDraft] = useState<SkillEntry>({
    name: '',
    level: 'INTERMEDIATE',
    yearsOfExp: 1,
    category: '',
  });

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
        <p className="text-sm text-muted-foreground mt-1">
          Review extracted skills and add any additional competencies. The scoring engine evaluates your technical fit against these.
        </p>
      </div>

      {/* Add skill form */}
      <Card className="border-border/40 bg-card/30">
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="col-span-2">
              <Field label="Skill name">
                <Input
                  id="ob-skill-name"
                  value={draft.name}
                  onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                  onKeyDown={(e) => e.key === 'Enter' && addSkill()}
                  placeholder="e.g. NestJS"
                  className="bg-background/60"
                />
              </Field>
            </div>
            <Field label="Level">
              <select
                id="ob-skill-level"
                value={draft.level}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, level: e.target.value as SkillEntry['level'] }))
                }
                className="w-full h-9 rounded-md border border-input bg-background/60 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {SKILL_LEVELS.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Years of Exp">
              <Input
                id="ob-skill-years"
                type="number"
                min="0"
                step="0.5"
                value={draft.yearsOfExp}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, yearsOfExp: Number(e.target.value) || 0 }))
                }
                className="bg-background/60"
              />
            </Field>
          </div>
          <div className="flex justify-end">
            <Button
              id="ob-add-skill-btn"
              type="button"
              variant="outline"
              size="sm"
              onClick={addSkill}
              className="gap-1.5"
            >
              <Plus className="h-4 w-4" /> Add Skill
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Skills list */}
      {state.skills.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">No skills added yet.</p>
      ) : (
        <div className="flex flex-wrap gap-2 pt-2">
          {state.skills.map((s, i) => (
            <Badge
              key={i}
              variant="secondary"
              className="pl-3 pr-1.5 py-1 text-xs gap-1.5 bg-card border border-border/60 hover:border-indigo-500/40 transition-colors"
            >
              <span className="font-medium">{s.name}</span>
              <span className="text-[10px] text-muted-foreground">({s.yearsOfExp}y)</span>
              <span
                className={`text-[9px] px-1 py-0.5 rounded font-mono ${
                  s.level === 'EXPERT'
                    ? 'bg-purple-500/20 text-purple-400'
                    : s.level === 'INTERMEDIATE'
                      ? 'bg-blue-500/20 text-blue-400'
                      : 'bg-muted text-muted-foreground'
                }`}
              >
                {s.level.slice(0, 3)}
              </span>
              <button
                type="button"
                onClick={() => remove(i)}
                className="hover:text-destructive transition-colors ml-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Step 3: Experience ───────────────────────────────────────────────────────

function Step3Experience({
  state,
  set,
}: {
  state: StepState;
  set: (k: keyof StepState, v: unknown) => void;
}) {
  const [editing, setEditing] = useState<ExperienceEntry | null>(null);

  const emptyDraft: ExperienceEntry = {
    title: '',
    company: '',
    location: '',
    startDate: '',
    endDate: '',
    isCurrent: false,
    bullets: '',
    techStack: '',
  };

  const saveExp = (entry: ExperienceEntry) => {
    if (!entry.title.trim() || !entry.company.trim()) return;
    set('experiences', [...state.experiences, entry]);
    setEditing(null);
  };

  const remove = (i: number) =>
    set('experiences', state.experiences.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Work Experience</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Review past roles extracted from your CV. Every claim in generated proposals traces back to these records.
          </p>
        </div>
        <Button
          id="ob-add-exp-btn"
          size="sm"
          variant="outline"
          onClick={() => setEditing({ ...emptyDraft })}
          className="gap-1.5"
        >
          <Plus className="h-4 w-4" /> Add Role
        </Button>
      </div>

      {editing && (
        <Card className="border-indigo-500/40 bg-indigo-500/5">
          <CardContent className="p-4 space-y-4">
            <h3 className="text-sm font-semibold text-indigo-400">Add Experience</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Title / Role *">
                <Input
                  id="ob-exp-title"
                  value={editing.title}
                  onChange={(e) => setEditing((d) => d && { ...d, title: e.target.value })}
                  placeholder="Senior Software Engineer"
                  className="bg-background/60"
                />
              </Field>
              <Field label="Company *">
                <Input
                  id="ob-exp-company"
                  value={editing.company}
                  onChange={(e) => setEditing((d) => d && { ...d, company: e.target.value })}
                  placeholder="Acme Corp"
                  className="bg-background/60"
                />
              </Field>
              <Field label="Location">
                <Input
                  id="ob-exp-location"
                  value={editing.location}
                  onChange={(e) => setEditing((d) => d && { ...d, location: e.target.value })}
                  placeholder="Riyadh, Saudi Arabia"
                  className="bg-background/60"
                />
              </Field>
              <Field label="Tech Stack (comma-separated)">
                <Input
                  id="ob-exp-tech"
                  value={editing.techStack}
                  onChange={(e) => setEditing((d) => d && { ...d, techStack: e.target.value })}
                  placeholder="Node.js, PostgreSQL, Docker, AWS"
                  className="bg-background/60"
                />
              </Field>
              <Field label="Start Date (YYYY-MM)">
                <Input
                  id="ob-exp-start"
                  value={editing.startDate}
                  onChange={(e) => setEditing((d) => d && { ...d, startDate: e.target.value })}
                  placeholder="2022-01"
                  className="bg-background/60"
                />
              </Field>
              <Field label="End Date (YYYY-MM)">
                <Input
                  id="ob-exp-end"
                  value={editing.endDate}
                  disabled={editing.isCurrent}
                  onChange={(e) => setEditing((d) => d && { ...d, endDate: e.target.value })}
                  placeholder={editing.isCurrent ? 'Present' : '2024-03'}
                  className="bg-background/60"
                />
              </Field>
            </div>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                id="ob-exp-current"
                type="checkbox"
                checked={editing.isCurrent}
                onChange={(e) =>
                  setEditing((d) => d && { ...d, isCurrent: e.target.checked, endDate: '' })
                }
                className="rounded border-input"
              />
              <span className="text-sm">I currently work here</span>
            </label>
            <Field label="Key Achievements / Bullets (one per line)">
              <textarea
                id="ob-exp-bullets"
                rows={3}
                value={editing.bullets}
                onChange={(e) => setEditing((d) => d && { ...d, bullets: e.target.value })}
                placeholder="• Architected microservices pipeline handling 50k req/min&#10;• Reduced latency by 42%..."
                className="w-full rounded-md border border-input bg-background/60 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              />
            </Field>
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEditing(null)}
              >
                Cancel
              </Button>
              <Button
                id="ob-save-exp-btn"
                size="sm"
                onClick={() => saveExp(editing)}
                disabled={!editing.title.trim() || !editing.company.trim()}
              >
                Add Role
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Experience list */}
      <div className="space-y-3">
        {state.experiences.length === 0 && !editing && (
          <p className="text-xs text-muted-foreground text-center py-6">
            No work experiences added yet.
          </p>
        )}
        {state.experiences.map((exp, i) => (
          <Card key={i} className="border-border/40 bg-card/30">
            <CardContent className="p-4 flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm">{exp.title}</span>
                  <span className="text-muted-foreground text-xs">@ {exp.company}</span>
                  {exp.isCurrent && (
                    <Badge variant="outline" className="text-[10px] text-emerald-400 border-emerald-500/40">
                      Current
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {exp.startDate} – {exp.isCurrent ? 'Present' : exp.endDate || 'Present'}
                  {exp.location ? ` · ${exp.location}` : ''}
                </p>
                {exp.techStack && (
                  <p className="text-xs text-indigo-400 font-mono">
                    {exp.techStack}
                  </p>
                )}
                {exp.bullets && (
                  <div className="text-xs text-muted-foreground whitespace-pre-line mt-1">
                    {exp.bullets}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => remove(i)}
                className="text-muted-foreground hover:text-destructive transition-colors shrink-0 p-1"
              >
                <X className="h-4 w-4" />
              </button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ─── Step 4: Job Preferences ──────────────────────────────────────────────────

function Step4Preferences({
  state,
  set,
}: {
  state: StepState;
  set: (k: keyof StepState, v: unknown) => void;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold">Target Preferences</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Define what opportunities you are targeting. The scoring engine uses these to qualify incoming jobs.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Target Roles (comma-separated)">
          <Input
            id="ob-target-roles"
            value={state.targetRoles}
            onChange={(e) => set('targetRoles', e.target.value)}
            placeholder="Backend Engineer, Full-Stack Lead, Node.js Architect"
            className="bg-background/60"
          />
        </Field>
        <Field label="Target Countries (comma-separated)">
          <Input
            id="ob-target-countries"
            value={state.targetCountries}
            onChange={(e) => set('targetCountries', e.target.value)}
            placeholder="Saudi Arabia, UAE, Qatar, Remote"
            className="bg-background/60"
          />
        </Field>
        <Field label="Minimum Salary (USD/month)">
          <Input
            id="ob-min-salary"
            type="number"
            value={state.minSalaryUsd}
            onChange={(e) => set('minSalaryUsd', e.target.value)}
            placeholder="5000"
            className="bg-background/60"
          />
        </Field>
        <Field label="Preferred Industries">
          <Input
            id="ob-industries"
            value={state.preferredIndustries}
            onChange={(e) => set('preferredIndustries', e.target.value)}
            placeholder="Fintech, SaaS, AI, HealthTech"
            className="bg-background/60"
          />
        </Field>
      </div>
      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input
          id="ob-remote"
          type="checkbox"
          checked={state.remoteOk}
          onChange={(e) => set('remoteOk', e.target.checked)}
          className="rounded border-input"
        />
        <span className="text-sm">Open to remote roles</span>
      </label>
    </div>
  );
}

// ─── Main Onboarding Page ─────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [state, setState] = useState<StepState>(INITIAL);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // CV Upload & Auto-fill states
  const [uploadedCv, setUploadedCv] = useState<Cv | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgressText, setUploadProgressText] = useState('');
  const [showManual, setShowManual] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Load existing profile if any
  useEffect(() => {
    api.profile
      .get()
      .then((p) => {
        if (p) {
          setState((prev) => ({
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
      })
      .catch((err) => {
        if (err instanceof ApiClientError && err.statusCode === 401) {
          router.push('/login');
        }
      });
  }, [router]);

  const set = useCallback((k: keyof StepState, v: unknown) => {
    setState((prev) => ({ ...prev, [k]: v }));
  }, []);

  const handleCvSelect = async (file: File) => {
    setError('');
    setUploading(true);
    setUploadProgressText('Uploading document...');

    try {
      const formData = new FormData();
      formData.append('file', file);

      setTimeout(() => {
        setUploadProgressText('Extracting CV text & skills with AI...');
      }, 1200);

      const res = await api.cvs.parse(formData);
      setUploadedCv(res.cv);

      const { profile, skills, experiences, preferences } = res.parsed;

      // Populate state with extracted data
      setState((prev) => ({
        ...prev,
        fullName: profile?.fullName || prev.fullName,
        headline: profile?.headline || prev.headline,
        summary: profile?.summary || prev.summary,
        phone: profile?.phone || prev.phone,
        location: profile?.location || prev.location,
        country: profile?.country || prev.country,
        linkedinUrl: profile?.linkedinUrl || prev.linkedinUrl,
        githubUrl: profile?.githubUrl || prev.githubUrl,
        portfolioUrl: profile?.portfolioUrl || prev.portfolioUrl,
        visaStatus: profile?.visaStatus || prev.visaStatus,
        noticePeriodDays: profile?.noticePeriodDays
          ? String(profile.noticePeriodDays)
          : prev.noticePeriodDays,
        willingToRelocate: profile?.willingToRelocate ?? prev.willingToRelocate,
        skills:
          skills && skills.length > 0
            ? skills.map((s) => ({
                name: s.name,
                level: s.level,
                yearsOfExp: s.yearsOfExp ?? 1,
                category: s.category || 'General',
              }))
            : prev.skills,
        experiences:
          experiences && experiences.length > 0
            ? experiences.map((e) => ({
                title: e.title,
                company: e.company,
                location: e.location || '',
                startDate: e.startDate,
                endDate: e.endDate || '',
                isCurrent: e.isCurrent ?? false,
                bullets: Array.isArray(e.bullets) ? e.bullets.join('\n') : String(e.bullets || ''),
                techStack: Array.isArray(e.techStack) ? e.techStack.join(', ') : String(e.techStack || ''),
              }))
            : prev.experiences,
        targetRoles:
          preferences?.targetRoles && preferences.targetRoles.length > 0
            ? preferences.targetRoles.join(', ')
            : prev.targetRoles,
        targetCountries:
          preferences?.targetCountries && preferences.targetCountries.length > 0
            ? preferences.targetCountries.join(', ')
            : prev.targetCountries,
        minSalaryUsd: preferences?.minSalaryUsd ? String(preferences.minSalaryUsd) : prev.minSalaryUsd,
        remoteOk: preferences?.remoteOk ?? prev.remoteOk,
        preferredIndustries:
          preferences?.preferredIndustries && preferences.preferredIndustries.length > 0
            ? preferences.preferredIndustries.join(', ')
            : prev.preferredIndustries,
      }));

      // Switch to review mode at step 1
      setShowManual(true);
      setStep(1);
    } catch (e) {
      setError(
        e instanceof ApiClientError
          ? e.message
          : 'Failed to parse CV. You can continue by filling in details manually.',
      );
    } finally {
      setUploading(false);
      setUploadProgressText('');
    }
  };

  const next = () => setStep((s) => Math.min(s + 1, 4));
  const back = () => setStep((s) => Math.max(s - 1, 1));

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
        for (const skill of state.skills) {
          await api.skills
            .create({
              name: skill.name,
              level: skill.level,
              yearsOfExp: skill.yearsOfExp,
              category: skill.category || undefined,
            } as Parameters<typeof api.skills.create>[0])
            .catch(() => {});
        }
        next();
      } else if (step === 3) {
        for (const exp of state.experiences) {
          const startDate = parseDateSafe(exp.startDate) || new Date().toISOString();
          const endDate = exp.isCurrent ? undefined : parseDateSafe(exp.endDate);
          await api.experience
            .create({
              title: exp.title,
              company: exp.company,
              location: exp.location || undefined,
              startDate,
              endDate,
              isCurrent: exp.isCurrent,
              bullets: exp.bullets.split('\n').map((l) => l.trim()).filter(Boolean),
              techStack: splitCsv(exp.techStack),
            } as Parameters<typeof api.experience.create>[0])
            .catch(() => {});
        }
        next();
      } else if (step === 4) {
        await api.preferences.upsert({
          targetRoles: splitCsv(state.targetRoles),
          targetCountries: splitCsv(state.targetCountries),
          minSalaryUsd: state.minSalaryUsd ? Number(state.minSalaryUsd) : undefined,
          remoteOk: state.remoteOk,
          preferredIndustries: splitCsv(state.preferredIndustries),
        });
        await api.profile.upsert({ onboardingDone: true });
        router.push('/profile');
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

  // ─── Initial CV Landing View ────────────────────────────────────────────────
  if (!showManual && !uploadedCv) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
        <div className="w-full max-w-2xl">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-medium mb-4">
              <Sparkles className="h-3.5 w-3.5 animate-pulse" /> AI-Powered Onboarding
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-400 via-purple-300 to-indigo-200 bg-clip-text text-transparent">
              Build Your Agent Brain
            </h1>
            <p className="text-muted-foreground text-sm mt-2 max-w-md mx-auto">
              Upload your CV and our AI will automatically extract your profile, skills, work history, and target preferences.
            </p>
          </div>

          <Card className="border-border/40 bg-card/30 backdrop-blur-sm shadow-2xl">
            <CardContent className="p-8">
              {uploading ? (
                <div className="py-16 flex flex-col items-center justify-center gap-4 text-center">
                  <div className="relative">
                    <div className="w-16 h-16 rounded-full border-2 border-indigo-500/30 border-t-indigo-500 animate-spin flex items-center justify-center" />
                    <Sparkles className="h-6 w-6 text-indigo-400 absolute inset-0 m-auto animate-pulse" />
                  </div>
                  <div className="space-y-1 mt-2">
                    <p className="font-medium text-base text-foreground">
                      {uploadProgressText || 'Parsing CV with AI…'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Structuring your career history, skills, and match preferences
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Drop zone */}
                  <div
                    id="ob-initial-dropzone"
                    onDrop={(e) => {
                      e.preventDefault();
                      const file = e.dataTransfer.files?.[0];
                      if (file) handleCvSelect(file);
                    }}
                    onDragOver={(e) => e.preventDefault()}
                    onClick={() => fileRef.current?.click()}
                    className="border-2 border-dashed border-indigo-500/30 hover:border-indigo-500/60 bg-indigo-500/5 hover:bg-indigo-500/10 rounded-2xl p-12 flex flex-col items-center justify-center gap-4 cursor-pointer transition-all duration-300 group"
                  >
                    <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center group-hover:scale-105 transition-transform duration-300">
                      <Upload className="h-8 w-8 text-indigo-400" />
                    </div>
                    <div className="text-center space-y-1">
                      <p className="font-semibold text-base text-foreground">
                        Drop your CV here, or browse
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Supports PDF, Word (.docx, .doc) · Up to 10 MB
                      </p>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="outline" className="text-[11px] bg-background/50 border-border/60">
                        PDF
                      </Badge>
                      <Badge variant="outline" className="text-[11px] bg-background/50 border-border/60">
                        DOCX
                      </Badge>
                      <Badge variant="outline" className="text-[11px] bg-background/50 border-border/60">
                        Instant AI Parse
                      </Badge>
                    </div>
                    <input
                      ref={fileRef}
                      type="file"
                      accept=".pdf,.docx,.doc,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleCvSelect(file);
                      }}
                    />
                  </div>

                  {error && (
                    <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 rounded-lg px-4 py-3">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2">
                    <Button
                      id="ob-enter-manually"
                      variant="ghost"
                      onClick={() => setShowManual(true)}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      Skip & fill details manually
                    </Button>
                    <Button
                      onClick={() => fileRef.current?.click()}
                      className="gap-2 bg-indigo-600 hover:bg-indigo-500 text-white"
                    >
                      <FileText className="h-4 w-4" /> Select CV File
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ─── Review & Edit Wizard ───────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
      <div className="w-full max-w-3xl">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-medium mb-3">
            <span className="animate-pulse">●</span> Step-by-step review
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
            {uploadedCv ? 'Review & Confirm Profile' : 'Build Your Agent Brain'}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {uploadedCv
              ? 'We extracted your details from your CV. Review, tweak, and save.'
              : 'Fill this once — the AI uses it for every match, score, and application.'}
          </p>
        </div>

        {/* CV Banner if uploaded */}
        {uploadedCv && (
          <div className="mb-6 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                <Check className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-emerald-400">
                  CV Auto-filled: {uploadedCv.filename}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Profile, {state.skills.length} skills, and {state.experiences.length} roles extracted
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setUploadedCv(null);
                setShowManual(false);
              }}
              className="text-xs gap-1.5 text-muted-foreground hover:text-foreground h-8"
            >
              <RefreshCw className="h-3 w-3" /> Upload different CV
            </Button>
          </div>
        )}

        <StepIndicator current={step} total={4} />

        <Card className="border-border/40 bg-card/30 backdrop-blur-sm shadow-2xl">
          <CardContent className="p-8">
            {step === 1 && <Step1Profile state={state} set={set} />}
            {step === 2 && <Step2Skills state={state} set={set} />}
            {step === 3 && <Step3Experience state={state} set={set} />}
            {step === 4 && <Step4Preferences state={state} set={set} />}

            {error && (
              <div className="mt-4 flex items-center gap-2 text-destructive text-sm bg-destructive/10 rounded-lg px-4 py-3">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
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

              <Button
                id="ob-next"
                onClick={saveStep}
                disabled={saving}
                className="gap-2 min-w-32 bg-indigo-600 hover:bg-indigo-500 text-white"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Saving…
                  </>
                ) : step === 4 ? (
                  <>
                    <Check className="h-4 w-4" /> Finish & Launch
                  </>
                ) : (
                  <>
                    Continue <ChevronRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-4">
          You can edit and update all of this at any time from your Profile & Settings.
        </p>
      </div>
    </div>
  );
}
