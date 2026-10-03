'use client';

import React, { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Bot, Lock, Mail, ArrowRight, ShieldCheck, AlertCircle, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { api, ApiClientError } from '@/lib/api-client';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isExpired = searchParams.get('expired') === '1' || searchParams.get('expired') === 'true';
  const redirectTarget = searchParams.get('redirect') || '/dashboard';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [requires2Fa, setRequires2Fa] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await api.auth.login({
        email,
        password,
        twoFactorCode: requires2Fa && twoFactorCode ? twoFactorCode.trim() : undefined,
      });
      router.push(redirectTarget);
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        if (err.message.includes('2FA code is required') || err.message.includes('2FA_REQUIRED')) {
          setRequires2Fa(true);
          setError('Please enter the 6-digit code from your authenticator app.');
        } else {
          setError(err.message);
        }
      } else {
        setError('Failed to authenticate. Please check if the backend is running.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleQuickFillAdmin = () => {
    setEmail('admin@jobagent.local');
    setPassword('Admin@123456');
    setRequires2Fa(false);
    setTwoFactorCode('');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-950/40 via-background to-background">
      {/* Background ambient glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-500/10 blur-[120px] rounded-full pointer-events-none" />

      <Card className="w-full max-w-md border-border/50 bg-card/60 backdrop-blur-2xl shadow-2xl relative">
        <CardHeader className="text-center space-y-2 pb-6">
          <div className="mx-auto h-12 w-12 rounded-2xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-indigo-500/25 mb-2">
            <Bot className="h-6 w-6 text-white" />
          </div>
          <CardTitle className="text-xl font-bold tracking-tight">
            JobAgent AI Autopilot
          </CardTitle>
          <CardDescription className="text-xs">
            Enter your credentials to access your autonomous job search workspace
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {isExpired && !error && (
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-center gap-2">
                <Info className="h-4 w-4 shrink-0 text-amber-400" />
                <span>Your session has expired or you were signed out. Please sign in to continue.</span>
              </div>
            )}

            {error && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                <span>Email Address</span>
              </label>
              <Input
                type="email"
                placeholder="admin@jobagent.local"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-background/50 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                <span>Password</span>
              </label>
              <Input
                type="password"
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="bg-background/50 text-xs"
              />
            </div>

            {requires2Fa && (
              <div className="space-y-1.5 p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
                <label className="text-xs font-medium text-indigo-300 flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-indigo-400" />
                  <span>Two-Factor Authenticator Code</span>
                </label>
                <Input
                  type="text"
                  maxLength={6}
                  placeholder="123456"
                  value={twoFactorCode}
                  onChange={(e) => setTwoFactorCode(e.target.value)}
                  autoFocus
                  className="bg-background font-mono text-center tracking-widest text-sm"
                />
              </div>
            )}
          </CardContent>

          <CardFooter className="flex flex-col gap-3 pt-2">
            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-medium shadow-md shadow-indigo-500/20 text-xs gap-2"
            >
              <span>{loading ? 'Authenticating...' : 'Sign In to Workspace'}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>

            <button
              type="button"
              onClick={handleQuickFillAdmin}
              className="text-[11px] text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 cursor-pointer"
            >
              <ShieldCheck className="h-3 w-3 text-emerald-400" />
              <span>Fill Seeded Super Admin credentials</span>
            </button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center p-4 bg-background text-xs text-muted-foreground">
          Loading authentication...
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
