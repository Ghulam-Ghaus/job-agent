'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  GraduationCap,
  Sparkles,
  CheckCircle2,
  BookOpen,
  HelpCircle,
  ShieldAlert,
  MessageSquare,
  Loader2,
  Trash2,
  Building,
  Flame,
  Check,
  Zap,
  Clock,
  Copy,
  Bookmark,
  BookmarkCheck,
  Send,
  RotateCcw,
  SlidersHorizontal,
  Code2,
  Bot,
  ChevronRight,
} from 'lucide-react';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import {
  api,
  type InterviewPrep,
  type PrepTask,
  type CoachedAnswer,
  type CoachMode,
} from '@/lib/api-client';

const PRESET_CATEGORIES = [
  { id: 'all', label: 'All Topics' },
  { id: 'architecture', label: 'System Design & Auth' },
  { id: 'devops', label: 'Docker & DevOps' },
  { id: 'languages', label: 'JS & Python' },
  { id: 'ai', label: 'AI, Agents & FSM' },
  { id: 'profile', label: 'Profile & Behavioral' },
];

const PRESET_QUESTIONS = [
  {
    category: 'profile',
    text: 'Tell me about yourself and your journey in software engineering.',
  },
  {
    category: 'ai',
    text: 'Explain your work in Generative AI, AI Agents, MCP, and Multi-Agent systems.',
  },
  {
    category: 'ai',
    text: 'How did you build the real-time voice intake platform with sub-second response times?',
  },
  {
    category: 'ai',
    text: 'Why did you design deterministic FSM state machines instead of using unconstrained LLM prompts?',
  },
  {
    category: 'architecture',
    text: 'What is the difference between Authentication and Authorization?',
  },
  {
    category: 'architecture',
    text: 'Explain System Design principles for building high-concurrency microservices.',
  },
  {
    category: 'architecture',
    text: 'What core design patterns do you use in backend architecture?',
  },
  {
    category: 'architecture',
    text: 'How do you handle database indexing and query optimization in PostgreSQL?',
  },
  {
    category: 'architecture',
    text: 'Explain Agile and Scrum practices you follow for sprint estimations and delivery.',
  },
  {
    category: 'devops',
    text: 'How do you use Docker in development and production?',
  },
  {
    category: 'devops',
    text: 'What is Kubernetes and when would you choose it over serverless or AWS ECS?',
  },
  {
    category: 'devops',
    text: 'Explain your CI/CD deployment pipeline and zero-downtime release strategies.',
  },
  {
    category: 'devops',
    text: 'How do you design event-driven serverless architectures with AWS Lambda and API Gateway?',
  },
  {
    category: 'languages',
    text: 'Explain the Node.js Event Loop and how it handles asynchronous I/O and blocking tasks.',
  },
  {
    category: 'languages',
    text: 'What is the difference between asynchronous concurrency in Python and Node.js?',
  },
];

