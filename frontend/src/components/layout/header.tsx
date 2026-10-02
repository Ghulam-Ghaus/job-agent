'use client';

import React from 'react';
import Link from 'next/link';
import {
  Bell,
  Sparkles,
  Database,
  ArrowLeft,
  ArrowRight,
  ChevronRight,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from 'cn';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface HeaderProps {
  title: string;
  description?: string;
  breadcrumbs?: BreadcrumbItem[];
  backHref?: string;
  backLabel?: string;
  nextHref?: string;
  nextLabel?: string;
  onSync?: () => void;
  syncing?: boolean;
}

export function Header({
  title,
  description,
  breadcrumbs,
  backHref,
  backLabel,
  nextHref,
  nextLabel,
  onSync,
  syncing = false,
}: HeaderProps) {
  return (
    <header className="border-b border-border/40 px-6 sm:px-8 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card/20 backdrop-blur-md sticky top-0 z-10">
      <div className="space-y-1 min-w-0">
        {/* Breadcrumb Path & Navigation Buttons */}
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap">
          {backHref && (
            <Link
              href={backHref}
              className="inline-flex items-center gap-1 font-medium text-primary hover:underline mr-1"
            >
              <ArrowLeft className="h-3 w-3" />
              <span>{backLabel || 'Back'}</span>
            </Link>
          )}

          {breadcrumbs && breadcrumbs.length > 0 && (
            <div className="flex items-center gap-1.5 font-mono text-[10px]">
              {breadcrumbs.map((crumb, idx) => (
                <React.Fragment key={idx}>
                  {idx > 0 && <ChevronRight className="h-2.5 w-2.5 text-muted-foreground/60" />}
                  {crumb.href ? (
                    <Link
                      href={crumb.href}
                      className="hover:text-foreground transition-colors hover:underline"
                    >
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className="text-foreground font-semibold">{crumb.label}</span>
                  )}
                </React.Fragment>
              ))}
            </div>
          )}
        </div>

        {/* Title & Description with Next Link */}
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold tracking-tight text-foreground truncate">
            {title}
          </h2>
          {nextHref && (
            <Link
              href={nextHref}
              className="inline-flex items-center gap-1 text-xs font-medium text-indigo-400 hover:text-indigo-300 transition-colors hover:underline"
            >
              <span>{nextLabel || 'Next'}</span>
              <ArrowRight className="h-3 w-3" />
            </Link>
          )}
        </div>
        {description && (
          <p className="text-xs text-muted-foreground truncate">{description}</p>
        )}
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-3 shrink-0 flex-wrap">
        {/* System Health Status Indicator */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono">
          <Database className="h-3.5 w-3.5" />
          <span>Postgres + Redis</span>
        </div>

        {/* Sync Action Button */}
        {onSync ? (
          <Button
            size="sm"
            onClick={onSync}
            disabled={syncing}
            className="gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-medium shadow-md shadow-indigo-500/20 text-xs h-8"
          >
            {syncing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            <span>{syncing ? 'Syncing...' : 'Sync Connectors'}</span>
          </Button>
        ) : (
          <Link
            href="/dashboard"
            className={cn(
              buttonVariants({ size: 'sm' }),
              'gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-medium shadow-md shadow-indigo-500/20 text-xs h-8'
            )}
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>Opportunities</span>
          </Link>
        )}

        {/* Notification Bell */}
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 relative text-muted-foreground hover:text-foreground rounded-lg"
          title="Notifications"
        >
          <Bell className="h-3.5 w-3.5" />
          <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-indigo-500 ring-2 ring-background"></span>
        </Button>
      </div>
    </header>
  );
}
