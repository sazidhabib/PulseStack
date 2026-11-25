'use client';

import React, { useEffect, useRef, useState, useCallback, useSyncExternalStore } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Pause,
  Play,
  RotateCcw,
  Shield,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type SimulationScenario = 'healthy' | 'outage' | 'isolation';

interface CanvasNode {
  id: string;
  label: string;
  sublabel: string;
  nx: number;
  ny: number;
  accent: string;
  statusText: string;
  explanation: string;
  interactiveToggle?: boolean;
}

interface CanvasEdge {
  id: string;
  from: string;
  to: string;
  color: string;
  dashed?: boolean;
  lane?: 'primary' | 'alert' | 'tenantA' | 'tenantB';
}

interface Packet {
  edgeId: string;
  t: number;
  speed: number;
  color: string;
  radius: number;
  label?: string;
}

interface Ripple {
  nx: number;
  ny: number;
  radius: number;
  maxRadius: number;
  alpha: number;
  color: string;
}

const SCENARIO_META: Record<
  SimulationScenario,
  {
    title: string;
    badge: string;
    announcement: string;
    latencyLabel: string;
  }
> = {
  healthy: {
    title: 'Healthy Stream',
    badge: 'ALL SYSTEMS OPERATIONAL · 38ms AVG',
    announcement:
      'Healthy Stream active: BullMQ workers ping endpoints every 60s and stream 200 OK telemetry over WebSockets.',
    latencyLabel: '38 ms avg',
  },
  outage: {
    title: 'Outage & Alerting',
    badge: 'INCIDENT OPEN · HMAC WEBHOOK DISPATCHED',
    announcement:
      'Outage simulated on Payments API: BullMQ detected 503 failure, opened an incident, and fired an HMAC-SHA256 webhook.',
    latencyLabel: '503 spike',
  },
  isolation: {
    title: 'Multi-Tenant Isolation',
    badge: 'ROW-LEVEL & CHANNEL ISOLATION · ZERO CROSS-LEAK',
    announcement:
      'Multi-Tenant Isolation active: Org A and Org B telemetry travel in strictly scoped Redis channels and WebSocket rooms.',
    latencyLabel: '2 org lanes',
  },
};

