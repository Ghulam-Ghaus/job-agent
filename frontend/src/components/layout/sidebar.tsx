'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Briefcase,
  FileText,
  Settings,
  Bot,
  LogOut,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Building2,
  Globe,
  GraduationCap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api-client';

const navigation = [
  { name: 'Opportunities', href: '/dashboard', icon: Briefcase },
  { name: 'Interview Prep', href: '/interview-prep', icon: GraduationCap },
  { name: 'Direct Clients', href: '/leads', icon: Building2 },
  { name: 'Approval Queue', href: '/approvals', icon: CheckCircle2 },
  { name: 'Master Profile', href: '/profile', icon: FileText },
  { name: 'Admin Console', href: '/admin', icon: ShieldCheck },
  { name: 'Public Showcase', href: '/', icon: Globe, external: true },
  { name: 'Offerings & Products', href: '/products', icon: Sparkles },
  { name: 'BullMQ Queues', href: 'http://localhost:4000/admin/queues', icon: Settings, external: true },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [user, setUser] = useState<{ email: string; role: string } | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('jobagent_sidebar_collapsed');
    if (saved !== null) {
      setCollapsed(saved === 'true');
    }

    // Fetch authenticated user info
    api.auth
      .me()
      .then((res) => {
        if (res?.user) {
          setUser({ email: res.user.email, role: res.user.role });
        }
      })
      .catch(() => {
        setUser(null);
      });
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('jobagent_sidebar_collapsed', String(next));
      return next;
    });
  };

  const handleLogout = async () => {
    try {
      await api.auth.logout();
    } catch {
      // Ignore error on logout
    } finally {
      setUser(null);
      router.push('/login');
    }
  };

  return (
    <aside
      className={`border-r border-border/50 bg-card/40 backdrop-blur-xl flex flex-col shrink-0 h-screen sticky top-0 transition-all duration-300 ease-in-out z-20 ${
        collapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* Brand Header */}
      <div className={`h-16 flex items-center border-b border-border/40 px-4 ${collapsed ? 'justify-center' : 'justify-between'}`}>
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-9 w-9 shrink-0 rounded-xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Bot className="h-5 w-5 text-white" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <h1 className="text-sm font-semibold tracking-tight leading-none text-foreground truncate">
                JobAgent AI
              </h1>
              <span className="text-[10px] text-muted-foreground font-mono">
                Autonomous Co-Pilot
              </span>
            </div>
          )}
        </div>

        {/* Fold / Unfold Button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleCollapsed}
          title={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          className={`h-7 w-7 text-muted-foreground hover:text-foreground shrink-0 rounded-lg ${collapsed ? 'hidden sm:flex mt-1' : ''}`}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      {/* Nav Links */}
      <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto overflow-x-hidden">
        {navigation.map((item) => {
          const isActive = pathname === item.href;
          const linkProps = item.external
            ? { href: item.href, target: '_blank', rel: 'noopener noreferrer' }
            : { href: item.href };

          return (
            <Link
              key={item.name}
              {...linkProps}
              title={collapsed ? item.name : undefined}
              className={`flex items-center rounded-lg text-xs font-medium transition-all group relative ${
                collapsed ? 'justify-center h-10 px-0' : 'px-3 py-2.5 justify-between'
              } ${
                isActive
                  ? 'bg-primary/10 text-primary font-semibold shadow-xs border border-primary/20'
                  : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <item.icon
                  className={`h-4 w-4 shrink-0 transition-transform group-hover:scale-110 ${
                    isActive ? 'text-primary' : 'text-muted-foreground'
                  }`}
                />
                {!collapsed && <span className="truncate">{item.name}</span>}
              </div>

              {/* Hover Tooltip when Collapsed */}
              {collapsed && (
                <div className="absolute left-full ml-2 px-2.5 py-1 bg-popover text-popover-foreground text-xs rounded-md shadow-md border border-border/60 whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity z-50">
                  {item.name}
                </div>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Expand trigger when collapsed at bottom */}
      {collapsed && (
        <div className="px-3 pb-2 flex justify-center">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleCollapsed}
            title="Expand Sidebar"
            className="h-8 w-8 text-muted-foreground hover:text-foreground rounded-lg"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* User / Session Footer */}
      <div className={`border-t border-border/40 bg-accent/20 transition-all ${collapsed ? 'p-2 flex flex-col items-center' : 'p-4'}`}>
        {!collapsed ? (
          user ? (
            <>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="h-7 w-7 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shrink-0">
                    <ShieldCheck className="h-4 w-4 text-emerald-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">
                      {user.role === 'SUPER_ADMIN' ? 'Super Admin' : 'Workspace User'}
                    </p>
                    <p className="text-[10px] text-muted-foreground truncate max-w-[120px]">
                      {user.email}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleLogout}
                  title="Logout"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-mono">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0"></span>
                <span className="truncate">Core Engine Active</span>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-between py-1">
              <span className="text-xs text-muted-foreground">Not signed in</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push('/login')}
                className="h-7 text-xs border-primary/30 text-primary hover:bg-primary/10"
              >
                Sign In
              </Button>
            </div>
          )
        ) : (
          user ? (
            <div className="flex flex-col items-center gap-2 py-1">
              <div
                className="h-7 w-7 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center"
                title={`${user.role}: ${user.email}`}
              >
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
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
          ) : (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push('/login')}
              title="Sign In"
              className="h-7 w-7 text-primary hover:bg-primary/10"
            >
              <LogOut className="h-3.5 w-3.5 rotate-180" />
            </Button>
          )
        )}
      </div>
    </aside>
  );
}
