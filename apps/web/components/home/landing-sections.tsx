'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  Clock,
  Lock,
  Radio,
  ShieldCheck,
  Terminal,
  Webhook,
  XCircle,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DemoLaunchButton } from '@/components/home/demo-launch-button';

const PROBLEM_SOLUTIONS = [
  {
    problemTitle: 'Silent API Downtime',
    problemDesc:
      'Endpoints stall or return 5xx errors overnight, and your team only finds out when customers report broken checkouts.',
    solutionTitle: 'Scheduled BullMQ Health Pings',
    solutionDesc:
      'Repeatable background workers probe every service every 60s, 300s, or 900s with strict abort timeouts and sub-millisecond timing.',
  },
  {
    problemTitle: 'Stale Dashboards & Heavy Polling',
    problemDesc:
      'Refreshing dashboards or hammering PostgreSQL from client tabs wastes database connections and hides sudden latency spikes.',
    solutionTitle: 'Redis Pub/Sub to WebSocket Stream',
    solutionDesc:
      'Workers publish results to Redis channels, pushing live uptime changes, latency sparklines, and incident alerts straight to the browser.',
  },
  {
    problemTitle: 'Spoofed Alerts & Tenant Leaks',
    problemDesc:
      'Unverified webhooks can be forged by attackers, and missing org checks risk exposing another customer’s telemetry.',
    solutionTitle: 'HMAC-SHA256 & Row-Level orgId Scope',
    solutionDesc:
      'Every webhook carries a cryptographic X-Pulse-Signature with exponential retry backoff, and every DB query and WS room is isolated by orgId.',
  },
];

const WORKFLOW_STEPS = [
  {
    step: '01',
    title: 'Register Endpoint & Interval',
    summary:
      'Add your HTTP/S URL, method, expected status code, and repeatable check cadence (60s, 300s, or 900s).',
    badge: 'Monitor Configuration',
    codeTitle: 'POST /api/monitors',
    codeLines: [
      '{',
      '  "name": "Payments Gateway",',
      '  "url": "https://api.example.com/health",',
      '  "method": "GET",',
      '  "intervalSeconds": 60,',
      '  "expectedStatus": 200',
      '}',
    ],
  },
  {
    step: '02',
    title: 'Workers Ping & Stream Live',
    summary:
      'BullMQ workers execute isolated HTTP checks, persist latency history in PostgreSQL, and stream results via WebSockets.',
    badge: 'Live WebSocket Event',
    codeTitle: 'ws://api/ws · health-check:result',
    codeLines: [
      '{',
      '  "event": "health-check:result",',
      '  "monitorId": "mon_94a2f1",',
      '  "status": "up",',
      '  "statusCode": 200,',
      '  "latencyMs": 38',
      '}',
    ],
  },
  {
    step: '03',
    title: 'Auto-Capture Incidents & Alert Safely',
    summary:
      'Failures open an audit-logged incident automatically, dispatch HMAC-signed webhooks with retries, and resolve on recovery.',
    badge: 'Signed Webhook Dispatch',
    codeTitle: 'X-Pulse-Signature: sha256=9f4c...e81b',
    codeLines: [
      '{',
      '  "event": "incident:created",',
      '  "service": "Payments Gateway",',
      '  "cause": "HTTP 503 Service Unavailable",',
      '  "startedAt": "2026-11-25T12:14:02Z",',
      '  "signatureVerified": true',
      '}',
    ],
  },
];

const BENEFITS = [
  {
    icon: Clock,
    accent: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
    title: 'Detect Outages in Seconds',
    description:
      'Automated background workers spot slowdowns and 5xx outages immediately—cutting Mean Time to Detect without manual checks.',
  },
  {
    icon: Zap,
    accent: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    title: 'Zero-Refresh Live Telemetry',
    description:
      'Watch real-time latency sparklines, operational SLA percentages, and incoming check logs update live over WebSockets.',
  },
  {
    icon: Webhook,
    accent: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
    title: 'Verifiable Webhook Delivery',
    description:
      'Send incident and recovery payloads to Slack, Discord, or custom APIs signed with HMAC-SHA256 and full delivery audit logs.',
  },
  {
    icon: Lock,
    accent: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    title: 'Zero-Trust Auth & Isolation',
    description:
      'Protected with 15-min in-memory access tokens, rotating httpOnly refresh cookies with reuse breach detection, and strict orgId scoping.',
  },
];