function getScenarioGraph(
  scenario: SimulationScenario,
  isOutageActive: boolean
): { nodes: CanvasNode[]; edges: CanvasEdge[] } {
  if (scenario === 'isolation') {
    const nodes: CanvasNode[] = [
      {
        id: 'orgA-api',
        label: 'Org A · Acme API',
        sublabel: '200 OK · 31ms',
        nx: 0.16,
        ny: 0.24,
        accent: '#10b981',
        statusText: 'Tenant A Probe',
        explanation:
          'Acme Corp monitors its own endpoints; every database row is tagged and queried with orgId = org_acme.',
      },
      {
        id: 'orgB-api',
        label: 'Org B · Nova API',
        sublabel: '200 OK · 47ms',
        nx: 0.16,
        ny: 0.64,
        accent: '#06b6d4',
        statusText: 'Tenant B Probe',
        explanation:
          'Nova Labs runs independent scheduled checks with zero visibility into Acme Corp monitors or incidents.',
      },
      {
        id: 'bullmq',
        label: 'BullMQ Workers',
        sublabel: 'Scoped Jobs',
        nx: 0.44,
        ny: 0.44,
        accent: '#6366f1',
        statusText: 'Isolated Queue Execution',
        explanation:
          'Distributed workers attach orgId to each job payload so check results and retries never mix across organizations.',
      },
      {
        id: 'redis-a',
        label: 'ch: org_acme',
        sublabel: 'Redis Pub/Sub',
        nx: 0.68,
        ny: 0.24,
        accent: '#10b981',
        statusText: 'Tenant A Channel',
        explanation:
          'Worker publishes results only to health-check:org_acme; WsManager routes events strictly to Acme sockets.',
      },
      {
        id: 'redis-b',
        label: 'ch: org_nova',
        sublabel: 'Redis Pub/Sub',
        nx: 0.68,
        ny: 0.64,
        accent: '#06b6d4',
        statusText: 'Tenant B Channel',
        explanation:
          'Separate Redis Pub/Sub channel guarantees Tenant B receives only its own real-time WebSocket stream.',
      },
      {
        id: 'dash-a',
        label: 'Acme Dashboard',
        sublabel: 'WS Room A',
        nx: 0.88,
        ny: 0.24,
        accent: '#818cf8',
        statusText: 'Org A Live UI',
        explanation:
          'Protected by 15m in-memory JWT + 7d rotating httpOnly refresh tokens with reuse breach detection.',
      },
      {
        id: 'dash-b',
        label: 'Nova Dashboard',
        sublabel: 'WS Room B',
        nx: 0.88,
        ny: 0.64,
        accent: '#22d3ee',
        statusText: 'Org B Live UI',
        explanation:
          'Strict tenant registry in WsManager ensures zero cross-tenant telemetry leakage even under high load.',
      },
    ];

    const edges: CanvasEdge[] = [
      { id: 'a1', from: 'orgA-api', to: 'bullmq', color: '#10b981', lane: 'tenantA' },
      { id: 'a2', from: 'bullmq', to: 'redis-a', color: '#10b981', lane: 'tenantA' },
      { id: 'a3', from: 'redis-a', to: 'dash-a', color: '#818cf8', lane: 'tenantA' },
      { id: 'b1', from: 'orgB-api', to: 'bullmq', color: '#06b6d4', lane: 'tenantB' },
      { id: 'b2', from: 'bullmq', to: 'redis-b', color: '#06b6d4', lane: 'tenantB' },
      { id: 'b3', from: 'redis-b', to: 'dash-b', color: '#22d3ee', lane: 'tenantB' },
    ];

    return { nodes, edges };
  }

  const outageOn = scenario === 'outage' || isOutageActive;

  const nodes: CanvasNode[] = [
    {
      id: 'auth-api',
      label: 'Auth Service',
      sublabel: '200 OK · 34ms',
      nx: 0.15,
      ny: 0.2,
      accent: '#10b981',
      statusText: 'Healthy Endpoint',
      explanation:
        'Checked on a repeatable BullMQ schedule (60s–900s). Measures high-resolution latency and validates HTTP status.',
    },
    {
      id: 'payments-api',
      label: 'Payments API',
      sublabel: outageOn ? '503 Timeout!' : '200 OK · 41ms',
      nx: 0.15,
      ny: 0.46,
      accent: outageOn ? '#f43f5e' : '#10b981',
      statusText: outageOn ? 'Simulated Outage (Click to Restore)' : 'Healthy Endpoint (Click to Test Outage)',
      explanation: outageOn
        ? 'Payments API stopped responding. PulseStack immediately flips monitor status to DOWN and opens an audit-logged incident.'
        : 'Click this node or use "Simulate Outage" to watch how PulseStack detects downtime and triggers instant alerts.',
      interactiveToggle: true,
    },
    {
      id: 'webhook-sink',
      label: 'Billing Worker',
      sublabel: '200 OK · 52ms',
      nx: 0.15,
      ny: 0.72,
      accent: '#06b6d4',
      statusText: 'Healthy Endpoint',
      explanation:
        'Each endpoint runs independently with abort timeouts so one slow API never blocks checks for your other services.',
    },
    {
      id: 'worker',
      label: 'BullMQ Worker',
      sublabel: outageOn ? 'Incident Trigger' : 'Cron Ping Engine',
      nx: 0.43,
      ny: 0.46,
      accent: outageOn ? '#f59e0b' : '#6366f1',
      statusText: 'Background Job Engine',
      explanation:
        'Executes scheduled HTTP checks in the background, logs telemetry to PostgreSQL, and triggers auto-incidents on failure.',
    },
    {
      id: 'redis',
      label: 'Redis Pub/Sub',
      sublabel: 'Live Event Bus',
      nx: 0.67,
      ny: 0.34,
      accent: '#818cf8',
      statusText: 'Sub-Second Event Backplane',
      explanation:
        'Broadcasts check results and status transitions across API instances so your dashboard updates live without polling.',
    },
    {
      id: 'dashboard',
      label: 'Live Dashboard',
      sublabel: outageOn ? 'Status: DOWN' : 'WS Connected',
      nx: 0.87,
      ny: 0.24,
      accent: outageOn ? '#f43f5e' : '#10b981',
      statusText: 'Real-Time WebSocket UI',
      explanation:
        'Streams live latency sparklines, uptime percentage, and active incident counters directly to engineers in real time.',
    },
    {
      id: 'webhook-alert',
      label: 'Signed Webhook',
      sublabel: outageOn ? 'X-Pulse-Signature' : 'Standby (HMAC)',
      nx: 0.87,
      ny: 0.66,
      accent: outageOn ? '#f43f5e' : '#475569',
      statusText: outageOn ? 'Alert Dispatched' : 'Webhook Dispatcher',
      explanation:
        'On outage or recovery, BullMQ dispatches JSON payloads signed with HMAC-SHA256 (X-Pulse-Signature) and exponential retry backoff.',
    },
  ];

  const edges: CanvasEdge[] = [
    { id: 'e-auth', from: 'auth-api', to: 'worker', color: '#10b981', lane: 'primary' },
    {
      id: 'e-pay',
      from: 'payments-api',
      to: 'worker',
      color: outageOn ? '#f43f5e' : '#10b981',
      lane: outageOn ? 'alert' : 'primary',
    },
    { id: 'e-bill', from: 'webhook-sink', to: 'worker', color: '#06b6d4', lane: 'primary' },
    {
      id: 'e-pub',
      from: 'worker',
      to: 'redis',
      color: outageOn ? '#f59e0b' : '#818cf8',
      lane: 'primary',
    },
    {
      id: 'e-ws',
      from: 'redis',
      to: 'dashboard',
      color: outageOn ? '#f43f5e' : '#10b981',
      lane: outageOn ? 'alert' : 'primary',
    },
    {
      id: 'e-hook',
      from: 'worker',
      to: 'webhook-alert',
      color: outageOn ? '#f43f5e' : '#475569',
      dashed: !outageOn,
      lane: 'alert',
    },
  ];

  return { nodes, edges };
}

