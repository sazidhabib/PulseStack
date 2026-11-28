'use client';

import React, { useRef, useState } from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  Clock,
  Eye,
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
import {
  BenefitVisualCanvas,
  ProblemSolutionSceneCanvas,
  WorkflowScrollCanvas,
  type BenefitVisualKind,
  type ProblemSolutionVariant,
} from '@/components/home/scroll-story-canvases';
import { useScrollProgress } from '@/hooks/use-scroll-progress';

const PROBLEM_SOLUTIONS: Array<{
  variant: ProblemSolutionVariant;
  ariaLabel: string;
  problemTitle: string;
  problemDesc: string;
  solutionTitle: string;
  solutionDesc: string;
}> = [
  {
    variant: 'radar',
    ariaLabel:
      '2D Canvas comparison between unseen overnight 503 downtime and PulseStack 60-second radar sweep detection',
    problemTitle: 'Silent API Downtime',
    problemDesc:
      'Endpoints fail overnight with 5xx errors and customers report broken flows before anyone checks logs.',
    solutionTitle: 'Scheduled 60s BullMQ Radar',
    solutionDesc:
      'Repeatable background workers ping every endpoint on schedule with abort timeouts and instant status alerts.',
  },
  {
    variant: 'pubsub',
    ariaLabel:
      '2D Canvas comparison between database-straining client polling and PulseStack Redis Pub/Sub WebSocket fan-out',
    problemTitle: 'Stale Dashboards & Polling Load',
    problemDesc:
      'Tab refreshes and redundant polling hammer your database while hiding short latency spikes.',
    solutionTitle: 'Redis Pub/Sub to WebSocket Stream',
    solutionDesc:
      'Workers publish each result once to Redis, pushing live latency and uptime updates to every connected screen.',
  },
  {
    variant: 'isolation',
    ariaLabel:
      '2D Canvas comparison between mixed tenant data leaks and PulseStack strict orgId isolation with HMAC-SHA256 webhooks',
    problemTitle: 'Spoofed Alerts & Tenant Leaks',
    problemDesc:
      'Unsigned webhooks can be forged and missing tenant boundaries risk leaking another org’s telemetry.',
    solutionTitle: 'HMAC-SHA256 & Row-Level orgId Scope',
    solutionDesc:
      'Every webhook carries an X-Pulse-Signature with retry backoff, and all DB queries and WS rooms isolate by orgId.',
  },
];

const WORKFLOW_STEPS = [
  {
    step: '01',
    title: 'Register Endpoint & Interval',
    summary:
      'Set target URL, HTTP method, expected status code, and repeatable check cadence (60s, 300s, or 900s).',
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
      'BullMQ workers measure sub-millisecond HTTP latency, persist history in PostgreSQL, and push live WebSocket events.',
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
      'Outages open an audit-logged incident automatically, fire HMAC-signed webhooks with retries, and resolve on recovery.',
    badge: 'Signed Webhook Dispatch',
    codeTitle: 'X-Pulse-Signature: sha256=9f4c...e81b',
    codeLines: [
      '{',
      '  "event": "incident:created",',
      '  "service": "Payments Gateway",',
      '  "cause": "HTTP 503 Service Unavailable",',
      '  "startedAt": "2026-11-28T12:14:02Z",',
      '  "signatureVerified": true',
      '}',
    ],
  },
];

