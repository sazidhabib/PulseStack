import React from 'react';
import Link from 'next/link';
import { Activity, ArrowDown, CheckCircle2, ShieldCheck, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DemoLaunchButton } from '@/components/home/demo-launch-button';
import { TelemetryCanvas } from '@/components/home/telemetry-canvas';
import {
  BenefitsSection,
  ProblemSolutionSection,
  WorkflowStepperSection,
} from '@/components/home/landing-sections';

export default function Home() {
  return (
    <div className="relative min-h-screen flex flex-col bg-slate-950 text-slate-100 overflow-x-clip">
      {/* Background ambient lighting */}
      <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 h-[600px] w-[900px] rounded-full bg-indigo-600/15 blur-[140px]" />
      <div className="pointer-events-none absolute top-[28rem] -right-40 h-[500px] w-[500px] rounded-full bg-cyan-600/10 blur-[140px]" />

      {/* Sticky Top Navbar */}
      <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto w-full px-6 py-4 flex justify-between items-center gap-4">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-500 shadow-lg shadow-indigo-600/30">
              <Activity className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight text-white">
              Pulse<span className="text-indigo-400">Stack</span>
            </span>
          </Link>

          <nav
            aria-label="Home page sections"
            className="hidden md:flex items-center gap-6 text-xs font-medium text-slate-400"
          >
            <a href="#live-simulator" className="hover:text-white transition-colors">
              Live Simulator
            </a>
            <a href="#problem-solution" className="hover:text-white transition-colors">
              Problem &amp; Solution
            </a>
            <a href="#how-it-works" className="hover:text-white transition-colors">
              How It Works
            </a>
            <a href="#benefits" className="hover:text-white transition-colors">
              Benefits
            </a>
          </nav>

          <div className="flex items-center gap-2.5">
            <Link href="/login">
              <Button variant="ghost" size="sm" className="text-slate-300 hover:text-white">
                Sign In
              </Button>
            </Link>
            <Link href="/register">
              <Button
                size="sm"
                className="bg-indigo-600 hover:bg-indigo-500 font-semibold shadow-md shadow-indigo-600/30"
              >
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero + Interactive 2D Canvas Stage */}
      <main className="relative z-10 flex-1">
        <section className="max-w-6xl mx-auto w-full px-6 pt-12 pb-16 lg:pt-16 lg:pb-20">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-8 items-center">
            {/* Left: Clear Purpose & Action CTAs */}
            <div className="lg:col-span-5 flex flex-col items-start gap-6 text-left">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-300 border border-indigo-500/25 shadow-sm">
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                Multi-Tenant Uptime &amp; Job Telemetry
              </div>

              <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white leading-[1.12]">
                Catch API Outages in Seconds —{' '}
                <span className="bg-gradient-to-r from-indigo-400 via-indigo-300 to-cyan-400 bg-clip-text text-transparent">
                  Before Users Notice
                </span>
              </h1>

              <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
                PulseStack automatically pings your critical endpoints in the background, streams live response latencies over WebSockets, logs incidents the moment a service degrades, and dispatches cryptographically signed webhooks.
              </p>

              {/* Quick Clarity Bullets */}
              <ul className="space-y-2 text-xs sm:text-sm text-slate-400">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                  <span>Scheduled BullMQ workers check endpoints every 60s–900s</span>
                </li>
                <li className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-indigo-400 flex-shrink-0" />
                  <span>Sub-second WebSocket updates with zero manual refreshing</span>
                </li>
                <li className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-cyan-400 flex-shrink-0" />
                  <span>Row-level orgId isolation &amp; HMAC-SHA256 webhook alerts</span>
                </li>
              </ul>

              {/* Action CTAs */}
              <div className="flex flex-wrap gap-3 items-center pt-1">
                <DemoLaunchButton className="bg-gradient-to-r from-indigo-600 to-indigo-500 font-bold shadow-xl shadow-indigo-600/30 hover:from-indigo-500 hover:to-indigo-400 text-white px-7" />

                <Link href="/register">
                  <Button
                    size="lg"
                    variant="outline"
                    className="border-slate-700 bg-slate-900/60 font-semibold hover:bg-slate-800"
                  >
                    Create Organization
                  </Button>
                </Link>
              </div>

              <a
                href="#problem-solution"
                className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-indigo-300 transition-colors"
              >
                <ArrowDown className="h-3.5 w-3.5" />
                See what problem PulseStack solves &amp; how it works
              </a>
            </div>

            {/* Right: Interactive 2D Canvas Pipeline Simulator */}
            <div className="lg:col-span-7 w-full">
              <TelemetryCanvas />
            </div>
          </div>
        </section>

        {/* Problem vs Solution */}
        <ProblemSolutionSection />

        {/* 3-Step Interactive Workflow */}
        <WorkflowStepperSection />

        {/* User Benefits & Bottom CTA */}
        <BenefitsSection />
      </main>

      {/* Footer */}
      <footer className="relative z-10 max-w-6xl mx-auto w-full px-6 py-8 border-t border-slate-800/80 text-center text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-3">
        <span>
          &copy; {new Date().getFullYear()} PulseStack — Enterprise Multi-Tenant Background Job &amp; Health Monitoring SaaS
        </span>
        <div className="flex items-center gap-4 text-slate-400">
          <Link href="/login" className="hover:text-white transition-colors">
            Sign In
          </Link>
          <Link href="/register" className="hover:text-white transition-colors">
            Register
          </Link>
        </div>
      </footer>
    </div>
  );
}