function evalCubicBezier(
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number },
  t: number
) {
  const u = 1 - t;
  const tt = t * t;
  const uu = u * u;
  const uuu = uu * u;
  const ttt = tt * t;

  return {
    x: uuu * p0.x + 3 * uu * t * p1.x + 3 * u * tt * p2.x + ttt * p3.x,
    y: uuu * p0.y + 3 * uu * t * p1.y + 3 * u * tt * p2.y + ttt * p3.y,
  };
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function subscribeReducedMotion(callback: () => void) {
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  mq.addEventListener('change', callback);
  return () => mq.removeEventListener('change', callback);
}

function getReducedMotionSnapshot() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function getReducedMotionServerSnapshot() {
  return false;
}

export function TelemetryCanvas() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [scenario, setScenario] = useState<SimulationScenario>('healthy');
  const [isOutageActive, setIsOutageActive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const prefersReducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    getReducedMotionServerSnapshot
  );
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string>('worker');

  const packetsRef = useRef<Packet[]>([]);
  const ripplesRef = useRef<Ripple[]>([]);
  const waveHistoryRef = useRef<number[]>(
    Array.from({ length: 48 }, (_, i) => 34 + Math.sin(i * 0.4) * 6)
  );
  const sizeRef = useRef<{ width: number; height: number }>({ width: 640, height: 380 });
  const isVisibleRef = useRef(true);
  const isTabVisibleRef = useRef(true);

  const effectiveOutage = scenario === 'outage' || (scenario === 'healthy' && isOutageActive);
  const effectiveScenario: SimulationScenario =
    scenario === 'isolation' ? 'isolation' : effectiveOutage ? 'outage' : 'healthy';

  const { nodes } = getScenarioGraph(scenario, isOutageActive);
  const activeInspectId = hoveredNodeId ?? selectedNodeId;
  const inspectedNode =
    nodes.find((n) => n.id === activeInspectId) ?? nodes[0];

  // Track tab visibility + viewport intersection so canvas uses 0 CPU when off-screen
  useEffect(() => {
    const handleVisibility = () => {
      isTabVisibleRef.current = document.visibilityState === 'visible';
    };
    document.addEventListener('visibilitychange', handleVisibility);

    const observer = new IntersectionObserver(
      (entries) => {
        isVisibleRef.current = entries[0]?.isIntersecting ?? true;
      },
      { threshold: 0.05 }
    );
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      observer.disconnect();
    };
  }, []);

  // Seed packets cleanly whenever scenario changes
  useEffect(() => {
    const { edges: nextEdges } = getScenarioGraph(scenario, isOutageActive);
    const initialPackets: Packet[] = nextEdges.map((edge, idx) => ({
      edgeId: edge.id,
      t: (idx * 0.23) % 1,
      speed: edge.lane === 'alert' ? 0.55 : 0.4,
      color: edge.color,
      radius: edge.lane === 'alert' ? 4.5 : 3.5,
    }));
    packetsRef.current = initialPackets;
  }, [scenario, isOutageActive]);

  const renderFrame = useCallback(
    (ctx: CanvasRenderingContext2D, width: number, height: number, now: number, animate: boolean) => {
      const { nodes: curNodes, edges: curEdges } = getScenarioGraph(scenario, isOutageActive);
      const compact = width < 480;
      const stageHeight = height - 64; // Reserve bottom 64px for live waveform strip

      ctx.clearRect(0, 0, width, height);

      // 1. Subtle technical dot grid background
      ctx.fillStyle = 'rgba(148, 163, 184, 0.08)';
      const gridStep = 24;
      for (let gx = 16; gx < width; gx += gridStep) {
        for (let gy = 16; gy < stageHeight; gy += gridStep) {
          ctx.fillRect(gx, gy, 1.2, 1.2);
        }
      }

      // 2. Multi-tenant firewall divider when in isolation mode
      if (scenario === 'isolation') {
        const midY = stageHeight * 0.44;
        ctx.save();
        ctx.setLineDash([5, 5]);
        ctx.strokeStyle = 'rgba(99, 102, 241, 0.35)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(16, midY);
        ctx.lineTo(width - 16, midY);
        ctx.stroke();
        ctx.restore();

        ctx.fillStyle = 'rgba(129, 140, 248, 0.85)';
        ctx.font = '600 10px ui-monospace, SFMono-Regular, Menlo, monospace';
        ctx.textAlign = 'right';
        ctx.fillText('STRICT orgId BOUNDARY', width - 18, midY - 6);
      }

      // Helper to get pixel position of node
      const getPos = (n: CanvasNode) => ({
        x: n.nx * width,
        y: n.ny * stageHeight,
      });

      const nodeMap = new Map(curNodes.map((n) => [n.id, n]));

      // 3. Draw Bezier connections
      curEdges.forEach((edge) => {
        const fromNode = nodeMap.get(edge.from);
        const toNode = nodeMap.get(edge.to);
        if (!fromNode || !toNode) return;

        const p0 = getPos(fromNode);
        const p3 = getPos(toNode);
        const dx = (p3.x - p0.x) * 0.48;
        const p1 = { x: p0.x + dx, y: p0.y };
        const p2 = { x: p3.x - dx, y: p3.y };

        const isHighlighted =
          hoveredNodeId === edge.from ||
          hoveredNodeId === edge.to ||
          selectedNodeId === edge.from ||
          selectedNodeId === edge.to;

        ctx.save();
        if (edge.dashed) {
          ctx.setLineDash([4, 5]);
        }
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.bezierCurveTo(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y);
        ctx.strokeStyle = isHighlighted ? edge.color : `${edge.color}55`;
        ctx.lineWidth = isHighlighted ? 2.2 : 1.5;
        ctx.stroke();
        ctx.restore();
      });

      // 4. Draw expanding alert/pulse ripples
      ripplesRef.current.forEach((ripple) => {
        ctx.save();
        ctx.beginPath();
        ctx.arc(ripple.nx * width, ripple.ny * stageHeight, ripple.radius, 0, Math.PI * 2);
        ctx.strokeStyle = ripple.color;
        ctx.globalAlpha = ripple.alpha;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();
      });

      // 5. Draw moving signal packets
      packetsRef.current.forEach((pkt) => {
        const edge = curEdges.find((e) => e.id === pkt.edgeId);
        if (!edge) return;
        if (edge.dashed && !effectiveOutage) return; // Keep webhook standby quiet until outage

        const fromNode = nodeMap.get(edge.from);
        const toNode = nodeMap.get(edge.to);
        if (!fromNode || !toNode) return;

        const p0 = getPos(fromNode);
        const p3 = getPos(toNode);
        const dx = (p3.x - p0.x) * 0.48;
        const p1 = { x: p0.x + dx, y: p0.y };
        const p2 = { x: p3.x - dx, y: p3.y };

        const pos = evalCubicBezier(p0, p1, p2, p3, pkt.t);

        // Glow halo
        const grad = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, pkt.radius * 3.2);
        grad.addColorStop(0, `${pkt.color}cc`);
        grad.addColorStop(1, `${pkt.color}00`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, pkt.radius * 3.2, 0, Math.PI * 2);
        ctx.fill();

        // Core packet dot
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, pkt.radius * 0.65, 0, Math.PI * 2);
        ctx.fill();
      });

      // 6. Draw Nodes as clean telemetry cards
      const boxW = compact ? 92 : 114;
      const boxH = compact ? 38 : 42;

      curNodes.forEach((node) => {
        const { x, y } = getPos(node);
        const rx = x - boxW / 2;
        const ry = y - boxH / 2;
        const isHovered = hoveredNodeId === node.id;
        const isSelected = selectedNodeId === node.id;

        // Subtle outer glow on active/selected/outage
        if (isHovered || isSelected || (node.interactiveToggle && effectiveOutage)) {
          ctx.save();
          ctx.shadowColor = node.accent;
          ctx.shadowBlur = isHovered ? 18 : 12;
          drawRoundedRect(ctx, rx, ry, boxW, boxH, 9);
          ctx.fillStyle = '#0f172a';
          ctx.fill();
          ctx.restore();
        }

        // Card fill
        drawRoundedRect(ctx, rx, ry, boxW, boxH, 9);
        ctx.fillStyle = isHovered ? 'rgba(30, 41, 59, 0.96)' : 'rgba(15, 23, 42, 0.92)';
        ctx.fill();

        // Border
        ctx.lineWidth = isHovered || isSelected ? 1.6 : 1;
        ctx.strokeStyle = isHovered || isSelected ? node.accent : 'rgba(51, 65, 85, 0.85)';
        ctx.stroke();

        // Status indicator dot
        const pulse = animate ? 0.65 + 0.35 * Math.sin(now * 0.005 + node.nx * 10) : 1;
        ctx.save();
        ctx.globalAlpha = pulse;
        ctx.fillStyle = node.accent;
        ctx.beginPath();
        ctx.arc(rx + 11, ry + 14, 3.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Title
        ctx.fillStyle = '#f8fafc';
        ctx.font = compact ? '600 10px Inter, system-ui, sans-serif' : '600 11px Inter, system-ui, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(node.label, rx + 19, ry + 17, boxW - 24);

        // Sublabel
        ctx.fillStyle =
          node.accent === '#f43f5e' ? '#fda4af' : 'rgba(148, 163, 184, 0.95)';
        ctx.font = compact
          ? '500 9px ui-monospace, SFMono-Regular, monospace'
          : '500 9.5px ui-monospace, SFMono-Regular, monospace';
        ctx.fillText(node.sublabel, rx + 11, ry + 32, boxW - 18);
      });

      // 7. Bottom Live Latency Waveform Strip
      const stripTop = stageHeight + 6;
      const stripH = height - stripTop - 8;

      drawRoundedRect(ctx, 12, stripTop, width - 24, stripH, 8);
      ctx.fillStyle = 'rgba(2, 6, 23, 0.78)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(30, 41, 59, 0.9)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Strip label
      ctx.fillStyle = 'rgba(148, 163, 184, 0.85)';
      ctx.font = '600 10px ui-monospace, SFMono-Regular, monospace';
      ctx.textAlign = 'left';
      ctx.fillText(
        effectiveOutage ? 'LIVE TELEMETRY · 503 SPIKE' : 'LIVE TELEMETRY · LATENCY WAVE',
        22,
        stripTop + 16
      );

      // Draw waveform
      const wave = waveHistoryRef.current;
      const waveLeft = 22;
      const waveRight = width - 22;
      const waveWidth = waveRight - waveLeft;
      const waveBaseY = stripTop + stripH - 8;
      const waveMaxH = stripH - 24;

      if (wave.length > 1) {
        const strokeColor = effectiveOutage ? '#f43f5e' : '#10b981';
        ctx.beginPath();
        wave.forEach((val, i) => {
          const wx = waveLeft + (i / (wave.length - 1)) * waveWidth;
          const norm = Math.min(Math.max((val - 20) / 140, 0.05), 1);
          const wy = waveBaseY - norm * waveMaxH;
          if (i === 0) ctx.moveTo(wx, wy);
          else ctx.lineTo(wx, wy);
        });
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 1.6;
        ctx.stroke();
      }
    },
    [scenario, isOutageActive, hoveredNodeId, selectedNodeId, effectiveOutage]
  );

  // ResizeObserver + Animation Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const syncSize = () => {
      const rect = container.getBoundingClientRect();
      const width = Math.max(300, Math.floor(rect.width));
      const height = width < 480 ? 320 : 370;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { width, height };
    };

    syncSize();
    const ro = new ResizeObserver(syncSize);
    ro.observe(container);

    let animId = 0;
    let lastTime = performance.now();
    let waveTimer = 0;
    let rippleTimer = 0;

    const loop = (now: number) => {
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;

      const shouldAnimate =
        !isPaused && !prefersReducedMotion && isVisibleRef.current && isTabVisibleRef.current;

      if (shouldAnimate) {
        const { edges: curEdges, nodes: curNodes } = getScenarioGraph(scenario, isOutageActive);

        // Advance packets
        packetsRef.current.forEach((pkt) => {
          const edge = curEdges.find((e) => e.id === pkt.edgeId);
          if (!edge) return;
          pkt.color = edge.color;
          pkt.t += pkt.speed * dt;
          if (pkt.t >= 1) {
            pkt.t -= 1;
            const target = curNodes.find((n) => n.id === edge.to);
            if (target && ripplesRef.current.length < 10) {
              ripplesRef.current.push({
                nx: target.nx,
                ny: target.ny,
                radius: 8,
                maxRadius: edge.lane === 'alert' ? 38 : 26,
                alpha: 0.65,
                color: edge.color,
              });
            }
          }
        });

        // Advance ripples
        ripplesRef.current = ripplesRef.current
          .map((r) => ({
            ...r,
            radius: r.radius + 36 * dt,
            alpha: r.alpha - 0.9 * dt,
          }))
          .filter((r) => r.alpha > 0.03 && r.radius < r.maxRadius);

        // Periodic outage pulse ripple
        rippleTimer += dt;
        if (effectiveOutage && rippleTimer > 1.1) {
          rippleTimer = 0;
          const payNode = curNodes.find((n) => n.id === 'payments-api');
          if (payNode) {
            ripplesRef.current.push({
              nx: payNode.nx,
              ny: payNode.ny,
              radius: 10,
              maxRadius: 46,
              alpha: 0.8,
              color: '#f43f5e',
            });
          }
        }

        // Update waveform points every ~180ms
        waveTimer += dt;
        if (waveTimer > 0.18) {
          waveTimer = 0;
          const nextVal = effectiveOutage
            ? 110 + Math.random() * 48
            : 32 + Math.sin(now * 0.004) * 9 + Math.random() * 10;
          waveHistoryRef.current = [...waveHistoryRef.current.slice(1), nextVal];
        }
      }

      const { width, height } = sizeRef.current;
      renderFrame(ctx, width, height, now, shouldAnimate);
      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animId);
      ro.disconnect();
    };
  }, [isPaused, prefersReducedMotion, scenario, isOutageActive, effectiveOutage, renderFrame]);

  // Pointer hit testing against current canvas nodes
  const findHitNode = (clientX: number, clientY: number): CanvasNode | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    const px = clientX - rect.left;
    const py = clientY - rect.top;
    const { width, height } = sizeRef.current;
    const stageHeight = height - 64;
    const compact = width < 480;
    const halfW = (compact ? 92 : 114) / 2 + 6;
    const halfH = (compact ? 38 : 42) / 2 + 6;

    for (const node of nodes) {
      const nx = node.nx * width;
      const ny = node.ny * stageHeight;
      if (Math.abs(px - nx) <= halfW && Math.abs(py - ny) <= halfH) {
        return node;
      }
    }
    return null;
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const hit = findHitNode(e.clientX, e.clientY);
    setHoveredNodeId(hit ? hit.id : null);
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const hit = findHitNode(e.clientX, e.clientY);
    if (!hit) return;

    setSelectedNodeId(hit.id);
    if (hit.interactiveToggle) {
      if (scenario === 'outage') {
        setScenario('healthy');
        setIsOutageActive(false);
      } else {
        setIsOutageActive((prev) => !prev);
      }
    }
  };

  const handleScenarioSelect = (next: SimulationScenario) => {
    setScenario(next);
    setIsOutageActive(next === 'outage');
    if (next === 'isolation') {
      setSelectedNodeId('bullmq');
    } else if (next === 'outage') {
      setSelectedNodeId('payments-api');
    } else {
      setSelectedNodeId('worker');
    }
  };

  const handleToggleOutageButton = () => {
    if (scenario === 'isolation') {
      setScenario('outage');
      setIsOutageActive(true);
      setSelectedNodeId('payments-api');
      return;
    }
    if (effectiveOutage) {
      setScenario('healthy');
      setIsOutageActive(false);
    } else {
      setScenario('outage');
      setIsOutageActive(true);
      setSelectedNodeId('payments-api');
    }
  };

  const meta = SCENARIO_META[effectiveScenario];

  return (
    <div
      id="live-simulator"
      className="relative rounded-2xl border border-slate-800/90 bg-slate-900/75 backdrop-blur-md shadow-2xl shadow-indigo-950/30 overflow-hidden"
    >
      {/* Simulator Top Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-slate-800/80 bg-slate-950/60">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'h-2.5 w-2.5 rounded-full',
              effectiveOutage ? 'bg-rose-500 animate-ping' : 'bg-emerald-500'
            )}
          />
          <span className="text-[11px] font-mono font-semibold tracking-wide text-slate-200">
            {meta.badge}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleToggleOutageButton}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-all duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 active:scale-[0.98]',
              effectiveOutage
                ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25'
                : 'bg-rose-500/15 text-rose-300 border border-rose-500/30 hover:bg-rose-500/25'
            )}
          >
            {effectiveOutage ? (
              <>
                <RotateCcw className="h-3.5 w-3.5" /> Restore Service
              </>
            ) : (
              <>
                <AlertTriangle className="h-3.5 w-3.5" /> Simulate Outage
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => setIsPaused((p) => !p)}
            aria-label={isPaused ? 'Play simulation animation' : 'Pause simulation animation'}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-700/80 bg-slate-900 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800 hover:text-white transition-all duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 active:scale-[0.98]"
          >
            {isPaused || prefersReducedMotion ? (
              <Play className="h-3.5 w-3.5 text-indigo-400" />
            ) : (
              <Pause className="h-3.5 w-3.5 text-slate-400" />
            )}
          </button>
        </div>
      </div>

      {/* Scenario Switcher Tabs */}
      <div
        className="flex flex-wrap items-center gap-1.5 px-4 pt-3 pb-1"
        role="tablist"
        aria-label="Interactive pipeline scenarios"
      >
        {(
          [
            { id: 'healthy', label: 'Healthy Stream', icon: Activity },
            { id: 'outage', label: 'Outage & Alerting', icon: Zap },
            { id: 'isolation', label: 'Tenant Isolation', icon: Shield },
          ] as const
        ).map((tab) => {
          const Icon = tab.icon;
          const active = effectiveScenario === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => handleScenarioSelect(tab.id)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
                active
                  ? 'bg-indigo-600/25 text-indigo-300 border border-indigo-500/40'
                  : 'text-slate-400 border border-transparent hover:text-slate-200 hover:bg-slate-800/70'
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* 2D Canvas Stage */}
      <div ref={containerRef} className="relative w-full select-none">
        <canvas
          ref={canvasRef}
          onPointerMove={handlePointerMove}
          onPointerLeave={() => setHoveredNodeId(null)}
          onClick={handleCanvasClick}
          role="img"
          aria-label={`Interactive 2D PulseStack pipeline diagram showing ${meta.title}`}
          className={cn(
            'block w-full',
            hoveredNodeId ? 'cursor-pointer' : 'cursor-default'
          )}
        />
      </div>

      {/* Node Inspector & Plain-English Readout */}
      <div
        aria-live="polite"
        className="px-4 py-3 border-t border-slate-800/80 bg-slate-950/75 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {effectiveOutage && inspectedNode.accent === '#f43f5e' ? (
              <AlertTriangle className="h-3.5 w-3.5 text-rose-400 flex-shrink-0" />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0" />
            )}
            <span className="text-xs font-semibold text-white">
              {inspectedNode.label}
            </span>
            <span className="text-[11px] font-mono text-indigo-300">
              — {inspectedNode.statusText}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1 leading-relaxed">
            {inspectedNode.explanation}
          </p>
        </div>

        <span className="text-[11px] font-mono text-slate-500 flex-shrink-0 self-start sm:self-center">
          Click any node to inspect
        </span>
      </div>
      <span className="sr-only">{meta.announcement}</span>
    </div>
  );
}
