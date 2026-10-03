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
  Target,
  Flame,
  Check,
} from 'lucide-react';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import {
  api,
  type InterviewPrep,
  type PrepTask,
} from '@/lib/api-client';

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
  const [activeTab, setActiveTab] = useState<'tasks' | 'topics' | 'questions' | 'gaps' | 'questionsToAsk'>('tasks');
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

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
      setActionError('Failed to delete prep plan');
    }
  };

  // Progress metrics
  const tasks = selectedPrep?.tasksJson || [];
  const completedTasks = tasks.filter((t) => t.done).length;
  const progressPercent = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;
  const plan = selectedPrep?.planJson;

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <Header
          title="Interview Prep & Learning Roadmaps"
          description="Role-grounded interview prep: actionable practice tasks, deep architectural topics, gap bridges, and model answers"
          breadcrumbs={[
            { label: 'Home', href: '/' },
            { label: 'Opportunities', href: '/dashboard' },
            { label: 'Interview Prep' },
          ]}
        />

        <main className="flex-1 p-6 max-w-7xl mx-auto w-full space-y-6">
          {/* Header Title */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold tracking-tight flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center shadow-md shadow-indigo-500/20 text-white">
                  <GraduationCap className="h-5 w-5" />
                </div>
                <span>Role Interview Prep &amp; Learning Roadmap</span>
              </h1>
              <p className="text-xs text-muted-foreground mt-1">
                Role-grounded interview prep: actionable practice tasks, deep architectural topics, gap bridges, and model answers.
              </p>
            </div>

            {preps.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Select Roadmap:</span>
                <select
                  value={selectedPrep?.id || ''}
                  onChange={(e) => {
                    const found = preps.find((p) => p.id === e.target.value);
                    if (found) setSelectedPrep(found);
                  }}
                  className="bg-card border border-border/60 text-xs rounded-xl px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {preps.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.targetRole} {p.opportunity?.company ? `(${p.opportunity.company})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Feedback banners */}
          {actionSuccess && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{actionSuccess}</span>
            </div>
          )}
          {actionError && (
            <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 shrink-0" />
              <span>{actionError}</span>
            </div>
          )}

          {/* Generation Card */}
          <div className="p-5 rounded-2xl bg-card/40 border border-border/50 backdrop-blur-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-indigo-400" />
                <span>Create New Role Preparation (No JD Required)</span>
              </h3>
              <span className="text-[11px] font-mono text-muted-foreground hidden sm:block">
                Grounded in Candidate Master Profile
              </span>
            </div>

            <form onSubmit={handleGenerate} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-1">
                  <label className="text-[11px] font-medium text-muted-foreground mb-1 block">
                    Target Role / Title
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Junior Backend Engineer, Senior Full-Stack..."
                    value={targetRole}
                    onChange={(e) => setTargetRole(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-background/60 border border-border/60 rounded-xl text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-[11px] font-medium text-muted-foreground mb-1 block">
                    Optional Job Description / Tech Focus (Leave blank to use role expectations)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. NestJS, PostgreSQL indexing, Microservices, Redis caching..."
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

          {/* Active Roadmap View */}
          {selectedPrep && plan ? (
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

                {/* Section Tabs */}
                <div className="flex flex-wrap gap-2 pt-2 border-t border-border/40">
                  <button
                    onClick={() => setActiveTab('tasks')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      activeTab === 'tasks'
                        ? 'bg-indigo-500 text-white shadow-sm shadow-indigo-500/30'
                        : 'bg-accent/40 text-muted-foreground hover:text-foreground'
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
                        : 'bg-accent/40 text-muted-foreground hover:text-foreground'
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
                        : 'bg-accent/40 text-muted-foreground hover:text-foreground'
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
                        : 'bg-accent/40 text-muted-foreground hover:text-foreground'
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
                        : 'bg-accent/40 text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                    <span>Questions to Ask ({plan.questionsToAsk?.length || 0})</span>
                  </button>
                </div>
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
                          {task.done ? <Check className="h-3.5 w-3.5 stroke-[3]" /> : null}
                        </button>

                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <h4
                              className={`text-xs font-semibold ${
                                task.done ? 'line-through text-muted-foreground' : 'text-foreground'
                              }`}
                            >
                              {task.title}
                            </h4>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent/60 text-muted-foreground font-mono">
                                {task.topic}
                              </span>
                              <span
                                className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase ${
                                  task.difficulty === 'EASY'
                                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                    : task.difficulty === 'MEDIUM'
                                      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                      : 'bg-red-500/10 text-red-400 border border-red-500/20'
                                }`}
                              >
                                {task.difficulty}
                              </span>
                            </div>
                          </div>
                          <p className="text-[11px] text-muted-foreground leading-relaxed">
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
                      <div className="p-3.5 rounded-xl bg-background/60 border border-border/40">
                        <span className="text-[10px] font-mono text-indigo-400 uppercase block mb-1">
                          Recommended Verbatim Response:
                        </span>
                        <p className="text-xs text-foreground/90 leading-relaxed italic">
                          &ldquo;{gb.bridgingAnswer}&rdquo;
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Tab 5: Questions to Ask */}
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
          ) : !loading ? (
            <div className="p-12 text-center rounded-2xl bg-card/20 border border-border/40 space-y-3">
              <div className="h-12 w-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 mx-auto">
                <Target className="h-6 w-6" />
              </div>
              <h3 className="text-sm font-semibold text-foreground">
                No Interview Roadmap Selected
              </h3>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                Enter your target role above (e.g. &ldquo;Senior Backend Engineer&rdquo;) to generate hands-on practice tasks and topic pillars.
              </p>
            </div>
          ) : (
            <div className="p-12 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />
              <span>Loading roadmap...</span>
            </div>
          )}
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
