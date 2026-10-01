'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Briefcase,
  FileText,
  Settings,
  Bot,
  LogOut,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api-client';

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Opportunities', href: '/opportunities', icon: Briefcase, badge: '12 new' },
  { name: 'Approval Queue', href: '/approvals', icon: CheckCircle2, badge: '3 pending' },
  { name: 'Master Profile', href: '/profile', icon: FileText },
  { name: 'Onboarding Setup', href: '/onboarding', icon: Sparkles },
  { name: 'Agent Settings', href: '/settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await api.auth.logout();
    } catch {
      // Ignore error on logout
    } finally {
      router.push('/login');
    }
  };

  return (
    <aside className="w-64 border-r border-border/50 bg-card/40 backdrop-blur-xl flex flex-col shrink-0 h-screen sticky top-0">
      {/* Brand Header */}
      <div className="h-16 flex items-center gap-3 px-6 border-b border-border/40">
        <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
          <Bot className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-sm font-semibold tracking-tight leading-none text-foreground">
            JobAgent AI
          </h1>
          <span className="text-[10px] text-muted-foreground font-mono">
            Autonomous Co-Pilot
          </span>
        </div>
      </div>

      {/* Nav Links */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navigation.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
                isActive
                  ? 'bg-primary/10 text-primary font-semibold shadow-xs border border-primary/20'
                  : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'
              }`}
            >
              <div className="flex items-center gap-3">
                <item.icon
                  className={`h-4 w-4 ${
                    isActive ? 'text-primary' : 'text-muted-foreground'
                  }`}
                />
                <span>{item.name}</span>
              </div>
              {item.badge && (
                <Badge
                  variant={isActive ? 'default' : 'secondary'}
                  className="text-[10px] px-1.5 py-0 font-mono tracking-tight"
                >
                  {item.badge}
                </Badge>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User / Session Footer */}
      <div className="p-4 border-t border-border/40 bg-accent/20">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
            </div>
            <div>
              <p className="text-xs font-medium text-foreground">Super Admin</p>
              <p className="text-[10px] text-muted-foreground truncate max-w-[120px]">
                admin@jobagent.local
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleLogout}
            title="Logout"
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
          >
            <LogOut className="h-3.5 w-3.5" />
          </Button>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-mono">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
          <span>Core Engine Active</span>
        </div>
      </div>
    </aside>
  );
}