export function ProblemSolutionSection() {
  return (
    <section
      id="problem-solution"
      className="relative z-10 max-w-6xl mx-auto w-full px-6 py-16 border-t border-slate-800/70"
    >
      <div className="max-w-2xl mb-10">
        <Badge variant="outline" className="mb-3 border-indigo-500/30 text-indigo-300 bg-indigo-500/10">
          Problem &amp; Solution
        </Badge>
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
          Why teams outgrow manual scripts and fragile polling
        </h2>
        <p className="text-sm sm:text-base text-slate-400 mt-2 leading-relaxed">
          PulseStack replaces ad-hoc cron scripts and blind spots with a fault-tolerant monitoring pipeline built for multi-tenant reliability.
        </p>
      </div>

      <div className="space-y-4">
        {PROBLEM_SOLUTIONS.map((row) => (
          <div
            key={row.problemTitle}
            className="grid grid-cols-1 md:grid-cols-2 gap-4 rounded-2xl border border-slate-800/80 bg-slate-900/45 p-4 sm:p-5 transition-colors hover:border-slate-700/80"
          >
            {/* Problem Side */}
            <div className="rounded-xl border border-rose-500/20 bg-rose-950/15 p-4">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-rose-400 mb-1.5">
                <XCircle className="h-4 w-4 flex-shrink-0" />
                The Problem
              </div>
              <h3 className="text-base font-semibold text-white">{row.problemTitle}</h3>
              <p className="text-xs sm:text-sm text-slate-400 mt-1.5 leading-relaxed">
                {row.problemDesc}
              </p>
            </div>

            {/* Solution Side */}
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/15 p-4">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400 mb-1.5">
                <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                PulseStack Solution
              </div>
              <h3 className="text-base font-semibold text-white">{row.solutionTitle}</h3>
              <p className="text-xs sm:text-sm text-slate-300 mt-1.5 leading-relaxed">
                {row.solutionDesc}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function WorkflowStepperSection() {
  const [activeStep, setActiveStep] = useState(0);
  const current = WORKFLOW_STEPS[activeStep] ?? WORKFLOW_STEPS[0];

  return (
    <section
      id="how-it-works"
      className="relative z-10 max-w-6xl mx-auto w-full px-6 py-16 border-t border-slate-800/70"
    >
      <div className="max-w-2xl mb-10">
        <Badge variant="outline" className="mb-3 border-cyan-500/30 text-cyan-300 bg-cyan-500/10">
          How It Works
        </Badge>
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
          From URL setup to live incident alerts in 3 steps
        </h2>
        <p className="text-sm sm:text-base text-slate-400 mt-2 leading-relaxed">
          Select a step below to inspect the exact API contract, WebSocket event, and signed webhook payload PulseStack generates.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Step Selector List */}
        <div className="lg:col-span-6 space-y-3">
          {WORKFLOW_STEPS.map((item, idx) => {
            const isSelected = idx === activeStep;
            return (
              <button
                key={item.step}
                type="button"
                onClick={() => setActiveStep(idx)}
                className={cn(
                  'w-full text-left rounded-xl border p-4 transition-all duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 active:scale-[0.99]',
                  isSelected
                    ? 'border-indigo-500/60 bg-indigo-950/30 shadow-lg shadow-indigo-950/20'
                    : 'border-slate-800/80 bg-slate-900/50 hover:bg-slate-900/80 hover:border-slate-700'
                )}
              >
                <div className="flex items-start gap-3.5">
                  <span
                    className={cn(
                      'font-mono text-xs font-bold px-2 py-1 rounded-md border flex-shrink-0',
                      isSelected
                        ? 'bg-indigo-600 text-white border-indigo-500'
                        : 'bg-slate-800/80 text-slate-400 border-slate-700'
                    )}
                  >
                    {item.step}
                  </span>
                  <div>
                    <h3 className="text-sm sm:text-base font-semibold text-white">
                      {item.title}
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-400 mt-1 leading-relaxed">
                      {item.summary}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Live Payload Preview Card */}
        <div className="lg:col-span-6 rounded-2xl border border-slate-800 bg-slate-950/90 flex flex-col justify-between overflow-hidden shadow-xl">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800/80 bg-slate-900/70">
            <div className="flex items-center gap-2 text-xs font-mono text-slate-300">
              <Terminal className="h-3.5 w-3.5 text-indigo-400" />
              <span>{current.codeTitle}</span>
            </div>
            <Badge variant="default" className="text-[10px]">
              {current.badge}
            </Badge>
          </div>

          <pre className="p-5 text-xs sm:text-sm font-mono text-slate-200 overflow-x-auto leading-relaxed flex-1">
            <code>{current.codeLines.join('\n')}</code>
          </pre>

          <div className="px-4 py-3 border-t border-slate-800/80 bg-slate-900/40 flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <Radio className="h-3.5 w-3.5 text-emerald-400" />
              Validated end-to-end with Zod &amp; TypeScript
            </span>
            <span className="font-mono text-slate-500">Step {current.step} / 03</span>
          </div>
        </div>
      </div>
    </section>
  );
}

export function BenefitsSection() {
  return (
    <section
      id="benefits"
      className="relative z-10 max-w-6xl mx-auto w-full px-6 py-16 border-t border-slate-800/70"
    >
      <div className="max-w-2xl mb-10">
        <Badge variant="outline" className="mb-3 border-emerald-500/30 text-emerald-300 bg-emerald-500/10">
          User Benefits
        </Badge>
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
          Built for clarity, speed, and production trust
        </h2>
        <p className="text-sm sm:text-base text-slate-400 mt-2 leading-relaxed">
          Whether you are monitoring microservices or evaluating enterprise TypeScript architecture, every layer gives immediate feedback.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {BENEFITS.map((benefit) => {
          const Icon = benefit.icon;
          return (
            <div
              key={benefit.title}
              className="rounded-xl border border-slate-800/80 bg-slate-900/55 p-5 transition-all duration-150 hover:border-slate-700 hover:bg-slate-900/80"
            >
              <div
                className={cn(
                  'h-10 w-10 rounded-lg border flex items-center justify-center mb-3.5',
                  benefit.accent
                )}
              >
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="text-base font-semibold text-white">{benefit.title}</h3>
              <p className="text-xs sm:text-sm text-slate-400 mt-1.5 leading-relaxed">
                {benefit.description}
              </p>
            </div>
          );
        })}
      </div>

      {/* Bottom Conversion Banner */}
      <div className="mt-14 rounded-2xl border border-indigo-500/30 bg-gradient-to-br from-indigo-950/60 via-slate-900/80 to-cyan-950/40 p-6 sm:p-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
        <div className="max-w-xl">
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-indigo-300 mb-2">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            Pre-seeded Sandbox · 5 Monitors · 7 Days of Telemetry
          </div>
          <h3 className="text-xl sm:text-2xl font-bold text-white">
            Experience the live dashboard in one click
          </h3>
          <p className="text-sm text-slate-300 mt-1.5 leading-relaxed">
            Jump straight into <code className="font-mono text-indigo-300">demo@pulsestack.io</code> to inspect real monitors, incident timelines, and webhook delivery logs—or create your own isolated organization.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 flex-shrink-0">
          <DemoLaunchButton
            label="Try Pre-Seeded Demo"
            className="bg-gradient-to-r from-indigo-600 to-indigo-500 font-bold shadow-xl shadow-indigo-600/30 hover:from-indigo-500 hover:to-indigo-400 text-white px-7"
          />
          <Link href="/register">
            <Button
              size="lg"
              variant="outline"
              className="border-slate-700 bg-slate-900/70 font-semibold hover:bg-slate-800"
            >
              Create Organization
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