const BENEFITS: Array<{
  kind: BenefitVisualKind;
  ariaLabel: string;
  icon: typeof Clock;
  accent: string;
  title: string;
  description: string;
}> = [
  {
    kind: 'mttd',
    ariaLabel: '2D Canvas timeline comparing 42 minute manual discovery versus under 60 second PulseStack detection',
    icon: Clock,
    accent: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
    title: 'Detect Outages in Seconds',
    description:
      'Automated background workers spot slowdowns and 5xx outages immediately—cutting Mean Time to Detect without manual checks.',
  },
  {
    kind: 'telemetry',
    ariaLabel: '2D Canvas radial 99.98% SLA gauge and real-time latency sparkline',
    icon: Zap,
    accent: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    title: 'Zero-Refresh Live Telemetry',
    description:
      'Watch real-time latency sparklines, operational SLA percentages, and incoming check logs update live over WebSockets.',
  },
  {
    kind: 'webhook',
    ariaLabel: '2D Canvas showing webhook payload signed with SHA-256 and exponential retry backoff',
    icon: Webhook,
    accent: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
    title: 'Verifiable Webhook Delivery',
    description:
      'Send incident and recovery payloads to Slack, Discord, or custom APIs signed with HMAC-SHA256 and full delivery audit logs.',
  },
  {
    kind: 'security',
    ariaLabel: '2D Canvas showing 15 minute in-memory JWT paired with 7 day rotating refresh cookie',
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
        <Badge
          variant="outline"
          className="mb-3 border-indigo-500/30 text-indigo-300 bg-indigo-500/10"
        >
          Problem &amp; Solution
        </Badge>
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
          See the difference as you scroll
        </h2>
        <p className="text-sm sm:text-base text-slate-400 mt-2 leading-relaxed">
          Each 2D visualization below contrasts fragile manual monitoring on the left with PulseStack&apos;s automated architecture on the right.
        </p>
      </div>

      <div className="space-y-6">
        {PROBLEM_SOLUTIONS.map((row) => (
          <div
            key={row.variant}
            className="rounded-2xl border border-slate-800/80 bg-slate-900/45 p-4 sm:p-5 space-y-4 transition-colors hover:border-slate-700/80"
          >
            {/* Scroll-reactive 2D Canvas Visual Comparison */}
            <ProblemSolutionSceneCanvas variant={row.variant} ariaLabel={row.ariaLabel} />

            {/* Concise Side-by-Side Captions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              <div className="rounded-xl border border-rose-500/20 bg-rose-950/15 px-4 py-3">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-rose-400 mb-1">
                  <XCircle className="h-3.5 w-3.5 flex-shrink-0" />
                  The Problem · {row.problemTitle}
                </div>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                  {row.problemDesc}
                </p>
              </div>

              <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/15 px-4 py-3">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-emerald-400 mb-1">
                  <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0" />
                  Solution · {row.solutionTitle}
                </div>
                <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
                  {row.solutionDesc}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function WorkflowStepperSection() {
  const sectionRef = useRef<HTMLDivElement | null>(null);
  const { activeStep: scrollStep } = useScrollProgress(sectionRef, { steps: 3, damping: 0.12 });
  const [pinnedStep, setPinnedStep] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<'visual' | 'json'>('visual');

  const displayStep = pinnedStep ?? scrollStep;
  const current = WORKFLOW_STEPS[displayStep] ?? WORKFLOW_STEPS[0];

  return (
    <section
      id="how-it-works"
      ref={sectionRef}
      className="relative z-10 max-w-6xl mx-auto w-full px-6 py-16 border-t border-slate-800/70"
    >
      <div className="max-w-2xl mb-10">
        <Badge
          variant="outline"
          className="mb-3 border-cyan-500/30 text-cyan-300 bg-cyan-500/10"
        >
          How It Works
        </Badge>
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
          Scroll through the 3-step monitoring lifecycle
        </h2>
        <p className="text-sm sm:text-base text-slate-400 mt-2 leading-relaxed">
          As you scroll, the sticky 2D stage animates from monitor scheduling to live WebSocket streaming and signed incident alerts—or click any step to pin it.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: 3 Scroll-Tracked Story Steps */}
        <div className="lg:col-span-5 space-y-4">
          {WORKFLOW_STEPS.map((item, idx) => {
            const isSelected = idx === displayStep;
            return (
              <button
                key={item.step}
                type="button"
                onClick={() => setPinnedStep((prev) => (prev === idx ? null : idx))}
                className={cn(
                  'w-full text-left rounded-xl border p-5 transition-all duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 active:scale-[0.99]',
                  isSelected
                    ? 'border-indigo-500/70 bg-indigo-950/35 shadow-lg shadow-indigo-950/25'
                    : 'border-slate-800/80 bg-slate-900/45 opacity-80 hover:opacity-100 hover:bg-slate-900/80 hover:border-slate-700'
                )}
              >
                <div className="flex items-start gap-3.5">
                  <span
                    className={cn(
                      'font-mono text-xs font-bold px-2.5 py-1 rounded-md border flex-shrink-0',
                      isSelected
                        ? 'bg-indigo-600 text-white border-indigo-500'
                        : 'bg-slate-800/80 text-slate-400 border-slate-700'
                    )}
                  >
                    {item.step}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm sm:text-base font-semibold text-white">
                        {item.title}
                      </h3>
                      {pinnedStep === idx && (
                        <span className="text-[10px] font-mono text-indigo-300 bg-indigo-500/15 border border-indigo-500/30 rounded px-1.5 py-0.5">
                          Pinned
                        </span>
                      )}
                    </div>
                    <p className="text-xs sm:text-sm text-slate-400 mt-1.5 leading-relaxed">
                      {item.summary}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}

          {pinnedStep !== null && (
            <button
              type="button"
              onClick={() => setPinnedStep(null)}
              className="text-xs font-mono text-indigo-400 hover:text-indigo-300 underline underline-offset-4 cursor-pointer"
            >
              Resume automatic scroll sync
            </button>
          )}
        </div>

        {/* Right Column: Sticky 2D Canvas Stage + Optional JSON Contract View */}
        <div className="lg:col-span-7 lg:sticky lg:top-24 rounded-2xl border border-slate-800 bg-slate-950/90 flex flex-col justify-between overflow-hidden shadow-2xl">
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-slate-800/80 bg-slate-900/70">
            <div className="flex items-center gap-2 text-xs font-mono text-slate-300">
              {viewMode === 'visual' ? (
                <Eye className="h-3.5 w-3.5 text-cyan-400" />
              ) : (
                <Terminal className="h-3.5 w-3.5 text-indigo-400" />
              )}
              <span>{viewMode === 'visual' ? current.badge : current.codeTitle}</span>
            </div>

            <div
              className="inline-flex rounded-lg border border-slate-800 bg-slate-950 p-0.5"
              role="tablist"
              aria-label="Workflow preview mode"
            >
              <button
                type="button"
                role="tab"
                aria-selected={viewMode === 'visual'}
                onClick={() => setViewMode('visual')}
                className={cn(
                  'px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer',
                  viewMode === 'visual'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-white'
                )}
              >
                Visual Stage
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={viewMode === 'json'}
                onClick={() => setViewMode('json')}
                className={cn(
                  'px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer',
                  viewMode === 'json'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-white'
                )}
              >
                Inspect JSON
              </button>
            </div>
          </div>

          {viewMode === 'visual' ? (
            <WorkflowScrollCanvas
              scrollContainerRef={sectionRef}
              activeStep={scrollStep}
              pinnedStep={pinnedStep}
            />
          ) : (
            <pre className="p-6 min-h-[250px] sm:min-h-[320px] text-xs sm:text-sm font-mono text-slate-200 overflow-x-auto leading-relaxed">
              <code>{current.codeLines.join('\n')}</code>
            </pre>
          )}

          <div className="px-4 py-3 border-t border-slate-800/80 bg-slate-900/40 flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <Radio className="h-3.5 w-3.5 text-emerald-400" />
              {pinnedStep === null
                ? 'Synced to your scroll position'
                : 'Step pinned — click again to resume scroll sync'}
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
        <Badge
          variant="outline"
          className="mb-3 border-emerald-500/30 text-emerald-300 bg-emerald-500/10"
        >
          User Benefits
        </Badge>
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
          Built for clarity, speed, and production trust
        </h2>
        <p className="text-sm sm:text-base text-slate-400 mt-2 leading-relaxed">
          Every benefit below visualizes how PulseStack protects uptime, eliminates manual refreshes, and secures multi-tenant data.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {BENEFITS.map((benefit) => {
          const Icon = benefit.icon;
          return (
            <div
              key={benefit.title}
              className="rounded-xl border border-slate-800/80 bg-slate-900/55 p-5 transition-all duration-150 hover:border-slate-700 hover:bg-slate-900/80"
            >
              <BenefitVisualCanvas kind={benefit.kind} ariaLabel={benefit.ariaLabel} />

              <div className="flex items-center gap-3 mb-2">
                <div
                  className={cn(
                    'h-8 w-8 rounded-lg border flex items-center justify-center flex-shrink-0',
                    benefit.accent
                  )}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <h3 className="text-base font-semibold text-white">{benefit.title}</h3>
              </div>

              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
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
