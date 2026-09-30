'use client';

import React from 'react';
import { Bell, Sparkles, Database } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface HeaderProps {
  title: string;
  description?: string;
}

export function Header({ title, description }: HeaderProps) {
  return (
    <header className="h-16 border-b border-border/40 px-8 flex items-center justify-between bg-card/20 backdrop-blur-md sticky top-0 z-10">
      <div>
        <h2 className="text-base font-semibold tracking-tight text-foreground">
          {title}
        </h2>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>

      <div className="flex items-center gap-3">
        {/* System Health Status Indicator */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono">
          <Database className="h-3.5 w-3.5" />
          <span>PostgreSQL + Redis Connected</span>
        </div>

        {/* Action Button */}
        <Button size="sm" className="gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-medium shadow-md shadow-indigo-500/20 text-xs">
          <Sparkles className="h-3.5 w-3.5" />
          <span>Trigger Auto-Scan</span>
        </Button>

        {/* Notification Bell */}
        <Button variant="outline" size="icon" className="h-8 w-8 relative text-muted-foreground hover:text-foreground">
          <Bell className="h-4 w-4" />
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-indigo-500"></span>
        </Button>
      </div>
    </header>
  );
}
