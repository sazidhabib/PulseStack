'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Activity, Zap, Sparkles, ArrowRight, Radio, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';
import { toast } from 'sonner';

export default function Home() {
  const router = useRouter();
  const { loginDemo, isAuthenticated } = useAuth();
  const [isDemoLoading, setIsDemoLoading] = useState(false);

  const handleLaunchDemo = async () => {
    if (isAuthenticated) {
      router.push('/dashboard');
      return;
    }

    setIsDemoLoading(true);
    try {
      const res = await loginDemo();
      if (res.success) {
        toast.success('Signed in as demo@pulsestack.io');
        router.push('/dashboard');
      } else {
        toast.error(res.error || 'Demo login failed');
        router.push('/login');
      }
    } finally {
      setIsDemoLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex flex-col justify-between bg-slate-950 text-slate-100 overflow-hidden">
      {/* Background ambient lighting */}
      <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 h-[600px] w-[800px] rounded-full bg-indigo-600/15 blur-[140px]" />
      <div className="pointer-events-none absolute top-1/2 -right-40 h-[500px] w-[500px] rounded-full bg-cyan-600/10 blur-[140px]" />

      {/* Top Navbar */}
      <header className="relative z-10 max-w-6xl mx-auto w-full px-6 py-6 flex justify-between items-center border-b border-slate-800/80">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-500 shadow-lg shadow-indigo-600/30">
            <Activity className="h-5 w-5 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight text-white">
            Pulse<span className="text-indigo-400">Stack</span>
          </span>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/login">
            <Button variant="ghost" size="sm" className="text-slate-300 hover:text-white">
              Sign In
            </Button>
          </Link>
          <Link href="/register">
            <Button size="sm" className="bg-indigo-600 hover:bg-indigo-500 font-semibold shadow-md shadow-indigo-600/30">
              Get Started
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="relative z-10 max-w-4xl mx-auto px-6 py-20 text-center flex flex-col items-center gap-8">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shadow-sm backdrop-blur-sm">
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          Next-Gen Multi-Tenant Telemetry &amp; Background Execution
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white leading-[1.15]">
          Background Job Queues &amp; <span className="bg-gradient-to-r from-indigo-400 via-indigo-300 to-cyan-400 bg-clip-text text-transparent">Real-Time Health Monitoring</span>
        </h1>

        <p className="text-base sm:text-lg text-slate-400 max-w-2xl leading-relaxed">
          High-performance distributed health checks powered by BullMQ, Redis, PostgreSQL, and Next.js 16. Monitor endpoint latencies, capture incidents instantly, and broadcast live telemetry via WebSockets.
        </p>

        {/* Action CTAs */}
        <div className="flex flex-wrap gap-4 justify-center items-center pt-2">
          <Button
            size="lg"
            className="bg-gradient-to-r from-indigo-600 to-indigo-500 font-bold shadow-xl shadow-indigo-600/30 hover:from-indigo-500 hover:to-indigo-400 text-white px-8"
            isLoading={isDemoLoading}
            onClick={handleLaunchDemo}
          >
            <Sparkles className="mr-2 h-4 w-4 text-amber-300" />
            Launch 1-Click Demo
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>

          <Link href="/register">
            <Button size="lg" variant="outline" className="border-slate-700 bg-slate-900/60 font-semibold hover:bg-slate-800">
              Create Organization
            </Button>
          </Link>
        </div>

        {/* Feature Grid Highlights */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full mt-12 text-left">
          <div className="p-5 rounded-xl border border-slate-800/80 bg-slate-900/50 backdrop-blur-sm">
            <div className="h-9 w-9 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center mb-3">
              <Radio className="h-5 w-5" />
            </div>
            <h3 className="font-semibold text-white text-sm">Scheduled BullMQ Pings</h3>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Cron-style repeatable background jobs pinging HTTP endpoints every 60 seconds with sub-millisecond latency tracking.
            </p>
          </div>

          <div className="p-5 rounded-xl border border-slate-800/80 bg-slate-900/50 backdrop-blur-sm">
            <div className="h-9 w-9 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-3">
              <Zap className="h-5 w-5" />
            </div>
            <h3 className="font-semibold text-white text-sm">Real-Time Telemetry Stream</h3>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Native WebSocket server with Redis Pub/Sub backplane pushes instant uptime changes and latency sparklines.
            </p>
          </div>

          <div className="p-5 rounded-xl border border-slate-800/80 bg-slate-900/50 backdrop-blur-sm">
            <div className="h-9 w-9 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center mb-3">
              <Lock className="h-5 w-5" />
            </div>
            <h3 className="font-semibold text-white text-sm">Zero-Trust Isolation &amp; Auth</h3>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Dual-token JWT rotation with token family reuse breach detection and row-level tenant data isolation.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 max-w-6xl mx-auto w-full px-6 py-8 border-t border-slate-800/80 text-center text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-3">
        <span>&copy; {new Date().getFullYear()} PulseStack — Enterprise Multi-Tenant Background Job SaaS</span>
        <div className="flex items-center gap-4 text-slate-400">
          <Link href="/login" className="hover:text-white transition-colors">Sign In</Link>
          <Link href="/register" className="hover:text-white transition-colors">Register</Link>
        </div>
      </footer>
    </div>
  );
}
