'use client';

import React from 'react';
import {
  Briefcase,
  CheckCircle2,
  Clock,
  Sparkles,
  TrendingUp,
  Building2,
  MapPin,
  ChevronRight,
  ShieldAlert,
  SlidersHorizontal,
} from 'lucide-react';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface JobItem {
  id: string;
  title: string;
  company: string;
  location: string;
  matchScore: number;
  salary: string;
  status: 'QUEUED_FOR_APPROVAL' | 'TAILORING' | 'SUBMITTED' | 'DISCOVERED';
  keyMatches: string[];
}

const mockJobs: JobItem[] = [
  {
    id: 'job-1',
    title: 'Senior Full Stack Engineer (Next.js & NestJS)',
    company: 'Vercel Ecosystem Partner',
    location: 'Remote (US/EU)',
    matchScore: 94,
    salary: '$140k – $170k',
    status: 'QUEUED_FOR_APPROVAL',
    keyMatches: ['Next.js App Router', 'NestJS Microservices', 'TypeScript Strict Mode'],
  },
  {
    id: 'job-2',
    title: 'Staff AI Systems Architect',
    company: 'HyperScale Labs',
    location: 'Remote',
    matchScore: 91,
    salary: '$180k – $220k',
    status: 'QUEUED_FOR_APPROVAL',
    keyMatches: ['Agentic Workflows', 'Vector Embeddings', 'PostgreSQL pgvector'],
  },
  {
    id: 'job-3',
    title: 'Lead Frontend Engineer',
    company: 'Fintech Cloud',
    location: 'Hybrid / Remote',
    matchScore: 86,
    salary: '$135k – $160k',
    status: 'SUBMITTED',
    keyMatches: ['React 19 & Tailwind CSS', 'Design Systems', 'Performance Optimization'],
  },
  {
    id: 'job-4',
    title: 'Backend Specialist (Node.js & Prisma)',
    company: 'Nexus Data Inc',
    location: 'Remote',
    matchScore: 83,
    status: 'TAILORING',
    salary: '$130k – $155k',
    keyMatches: ['Prisma ORM', 'Redis Queues', 'Docker Containers'],
  },
];

export default function DashboardPage() {

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Sidebar Navigation */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header
          title="Autopilot Overview"
          description="Autonomous monitoring, evaluation, and application pipeline with strict human-in-the-loop safeguards."
        />

        <main className="flex-1 p-8 space-y-8 overflow-y-auto">
          {/* Key Metric Highlights */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border-border/40 bg-card/40 backdrop-blur-sm relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500" />
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Identified Matches
                </CardTitle>
                <Briefcase className="h-4 w-4 text-indigo-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold tracking-tight">48</div>
                <p className="text-[11px] text-emerald-400 mt-1 flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  <span>+12 new today</span>
                </p>
              </CardContent>
            </Card>

            <Card className="border-border/40 bg-card/40 backdrop-blur-sm relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-amber-500" />
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Pending Approvals
                </CardTitle>
                <Clock className="h-4 w-4 text-amber-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold tracking-tight">3</div>
                <p className="text-[11px] text-amber-400 mt-1 flex items-center gap-1">
                  <ShieldAlert className="h-3 w-3" />
                  <span>Human review required</span>
                </p>
              </CardContent>
            </Card>

            <Card className="border-border/40 bg-card/40 backdrop-blur-sm relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500" />
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Sent Applications
                </CardTitle>
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold tracking-tight">27</div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  100% verified approval records
                </p>
              </CardContent>
            </Card>

            <Card className="border-border/40 bg-card/40 backdrop-blur-sm relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-purple-500" />
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Average Match Score
                </CardTitle>
                <Sparkles className="h-4 w-4 text-purple-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold tracking-tight">89.2%</div>
                <p className="text-[11px] text-purple-400 mt-1">
                  Top tier alignment
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Pipeline Activity & Review Queue */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold tracking-tight text-foreground">
                  Priority Opportunities
                </h3>
                <p className="text-xs text-muted-foreground">
                  Tailored packs prepared and awaiting your review before dispatch.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="text-xs gap-1.5 h-8">
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  <span>Filter</span>
                </Button>
              </div>
            </div>

            {/* Opportunities List */}
            <div className="grid grid-cols-1 gap-3">
              {mockJobs.map((job) => (
                <Card
                  key={job.id}
                  className="border-border/40 bg-card/40 hover:bg-card/60 transition-all cursor-pointer group"
                >
                  <CardContent className="p-5 flex items-center justify-between">
                    <div className="space-y-2 flex-1 min-w-0 pr-4">
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-sm group-hover:text-primary transition-colors truncate">
                          {job.title}
                        </span>
                        <Badge
                          variant={
                            job.status === 'QUEUED_FOR_APPROVAL'
                              ? 'default'
                              : job.status === 'SUBMITTED'
                              ? 'secondary'
                              : 'outline'
                          }
                          className="text-[10px] uppercase font-mono px-2 py-0.5 tracking-wider"
                        >
                          {job.status === 'QUEUED_FOR_APPROVAL'
                            ? 'Ready for Approval'
                            : job.status}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>{job.company}</span>
                        </span>
                        <span className="flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>{job.location}</span>
                        </span>
                        <span className="font-mono text-foreground font-medium">
                          {job.salary}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 flex-wrap pt-1">
                        {job.keyMatches.map((tag) => (
                          <span
                            key={tag}
                            className="px-2 py-0.5 rounded-md bg-secondary/60 text-[10px] text-secondary-foreground font-mono"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center gap-6 shrink-0">
                      {/* Score Indicator */}
                      <div className="text-right">
                        <div className="text-lg font-bold text-emerald-400 font-mono">
                          {job.matchScore}%
                        </div>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          Match Fit
                        </span>
                      </div>

                      {/* Action */}
                      <Button
                        size="sm"
                        className="text-xs gap-1.5 bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 font-medium"
                      >
                        <span>Review Pack</span>
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