function InterviewPrepContent() {
  const searchParams = useSearchParams();
  const queryOppId = searchParams.get('opportunityId');
  const queryRole = searchParams.get('role');

  const [preps, setPreps] = useState<InterviewPrep[]>([]);
  const [selectedPrep, setSelectedPrep] = useState<InterviewPrep | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [targetRole, setTargetRole] = useState(queryRole || '');
  const [jobDescription, setJobDescription] = useState('');
  const [activeTab, setActiveTab] = useState<'coach' | 'tasks' | 'topics' | 'questions' | 'gaps' | 'questionsToAsk'>('coach');
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // AI Coach Sandbox state
  const [coachQuestion, setCoachQuestion] = useState('');
  const [coachMode, setCoachMode] = useState<CoachMode>('standard');
  const [coachComment, setCoachComment] = useState('');
  const [coachedAnswer, setCoachedAnswer] = useState<CoachedAnswer | null>(null);
  const [coachLoading, setCoachLoading] = useState(false);
  const [coachSaving, setCoachSaving] = useState(false);
  const [coachError, setCoachError] = useState<string | null>(null);
  const [savedSuccess, setSavedSuccess] = useState<string | null>(null);
  const [copiedAnswer, setCopiedAnswer] = useState(false);
  const [activeCategory, setActiveCategory] = useState('all');

  // Load existing prep plans
  const loadPreps = useCallback(async () => {
    try {
      setLoading(true);
      const list = await api.interviewPrep.list();
      setPreps(list);

      if (queryOppId) {
        const matching = list.find((p) => p.opportunityId === queryOppId);
        if (matching) {
          setSelectedPrep(matching);
        } else if (list.length > 0) {
          setSelectedPrep(list[0]);
        }
      } else if (list.length > 0 && !selectedPrep) {
        setSelectedPrep(list[0]);
      }
    } catch {
      setActionError('Failed to load interview preparation roadmaps.');
    } finally {
      setLoading(false);
    }
  }, [queryOppId, selectedPrep]);

  useEffect(() => {
    loadPreps();
  }, [loadPreps]);

  // Handle generating a new plan (role-based, no JD required)
  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetRole.trim()) return;

    setGenerating(true);
    setActionError(null);
    try {
      const newPrep = await api.interviewPrep.generate({
        targetRole: targetRole.trim(),
        jobDescription: jobDescription.trim() || undefined,
        opportunityId: queryOppId || undefined,
        forceRegenerate: true,
      });

      setPreps((prev) => [newPrep, ...prev.filter((p) => p.id !== newPrep.id)]);
      setSelectedPrep(newPrep);
      setActionSuccess(`Generated comprehensive interview roadmap for "${newPrep.targetRole}"!`);
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Generation failed';
      setActionError(msg);
    } finally {
      setGenerating(false);
    }
  };

  // Toggle task completion checkbox
  const handleToggleTask = async (taskId: string, currentDone: boolean) => {
    if (!selectedPrep) return;

    // Optimistic UI update
    const nextDone = !currentDone;
    setSelectedPrep((prev) => {
      if (!prev) return null;
      const updatedTasks = prev.tasksJson.map((t) =>
        t.id === taskId ? { ...t, done: nextDone } : t,
      );
      return { ...prev, tasksJson: updatedTasks };
    });

    try {
      const res = await api.interviewPrep.toggleTask(selectedPrep.id, taskId, nextDone);
      setSelectedPrep(res.prep);
      setPreps((prev) =>
        prev.map((p) => (p.id === res.prep.id ? res.prep : p)),
      );
    } catch {
      // Revert on error
      setSelectedPrep((prev) => {
        if (!prev) return null;
        const reverted = prev.tasksJson.map((t) =>
          t.id === taskId ? { ...t, done: currentDone } : t,
        );
        return { ...prev, tasksJson: reverted };
      });
      setActionError('Failed to update task completion');
    }
  };

  const handleDeletePrep = async (id: string) => {
    try {
      await api.interviewPrep.delete(id);
      const remaining = preps.filter((p) => p.id !== id);
      setPreps(remaining);
      setSelectedPrep(remaining[0] || null);
      setActionSuccess('Interview prep plan removed');
      setTimeout(() => setActionSuccess(null), 3000);
    } catch {
      setActionError('Failed to delete interview prep plan');
    }
  };

  // AI Coach handler
  const handleAskCoach = async (
    overrideQuestion?: string,
    overrideMode?: CoachMode,
    customComment?: string,
  ) => {
    const q = overrideQuestion !== undefined ? overrideQuestion : coachQuestion;
    const m = overrideMode !== undefined ? overrideMode : coachMode;
    if (!q.trim()) return;

    setCoachLoading(true);
    setCoachError(null);
    setSavedSuccess(null);
    try {
      const res = await api.interviewPrep.coach({
        question: q.trim(),
        mode: m,
        targetRole: selectedPrep?.targetRole || targetRole || undefined,
        comment: customComment !== undefined ? customComment : coachComment || undefined,
        previousAnswer: coachedAnswer?.answer || undefined,
      });
      setCoachedAnswer(res);
      setCoachMode(m);
      if (overrideQuestion !== undefined) {
        setCoachQuestion(overrideQuestion);
      }
      if (customComment !== undefined || coachComment) {
        setCoachComment('');
      }
    } catch (err: unknown) {
      setCoachError(err instanceof Error ? err.message : 'Failed to generate interview answer');
    } finally {
      setCoachLoading(false);
    }
  };

  const handleCopyAnswer = async () => {
    if (!coachedAnswer?.answer) return;
    try {
      await navigator.clipboard.writeText(coachedAnswer.answer);
      setCopiedAnswer(true);
      setTimeout(() => setCopiedAnswer(false), 2000);
    } catch {
      // Ignore copy error
    }
  };

  const handleSaveToAnswerBank = async () => {
    if (!coachedAnswer?.answer || !coachQuestion.trim()) return;
    setCoachSaving(true);
    try {
      await api.answerBank.create({
        question: coachQuestion.trim(),
        answer: coachedAnswer.answer,
        tags: ['interview-prep', coachedAnswer.modeApplied],
      });
      setSavedSuccess('Saved to your Master Answer Bank!');
      setTimeout(() => setSavedSuccess(null), 3000);
    } catch (err: unknown) {
      setCoachError(err instanceof Error ? err.message : 'Failed to save to answer bank');
    } finally {
      setCoachSaving(false);
    }
  };

  const plan = selectedPrep?.planJson;
  const tasks = selectedPrep?.tasksJson || [];
  const completedTasks = tasks.filter((t) => t.done).length;
  const progressPercent = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;

  const filteredPresetQuestions = PRESET_QUESTIONS.filter((item) =>
    activeCategory === 'all' ? true : item.category === activeCategory,
  );

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header
          title="Interview Preparation & AI Coach"
          description="Interactive interview practice sandbox & role roadmaps grounded in verified experience"
          breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Interview Prep' }]}
        />
        <main className="flex-1 p-6 max-w-7xl w-full mx-auto space-y-6">
          {/* Page Title & Status Alerts */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  <GraduationCap className="h-5 w-5" />
                </span>
                <h1 className="text-xl font-bold tracking-tight text-foreground">
                  Interview Preparation &amp; AI Coach
                </h1>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Interactive interview practice sandbox &amp; role roadmaps grounded in your verified experience.
              </p>
            </div>

            {/* Existing Plans Switcher Dropdown */}
            {loading ? (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-400" />
                <span>Loading plans...</span>
              </div>
            ) : preps.length > 0 ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground hidden sm:inline">Active Plan:</span>
                <select
                  value={selectedPrep?.id || ''}
                  onChange={(e) => {
                    const match = preps.find((p) => p.id === e.target.value);
                    if (match) setSelectedPrep(match);
                  }}
                  className="px-3 py-1.5 bg-card/60 border border-border/60 rounded-xl text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {preps.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.targetRole} {p.opportunity ? `(${p.opportunity.company})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
          </div>

          {actionSuccess && (
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400 flex items-center gap-2">
              <Check className="h-4 w-4 shrink-0" />
              <span>{actionSuccess}</span>
            </div>
          )}

          {actionError && (
            <div className="p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-xs text-destructive flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 shrink-0" />
              <span>{actionError}</span>
            </div>
          )}

          {/* Quick Generator Bar for Custom Role Roadmaps */}
          <div className="p-5 rounded-2xl bg-card/40 border border-border/50 backdrop-blur-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-indigo-400" />
                <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">
                  Generate Role Preparation Roadmap
                </h3>
              </div>
              <span className="text-[11px] text-muted-foreground">
                Grounded in your Master Profile (Intakely AI, Softoo, HiveWorx, JobAgent AI)
              </span>
            </div>

            <form onSubmit={handleGenerate} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-1">
                  <label className="text-[11px] font-medium text-muted-foreground mb-1 block">
                    Target Role
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Senior Backend Engineer, AI Engineer..."
                    value={targetRole}
                    onChange={(e) => setTargetRole(e.target.value)}
                    className="w-full px-3 py-2 bg-background/60 border border-border/60 rounded-xl text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-[11px] font-medium text-muted-foreground mb-1 block">
                    Optional Job Description / Tech Focus (Leave blank to use role expectations)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. NestJS, PostgreSQL indexing, Microservices, Redis caching, FSM..."
                    value={jobDescription}
                    onChange={(e) => setJobDescription(e.target.value)}
                    className="w-full px-3 py-2 bg-background/60 border border-border/60 rounded-xl text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <Button
                  type="submit"
                  disabled={generating || !targetRole.trim()}
                  className="gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-medium text-xs h-9 px-5 rounded-xl shadow-md shadow-indigo-500/20"
                >
                  {generating ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" />
                  )}
                  <span>{generating ? 'Analyzing & Building Plan...' : 'Generate Roadmap & Tasks'}</span>
                </Button>
              </div>
            </form>
          </div>

          {/* Main Active View */}
          <div className="space-y-6">
            {/* Top Navigation Tabs */}
            <div className="flex flex-wrap items-center gap-2 p-1.5 rounded-xl bg-card/60 border border-border/50">
              <button
                onClick={() => setActiveTab('coach')}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === 'coach'
                    ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md shadow-indigo-500/25'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent/40'
                }`}
              >
                <Zap className="h-3.5 w-3.5" />
                <span>⚡ AI Practice Sandbox &amp; Optimizer</span>
              </button>

              {selectedPrep && plan && (
                <>
                  <button
                    onClick={() => setActiveTab('tasks')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      activeTab === 'tasks'
                        ? 'bg-indigo-500 text-white shadow-sm shadow-indigo-500/30'
                        : 'text-muted-foreground hover:text-foreground hover:bg-accent/40'
                    }`}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>Practice Tasks ({completedTasks}/{tasks.length})</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('topics')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      activeTab === 'topics'
                        ? 'bg-indigo-500 text-white shadow-sm shadow-indigo-500/30'
                        : 'text-muted-foreground hover:text-foreground hover:bg-accent/40'
                    }`}
                  >
                    <BookOpen className="h-3.5 w-3.5" />
                    <span>Core Pillars ({plan.topics?.length || 0})</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('questions')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      activeTab === 'questions'
                        ? 'bg-indigo-500 text-white shadow-sm shadow-indigo-500/30'
                        : 'text-muted-foreground hover:text-foreground hover:bg-accent/40'
                    }`}
                  >
                    <HelpCircle className="h-3.5 w-3.5" />
                    <span>Interview Q&amp;A ({plan.questions?.length || 0})</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('gaps')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      activeTab === 'gaps'
                        ? 'bg-indigo-500 text-white shadow-sm shadow-indigo-500/30'
                        : 'text-muted-foreground hover:text-foreground hover:bg-accent/40'
                    }`}
                  >
                    <Flame className="h-3.5 w-3.5 text-amber-400" />
                    <span>Gap Bridges ({plan.gapBridges?.length || 0})</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('questionsToAsk')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      activeTab === 'questionsToAsk'
                        ? 'bg-indigo-500 text-white shadow-sm shadow-indigo-500/30'
                        : 'text-muted-foreground hover:text-foreground hover:bg-accent/40'
                    }`}
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                    <span>Questions to Ask ({plan.questionsToAsk?.length || 0})</span>
                  </button>
                </>
              )}
            </div>

            {/* TAB: AI Coach Sandbox */}
            {activeTab === 'coach' && (
              <div className="space-y-6">
                {/* Hero / Instruction Card */}
                <div className="p-6 rounded-2xl bg-gradient-to-br from-indigo-950/30 via-card/50 to-purple-950/20 border border-indigo-500/20 backdrop-blur-md space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                          Interactive Coach
                        </span>
                        <span className="text-xs text-muted-foreground font-mono">
                          Target Context: {selectedPrep?.targetRole || targetRole || 'Senior Backend & AI Engineer'}
                        </span>
                      </div>
                      <h2 className="text-lg font-bold text-foreground mt-1">
                        Ask Any Technical or Architectural Question
                      </h2>
                      <p className="text-xs text-muted-foreground mt-0.5 max-w-2xl">
                        Practice answering in structured, simple, and professional spoken English. Grounded directly in your verified projects with zero hallucinations, or optimized into a 30s pitch, deep technical analysis, or clear bullet points.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 rounded-xl bg-background/50 border border-border/50 text-[11px] text-muted-foreground">
                        Mode: <strong className="text-indigo-400 capitalize">{coachMode.replace('_', ' ')}</strong>
                      </span>
                    </div>
                  </div>

                  {/* Preset Categories Chips */}
                  <div className="space-y-2 pt-2 border-t border-border/40">
                    <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block">
                      Quick Topics &amp; Practice Questions:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {PRESET_CATEGORIES.map((cat) => (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => setActiveCategory(cat.id)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                            activeCategory === cat.id
                              ? 'bg-indigo-500 text-white'
                              : 'bg-background/60 text-muted-foreground hover:text-foreground border border-border/40'
                          }`}
                        >
                          {cat.label}
                        </button>
                      ))}
                    </div>

                    {/* Question Preset Pills */}
                    <div className="flex flex-wrap gap-2 pt-1 max-h-36 overflow-y-auto pr-1">
                      {filteredPresetQuestions.map((item, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            setCoachQuestion(item.text);
                            handleAskCoach(item.text, 'standard');
                          }}
                          className="text-left text-[11px] px-3 py-1.5 rounded-xl bg-background/40 hover:bg-indigo-500/10 border border-border/40 hover:border-indigo-500/40 text-muted-foreground hover:text-indigo-300 transition-all flex items-center gap-1.5"
                        >
                          <ChevronRight className="h-3 w-3 shrink-0 text-indigo-400" />
                          <span>{item.text}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Custom Question Input Box */}
                  <div className="space-y-3 pt-3 border-t border-border/40">
                    <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                      <span>Enter Question to Prepare:</span>
                      {coachQuestion && (
                        <button
                          type="button"
                          onClick={() => {
                            setCoachQuestion('');
                            setCoachedAnswer(null);
                          }}
                          className="text-[11px] text-muted-foreground hover:text-destructive font-normal"
                        >
                          Clear
                        </button>
                      )}
                    </label>

                    <div className="relative">
                      <textarea
                        rows={3}
                        value={coachQuestion}
                        onChange={(e) => setCoachQuestion(e.target.value)}
                        placeholder="Type any interview question (e.g. 'What is the difference between Authentication and Authorization?', 'How do you handle scaling and indexing in PostgreSQL?', 'Explain your Voice AI pipeline')..."
                        className="w-full px-4 py-3 bg-background/80 border border-border/60 rounded-xl text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-indigo-500 leading-relaxed resize-none"
                      />
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="text-[11px] text-muted-foreground">
                        Answers are structured, professional, conversational, and tailored to Ghulam Ghaus&apos;s background.
                      </div>

                      <Button
                        type="button"
                        onClick={() => handleAskCoach()}
                        disabled={coachLoading || !coachQuestion.trim()}
                        className="gap-2 bg-gradient-to-r from-indigo-500 via-purple-600 to-indigo-600 hover:from-indigo-600 hover:to-purple-700 text-white font-medium text-xs h-9 px-5 rounded-xl shadow-md shadow-indigo-500/25"
                      >
                        {coachLoading ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Zap className="h-3.5 w-3.5" />
                        )}
                        <span>{coachLoading ? 'Crafting Spoken Answer...' : 'Get Structured Answer'}</span>
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Coached Answer Display Card */}
                {coachError && (
                  <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-xs text-destructive flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4 shrink-0" />
                    <span>{coachError}</span>
                  </div>
                )}

                {coachedAnswer && (
                  <div className="p-6 rounded-2xl bg-card/60 border border-indigo-500/30 backdrop-blur-md space-y-5 shadow-lg shadow-indigo-500/5">
                    {/* Header with Badges & Actions */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border/40">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                          {coachedAnswer.modeApplied.toUpperCase().replace('_', ' ')}
                        </span>
                        <span className="px-2.5 py-1 rounded-lg text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          <span>~{coachedAnswer.speakingDurationSec}s Spoken Duration</span>
                        </span>
                        <span className="text-[11px] text-muted-foreground hidden md:inline">
                          Grounding: <span className="text-foreground font-medium">{coachedAnswer.profileConnection}</span>
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleCopyAnswer}
                          className="h-8 px-3 text-xs gap-1.5 text-muted-foreground hover:text-foreground rounded-lg"
                        >
                          {copiedAnswer ? (
                            <>
                              <Check className="h-3.5 w-3.5 text-emerald-400" />
                              <span className="text-emerald-400">Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="h-3.5 w-3.5" />
                              <span>Copy Answer</span>
                            </>
                          )}
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleSaveToAnswerBank}
                          disabled={coachSaving}
                          className="h-8 px-3 text-xs gap-1.5 border-border/60 hover:bg-indigo-500/10 hover:text-indigo-300 hover:border-indigo-500/30 rounded-lg"
                        >
                          {savedSuccess ? (
                            <>
                              <BookmarkCheck className="h-3.5 w-3.5 text-emerald-400" />
                              <span className="text-emerald-400">Saved!</span>
                            </>
                          ) : coachSaving ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <>
                              <Bookmark className="h-3.5 w-3.5" />
                              <span>Save to Answer Bank</span>
                            </>
                          )}
                        </Button>
                      </div>
                    </div>

                    {/* Grounding note for mobile */}
                    <div className="md:hidden text-[11px] text-muted-foreground bg-background/40 p-2.5 rounded-lg border border-border/40">
                      Grounding: <span className="text-foreground font-medium">{coachedAnswer.profileConnection}</span>
                    </div>

                    {/* Spoken Answer Body */}
                    <div className="p-5 rounded-xl bg-background/70 border border-border/50 space-y-2">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-indigo-400 font-bold block">
                        Spoken Response (Natural &amp; Professional English):
                      </span>
                      <div className="text-xs sm:text-sm text-foreground/95 leading-relaxed whitespace-pre-line font-normal">
                        {coachedAnswer.answer}
                      </div>
                    </div>

                    {/* Verbal Talking Points Pill Badges */}
                    {coachedAnswer.keyTalkingPoints && coachedAnswer.keyTalkingPoints.length > 0 && (
                      <div className="space-y-2">
                        <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block">
                          Key Talking Points to Verbally Hit:
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {coachedAnswer.keyTalkingPoints.map((tp, idx) => (
                            <div
                              key={idx}
                              className="px-3 py-1.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs flex items-center gap-1.5"
                            >
                              <Check className="h-3 w-3 text-emerald-400 shrink-0" />
                              <span>{tp}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Quick 1-Click Optimizer Action Bar */}
                    <div className="p-4 rounded-xl bg-card/40 border border-border/40 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                          <SlidersHorizontal className="h-3.5 w-3.5 text-indigo-400" />
                          <span>One-Click Answer Optimizers:</span>
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          Instantly transform response format
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={coachLoading}
                          onClick={() => handleAskCoach(undefined, 'short')}
                          className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 ${
                            coachMode === 'short'
                              ? 'bg-amber-500 text-white shadow-sm shadow-amber-500/30'
                              : 'bg-background/60 text-muted-foreground hover:text-foreground hover:bg-accent/40 border border-border/40'
                          }`}
                        >
                          <Zap className="h-3 w-3 text-amber-400" />
                          <span>Shorten (30s Pitch)</span>
                        </button>

                        <button
                          type="button"
                          disabled={coachLoading}
                          onClick={() => handleAskCoach(undefined, 'simple_english')}
                          className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 ${
                            coachMode === 'simple_english'
                              ? 'bg-indigo-500 text-white shadow-sm shadow-indigo-500/30'
                              : 'bg-background/60 text-muted-foreground hover:text-foreground hover:bg-accent/40 border border-border/40'
                          }`}
                        >
                          <Bot className="h-3 w-3 text-indigo-400" />
                          <span>Simpler English</span>
                        </button>

                        <button
                          type="button"
                          disabled={coachLoading}
                          onClick={() => handleAskCoach(undefined, 'deep_technical')}
                          className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 ${
                            coachMode === 'deep_technical'
                              ? 'bg-purple-500 text-white shadow-sm shadow-purple-500/30'
                              : 'bg-background/60 text-muted-foreground hover:text-foreground hover:bg-accent/40 border border-border/40'
                          }`}
                        >
                          <Code2 className="h-3 w-3 text-purple-400" />
                          <span>Deep Technical</span>
                        </button>

                        <button
                          type="button"
                          disabled={coachLoading}
                          onClick={() => handleAskCoach(undefined, 'bullet_points')}
                          className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 ${
                            coachMode === 'bullet_points'
                              ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/30'
                              : 'bg-background/60 text-muted-foreground hover:text-foreground hover:bg-accent/40 border border-border/40'
                          }`}
                        >
                          <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                          <span>Bullet Points</span>
                        </button>

                        <button
                          type="button"
                          disabled={coachLoading}
                          onClick={() => handleAskCoach(undefined, 'standard')}
                          className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 ${
                            coachMode === 'standard'
                              ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                              : 'bg-background/60 text-muted-foreground hover:text-foreground hover:bg-accent/40 border border-border/40'
                          }`}
                        >
                          <RotateCcw className="h-3 w-3 text-indigo-400" />
                          <span>Standard Length</span>
                        </button>
                      </div>
                    </div>

                    {/* Custom Refinement / Comment Loop */}
                    <div className="p-4 rounded-xl bg-background/50 border border-border/40 space-y-2.5">
                      <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                        Custom Comment or Refinement:
                      </label>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <input
                          type="text"
                          value={coachComment}
                          onChange={(e) => setCoachComment(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && coachComment.trim()) {
                              handleAskCoach(undefined, coachMode, coachComment);
                            }
                          }}
                          placeholder="Type feedback (e.g. 'Make it punchier', 'Highlight my Twilio WebSockets pipeline', 'Keep it simple')..."
                          className="flex-1 px-3 py-2 bg-background border border-border/60 rounded-xl text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                        <Button
                          type="button"
                          onClick={() => handleAskCoach(undefined, coachMode, coachComment)}
                          disabled={coachLoading || !coachComment.trim()}
                          className="gap-1.5 bg-indigo-500 hover:bg-indigo-600 text-white text-xs h-9 px-4 rounded-xl shrink-0"
                        >
                          {coachLoading ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Send className="h-3.5 w-3.5" />
                          )}
                          <span>Refine Answer</span>
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB: Roadmap View (when selected) */}
            {selectedPrep && plan && activeTab !== 'coach' && (
              <div className="space-y-6">
                {/* Progress & Overview Card */}
                <div className="p-6 rounded-2xl bg-card/50 border border-border/50 backdrop-blur-md relative overflow-hidden space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                          Interview Target
                        </span>
                        {selectedPrep.opportunity && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Building className="h-3 w-3" />
                            <span>{selectedPrep.opportunity.company}</span>
                          </span>
                        )}
                      </div>
                      <h2 className="text-lg font-bold text-foreground mt-1">
                        {selectedPrep.targetRole}
                      </h2>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="text-xs font-semibold text-foreground">
                          {completedTasks} of {tasks.length} Tasks Done
                        </div>
                        <div className="text-[11px] font-mono text-muted-foreground">
                          {progressPercent}% Preparation Score
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeletePrep(selectedPrep.id)}
                        title="Delete this roadmap"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="h-2 w-full bg-accent/40 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-500 rounded-full transition-all duration-500"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>

                  {/* Strategic Overview */}
                  <p className="text-xs text-muted-foreground leading-relaxed bg-background/40 p-3.5 rounded-xl border border-border/40">
                    {plan.overview}
                  </p>
                </div>

                {/* Tab 1: Practice Tasks */}
                {activeTab === 'tasks' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Hands-On Technical Tasks to Complete Before Interview
                      </h3>
                      <span className="text-[11px] text-muted-foreground">
                        Click checkbox to mark completed
                      </span>
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                      {tasks.map((task: PrepTask) => (
                        <div
                          key={task.id}
                          onClick={() => handleToggleTask(task.id, task.done)}
                          className={`p-4 rounded-xl border transition-all cursor-pointer flex items-start gap-3.5 ${
                            task.done
                              ? 'bg-emerald-500/5 border-emerald-500/20 text-muted-foreground'
                              : 'bg-card/40 border-border/50 hover:border-indigo-500/40 text-foreground'
                          }`}
                        >
                          <button
                            type="button"
                            className={`mt-0.5 h-5 w-5 rounded-lg flex items-center justify-center transition-colors shrink-0 ${
                              task.done
                                ? 'bg-emerald-500 text-white'
                                : 'border border-border/80 hover:border-indigo-400'
                            }`}
                          >
                            {task.done && <Check className="h-3.5 w-3.5" />}
                          </button>

                          <div className="flex-1 space-y-1">
                            <div className="flex items-center gap-2">
                              <span
                                className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded font-bold ${
                                  task.difficulty === 'HARD'
                                    ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                                    : task.difficulty === 'MEDIUM'
                                      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                      : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                }`}
                              >
                                {task.difficulty}
                              </span>
                              <span className="text-[10px] text-muted-foreground font-mono">
                                {task.topic}
                              </span>
                            </div>
                            <h4
                              className={`text-xs font-semibold ${
                                task.done ? 'line-through opacity-70' : ''
                              }`}
                            >
                              {task.title}
                            </h4>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                              {task.description}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tab 2: Core Topic Pillars */}
                {activeTab === 'topics' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {plan.topics?.map((topic, i) => (
                      <div
                        key={i}
                        className="p-5 rounded-2xl bg-card/40 border border-border/50 backdrop-blur-sm space-y-3"
                      >
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold text-xs">
                            {i + 1}
                          </div>
                          <h4 className="text-xs font-semibold text-foreground">{topic.name}</h4>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {topic.description}
                        </p>
                        <div className="pt-2 border-t border-border/30">
                          <span className="text-[10px] font-mono text-muted-foreground uppercase block mb-1.5">
                            Key Concepts &amp; Patterns
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {topic.keyConcepts?.map((concept, ci) => (
                              <span
                                key={ci}
                                className="px-2 py-0.5 rounded-lg bg-indigo-500/10 text-indigo-300 text-[10px] font-mono border border-indigo-500/20"
                              >
                                {concept}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Tab 3: Realistic Q&A */}
                {activeTab === 'questions' && (
                  <div className="space-y-4">
                    {plan.questions?.map((q, i) => (
                      <div
                        key={i}
                        className="p-5 rounded-2xl bg-card/40 border border-border/50 backdrop-blur-sm space-y-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1">
                            <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-accent/60 text-muted-foreground">
                              {q.category}
                            </span>
                            <h4 className="text-xs font-bold text-foreground">
                              Q{i + 1}: &ldquo;{q.question}&rdquo;
                            </h4>
                          </div>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setCoachQuestion(q.question);
                              setActiveTab('coach');
                              handleAskCoach(q.question, 'standard');
                            }}
                            className="h-7 px-2.5 text-[11px] text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 gap-1 rounded-lg shrink-0"
                          >
                            <Zap className="h-3 w-3" />
                            <span>Practice with AI Coach</span>
                          </Button>
                        </div>

                        <div className="p-3.5 rounded-xl bg-background/60 border border-border/40 space-y-2">
                          <span className="text-[10px] font-mono text-emerald-400 uppercase font-bold tracking-wider block">
                            Model Architectural Answer
                          </span>
                          <p className="text-xs text-foreground/90 leading-relaxed">
                            {q.expectedAnswer}
                          </p>
                        </div>

                        {q.talkingPoints && q.talkingPoints.length > 0 && (
                          <div className="space-y-1">
                            <span className="text-[10px] font-mono text-muted-foreground uppercase block">
                              Key Verbal Talking Points:
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              {q.talkingPoints.map((tp, tpi) => (
                                <span
                                  key={tpi}
                                  className="px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-300 text-[10px] border border-purple-500/20"
                                >
                                  ✓ {tp}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Tab 4: Gap Bridges */}
                {activeTab === 'gaps' && (
                  <div className="space-y-4">
                    <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
                      <strong>Gap Mitigation Strategy:</strong> When an interviewer asks about a technology you haven&apos;t used deeply in production, never fabricate. Use these honest bridging scripts to anchor back to your core engineering strengths.
                    </div>

                    {plan.gapBridges?.map((gb, i) => (
                      <div
                        key={i}
                        className="p-5 rounded-2xl bg-card/40 border border-border/50 backdrop-blur-sm space-y-2.5"
                      >
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20 text-xs font-bold font-mono">
                            {gb.technology}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {gb.challenge}
                          </span>
                        </div>
                        <div className="p-3 rounded-xl bg-background/40 border border-border/30">
                          <span className="text-[10px] font-mono text-indigo-400 uppercase font-semibold block mb-1">
                            Honest Bridging Answer:
                          </span>
                          <p className="text-xs text-foreground/90 italic leading-relaxed">
                            &ldquo;{gb.bridgingAnswer}&rdquo;
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Tab 5: Questions to Ask the Interviewer */}
                {activeTab === 'questionsToAsk' && (
                  <div className="space-y-3">
                    {plan.questionsToAsk?.map((qa, i) => (
                      <div
                        key={i}
                        className="p-4 rounded-xl bg-card/40 border border-border/50 backdrop-blur-sm space-y-1.5"
                      >
                        <h4 className="text-xs font-semibold text-foreground">
                          {i + 1}. &ldquo;{qa.question}&rdquo;
                        </h4>
                        <p className="text-[11px] text-muted-foreground">
                          <strong className="text-indigo-400">Why ask this:</strong> {qa.strategicPurpose}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

export default function InterviewPrepPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background text-xs text-muted-foreground">
          Loading interview prep...
        </div>
      }
    >
      <InterviewPrepContent />
    </Suspense>
  );
}
