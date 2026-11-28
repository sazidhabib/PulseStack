'use client';

import React, { useEffect, useRef } from 'react';
import {
  drawDotGrid,
  drawGlowingDot,
  drawRoundedRect,
  evalCubicBezier,
  syncHiDPICanvas,
  usePrefersReducedMotion,
} from '@/components/home/canvas-utils';
import { useScrollProgress } from '@/hooks/use-scroll-progress';

export type ProblemSolutionVariant = 'radar' | 'pubsub' | 'isolation';

interface ProblemSolutionSceneCanvasProps {
  variant: ProblemSolutionVariant;
  ariaLabel: string;
}

/**
 * Scroll-reactive 2D Canvas comparing "The Problem" (left half) against
 * "PulseStack Solution" (right half) visually as the user scrolls past.
 */
export function ProblemSolutionSceneCanvas({
  variant,
  ariaLabel,
}: ProblemSolutionSceneCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const prefersReducedMotion = usePrefersReducedMotion();
  const { smoothProgressRef, isVisibleRef } = useScrollProgress(containerRef, {
    steps: 1,
    damping: 0.14,
  });

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let size = { width: 640, height: 210 };
    const sync = () => {
      const rect = container.getBoundingClientRect();
      const targetH = rect.width < 520 ? 250 : 200;
      size = syncHiDPICanvas(canvas, ctx, rect.width, targetH);
    };
    sync();

    const ro = new ResizeObserver(sync);
    ro.observe(container);

    let rafId = 0;

    const render = (now: number) => {
      const { width, height } = size;
      const p = prefersReducedMotion ? 0.72 : smoothProgressRef.current;
      const t = prefersReducedMotion ? 1.2 : now * 0.001;
      const stacked = width < 520;

      ctx.clearRect(0, 0, width, height);
      drawDotGrid(ctx, width, height, 22, 0.06);

      const leftRect = stacked
        ? { x: 10, y: 8, w: width - 20, h: height / 2 - 12 }
        : { x: 10, y: 10, w: width / 2 - 16, h: height - 20 };

      const rightRect = stacked
        ? { x: 10, y: height / 2 + 4, w: width - 20, h: height / 2 - 12 }
        : { x: width / 2 + 6, y: 10, w: width / 2 - 16, h: height - 20 };

      // Left backdrop (Problem)
      drawRoundedRect(ctx, leftRect.x, leftRect.y, leftRect.w, leftRect.h, 12);
      ctx.fillStyle = 'rgba(76, 5, 25, 0.22)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(244, 63, 94, 0.24)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Right backdrop (Solution)
      drawRoundedRect(ctx, rightRect.x, rightRect.y, rightRect.w, rightRect.h, 12);
      ctx.fillStyle = 'rgba(6, 78, 59, 0.16)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.28)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Labels
      ctx.font = '600 9.5px ui-monospace, SFMono-Regular, monospace';
      ctx.textAlign = 'left';
      ctx.fillStyle = '#fda4af';
      ctx.fillText('WITHOUT PULSESTACK', leftRect.x + 12, leftRect.y + 18);
      ctx.fillStyle = '#6ee7b7';
      ctx.fillText('WITH PULSESTACK', rightRect.x + 12, rightRect.y + 18);

      if (variant === 'radar') {
        drawRadarScene(ctx, leftRect, rightRect, p, t);
      } else if (variant === 'pubsub') {
        drawPubSubScene(ctx, leftRect, rightRect, p, t);
      } else {
        drawIsolationScene(ctx, leftRect, rightRect, p, t);
      }
    };

    const loop = (now: number) => {
      if (isVisibleRef.current || prefersReducedMotion) {
        render(now);
      }
      if (!prefersReducedMotion) {
        rafId = requestAnimationFrame(loop);
      }
    };

    render(performance.now());
    if (!prefersReducedMotion) {
      rafId = requestAnimationFrame(loop);
    }

    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
    };
  }, [variant, prefersReducedMotion, smoothProgressRef, isVisibleRef]);

  return (
    <div
      ref={containerRef}
      className="relative w-full rounded-xl border border-slate-800/90 bg-slate-950/75 overflow-hidden"
    >
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={ariaLabel}
        className="block w-full"
      />
    </div>
  );
}

function drawRadarScene(
  ctx: CanvasRenderingContext2D,
  left: { x: number; y: number; w: number; h: number },
  right: { x: number; y: number; w: number; h: number },
  p: number,
  t: number
) {
  // LEFT: Silent outage flatline + late user complaint
  const ly = left.y + left.h * 0.56;
  const lx1 = left.x + 18;
  const lx2 = left.x + left.w - 18;
  const breakX = lx1 + (lx2 - lx1) * 0.45;

  ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(lx1, ly);
  ctx.lineTo(breakX, ly);
  ctx.stroke();

  ctx.save();
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = 'rgba(244, 63, 94, 0.7)';
  ctx.beginPath();
  ctx.moveTo(breakX, ly);
  ctx.lineTo(lx2, ly + 14);
  ctx.stroke();
  ctx.restore();

  // Silent 503 dot
  ctx.fillStyle = '#f43f5e';
  ctx.beginPath();
  ctx.arc(breakX, ly, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fda4af';
  ctx.font = '600 9.5px ui-monospace, SFMono-Regular, monospace';
  ctx.textAlign = 'center';
  ctx.fillText('503 at 03:14 (Unseen)', breakX, ly - 12);

  // Late user warning slides in with scroll
  const userAlpha = Math.max(0.25, Math.min(1, p * 1.4));
  ctx.save();
  ctx.globalAlpha = userAlpha;
  drawRoundedRect(ctx, lx2 - 112, ly - 18, 108, 24, 6);
  ctx.fillStyle = 'rgba(244, 63, 94, 0.2)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(244, 63, 94, 0.6)';
  ctx.stroke();
  ctx.fillStyle = '#fecdd3';
  ctx.font = '600 9px Inter, system-ui, sans-serif';
  ctx.fillText('User Ticket @ 04:02', lx2 - 58, ly - 3);
  ctx.restore();

  // RIGHT: Active 2D Radar Sweep synced to scroll + time
  const cx = right.x + right.w * 0.34;
  const cy = right.y + right.h * 0.57;
  const r = Math.min(right.w * 0.24, right.h * 0.36);

  [0.45, 0.75, 1].forEach((scale) => {
    ctx.beginPath();
    ctx.arc(cx, cy, r * scale, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.22)';
    ctx.lineWidth = 1;
    ctx.stroke();
  });

  // Rotating sweep beam driven by scroll progress + subtle live motion
  const sweepAngle = p * Math.PI * 3.5 + t * 1.1;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.arc(cx, cy, r, sweepAngle - 0.55, sweepAngle);
  ctx.closePath();
  const sweepGrad = ctx.createRadialGradient(cx, cy, 2, cx, cy, r);
  sweepGrad.addColorStop(0, 'rgba(16, 185, 129, 0.38)');
  sweepGrad.addColorStop(1, 'rgba(16, 185, 129, 0.04)');
  ctx.fillStyle = sweepGrad;
  ctx.fill();
  ctx.restore();

  // Sweep line
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(sweepAngle) * r, cy + Math.sin(sweepAngle) * r);
  ctx.strokeStyle = '#34d399';
  ctx.lineWidth = 1.6;
  ctx.stroke();

  // Endpoints on radar
  const blips = [
    { ang: 0.4, dist: 0.72, color: '#10b981' },
    { ang: 2.3, dist: 0.65, color: '#06b6d4' },
    { ang: 4.1, dist: 0.8, color: p > 0.45 ? '#f59e0b' : '#10b981' },
  ];
  blips.forEach((b) => {
    const bx = cx + Math.cos(b.ang) * r * b.dist;
    const by = cy + Math.sin(b.ang) * r * b.dist;
    drawGlowingDot(ctx, bx, by, 3, b.color);
  });

  // Right-side status badge inside solution panel
  const badgeX = right.x + right.w * 0.58;
  const badgeW = Math.max(96, right.w * 0.37);
  drawRoundedRect(ctx, badgeX, cy - 24, badgeW, 48, 8);
  ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
  ctx.fill();
  ctx.strokeStyle = p > 0.45 ? 'rgba(245, 158, 11, 0.6)' : 'rgba(16, 185, 129, 0.5)';
  ctx.stroke();

  ctx.textAlign = 'left';
  ctx.fillStyle = '#f8fafc';
  ctx.font = '600 10px Inter, system-ui, sans-serif';
  ctx.fillText('60s Cron Ping', badgeX + 10, cy - 5);
  ctx.fillStyle = p > 0.45 ? '#fcd34d' : '#6ee7b7';
  ctx.font = '500 9px ui-monospace, SFMono-Regular, monospace';
  ctx.fillText(p > 0.45 ? 'Caught in 18s!' : '200 OK · 36ms', badgeX + 10, cy + 12);
}

function drawPubSubScene(
  ctx: CanvasRenderingContext2D,
  left: { x: number; y: number; w: number; h: number },
  right: { x: number; y: number; w: number; h: number },
  p: number,
  t: number
) {
  // LEFT: Chaotic browser polling arrows slamming DB
  const dbX = left.x + left.w * 0.74;
  const dbY = left.y + left.h * 0.56;
  const shake = Math.sin(t * 16) * (1 + p * 1.5);

  [0.34, 0.56, 0.78].forEach((ny, idx) => {
    const sx = left.x + 28;
    const sy = left.y + left.h * ny;
    drawRoundedRect(ctx, sx - 14, sy - 10, 44, 20, 5);
    ctx.fillStyle = 'rgba(30, 41, 59, 0.9)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.4)';
    ctx.stroke();

    ctx.fillStyle = '#cbd5e1';
    ctx.font = '500 8.5px ui-monospace, SFMono-Regular, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`Tab ${idx + 1}`, sx + 8, sy + 3);

    // Colliding polling line
    ctx.beginPath();
    ctx.moveTo(sx + 32, sy);
    ctx.lineTo(dbX - 28, dbY);
    ctx.strokeStyle = 'rgba(244, 63, 94, 0.45)';
    ctx.lineWidth = 1.3;
    ctx.stroke();

    const pktT = (t * 0.8 + p + idx * 0.33) % 1;
    const px = sx + 32 + (dbX - 28 - (sx + 32)) * pktT;
    const py = sy + (dbY - sy) * pktT;
    drawGlowingDot(ctx, px, py, 2.5, '#f43f5e');
  });

  drawRoundedRect(ctx, dbX - 26 + shake, dbY - 22, 68, 44, 8);
  ctx.fillStyle = 'rgba(127, 29, 29, 0.45)';
  ctx.fill();
  ctx.strokeStyle = '#f43f5e';
  ctx.stroke();
  ctx.fillStyle = '#fecdd3';
  ctx.font = '600 9.5px ui-monospace, SFMono-Regular, monospace';
  ctx.textAlign = 'center';
  ctx.fillText('DB Poll', dbX + 8 + shake, dbY - 3);
  ctx.fillText('CPU 94%', dbX + 8 + shake, dbY + 11);

  // RIGHT: Redis Pub/Sub clean fan-out + live sparkline
  const busX = right.x + right.w * 0.28;
  const busY = right.y + right.h * 0.56;

  drawRoundedRect(ctx, busX - 38, busY - 18, 76, 36, 8);
  ctx.fillStyle = 'rgba(49, 46, 129, 0.55)';
  ctx.fill();
  ctx.strokeStyle = '#818cf8';
  ctx.stroke();
  ctx.fillStyle = '#e0e7ff';
  ctx.font = '600 9.5px Inter, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Redis Pub/Sub', busX, busY + 3);

  [0.34, 0.56, 0.78].forEach((ny, idx) => {
    const tx = right.x + right.w - 46;
    const ty = right.y + right.h * ny;
    const p0 = { x: busX + 38, y: busY };
    const p3 = { x: tx - 26, y: ty };
    const p1 = { x: p0.x + 28, y: p0.y };
    const p2 = { x: p3.x - 28, y: p3.y };

    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.bezierCurveTo(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y);
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.45)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    const pktT = (t * 0.6 + p * 1.2 + idx * 0.12) % 1;
    const pos = evalCubicBezier(p0, p1, p2, p3, pktT);
    drawGlowingDot(ctx, pos.x, pos.y, 2.8, '#10b981');

    drawRoundedRect(ctx, tx - 24, ty - 10, 56, 20, 5);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.5)';
    ctx.stroke();
    ctx.fillStyle = '#6ee7b7';
    ctx.font = '500 8.5px ui-monospace, SFMono-Regular, monospace';
    ctx.fillText(`WS #${idx + 1}`, tx + 4, ty + 3);
  });
}

function drawIsolationScene(
  ctx: CanvasRenderingContext2D,
  left: { x: number; y: number; w: number; h: number },
  right: { x: number; y: number; w: number; h: number },
  p: number,
  t: number
) {
  // LEFT: Mixed lanes + unverified alert
  const lMid = left.y + left.h * 0.56;
  ctx.save();
  ctx.setLineDash([3, 5]);
  ctx.strokeStyle = 'rgba(244, 63, 94, 0.4)';
  ctx.beginPath();
  ctx.moveTo(left.x + 14, lMid);
  ctx.lineTo(left.x + left.w - 14, lMid);
  ctx.stroke();
  ctx.restore();

  // Crossing leak curve
  const p0 = { x: left.x + 28, y: left.y + left.h * 0.36 };
  const p3 = { x: left.x + left.w - 28, y: left.y + left.h * 0.74 };
  const p1 = { x: left.x + left.w * 0.5, y: p0.y };
  const p2 = { x: left.x + left.w * 0.5, y: p3.y };
  ctx.beginPath();
  ctx.moveTo(p0.x, p0.y);
  ctx.bezierCurveTo(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y);
  ctx.strokeStyle = 'rgba(244, 63, 94, 0.55)';
  ctx.lineWidth = 1.6;
  ctx.stroke();

  const leakPos = evalCubicBezier(p0, p1, p2, p3, (t * 0.45 + p) % 1);
  drawGlowingDot(ctx, leakPos.x, leakPos.y, 3, '#f43f5e');

  ctx.fillStyle = '#fda4af';
  ctx.font = '600 9px ui-monospace, SFMono-Regular, monospace';
  ctx.textAlign = 'center';
  ctx.fillText('Cross-Tenant Leak / Unsigned', left.x + left.w / 2, left.y + left.h - 14);

  // RIGHT: Parallel sealed lanes + HMAC stamp
  const rMid = right.y + right.h * 0.56;
  const laneA = right.y + right.h * 0.36;
  const laneB = right.y + right.h * 0.75;
  const xStart = right.x + 22;
  const xEnd = right.x + right.w - 22;

  // Org A lane
  ctx.beginPath();
  ctx.moveTo(xStart, laneA);
  ctx.lineTo(xEnd, laneA);
  ctx.strokeStyle = 'rgba(16, 185, 129, 0.5)';
  ctx.lineWidth = 1.6;
  ctx.stroke();
  drawGlowingDot(ctx, xStart + ((xEnd - xStart) * ((t * 0.5 + p) % 1)), laneA, 2.8, '#10b981');

  // Strict wall
  ctx.beginPath();
  ctx.moveTo(xStart, rMid);
  ctx.lineTo(xEnd, rMid);
  ctx.strokeStyle = '#6366f1';
  ctx.lineWidth = 2;
  ctx.stroke();

  drawRoundedRect(ctx, right.x + right.w / 2 - 58, rMid - 10, 116, 20, 6);
  ctx.fillStyle = '#1e1b4b';
  ctx.fill();
  ctx.strokeStyle = '#818cf8';
  ctx.stroke();
  ctx.fillStyle = '#c7d2fe';
  ctx.font = '600 8.5px ui-monospace, SFMono-Regular, monospace';
  ctx.textAlign = 'center';
  ctx.fillText('orgId + HMAC-SHA256', right.x + right.w / 2, rMid + 3);

  // Org B lane
  ctx.beginPath();
  ctx.moveTo(xStart, laneB);
  ctx.lineTo(xEnd, laneB);
  ctx.strokeStyle = 'rgba(6, 182, 212, 0.5)';
  ctx.lineWidth = 1.6;
  ctx.stroke();
  drawGlowingDot(ctx, xStart + ((xEnd - xStart) * ((t * 0.5 + p + 0.5) % 1)), laneB, 2.8, '#06b6d4');
}

interface WorkflowScrollCanvasProps {
  /** Ref to the parent scrollytelling container */
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  /** Current active step index (0, 1, or 2) */
  activeStep: number;
  /** Optional manual override step when user clicks a step button */
  pinnedStep: number | null;
}

/**
 * Sticky 3-Act 2D Canvas Scrollytelling visual for `#how-it-works`.
 * Morphs seamlessly across Step 01 (Schedule) -> Step 02 (Ping & Stream) -> Step 03 (Incident & Signed Webhook)
 * as the user scrolls or selects a step.
 */
export function WorkflowScrollCanvas({
  scrollContainerRef,
  activeStep,
  pinnedStep,
}: WorkflowScrollCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const holderRef = useRef<HTMLDivElement | null>(null);
  const prefersReducedMotion = usePrefersReducedMotion();

  const { smoothProgressRef, isVisibleRef } = useScrollProgress(scrollContainerRef, {
    steps: 3,
    damping: 0.12,
  });

  useEffect(() => {
    const holder = holderRef.current;
    const canvas = canvasRef.current;
    if (!holder || !canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let size = { width: 520, height: 320 };
    const sync = () => {
      const rect = holder.getBoundingClientRect();
      const targetH = rect.width < 440 ? 250 : 320;
      size = syncHiDPICanvas(canvas, ctx, rect.width, targetH);
    };
    sync();

    const ro = new ResizeObserver(sync);
    ro.observe(holder);

    let rafId = 0;

    const render = (now: number) => {
      const { width, height } = size;
      const t = prefersReducedMotion ? 0.5 : now * 0.001;
      const stepToUse = pinnedStep ?? activeStep;
      const scrollP = prefersReducedMotion
        ? (stepToUse + 0.5) / 3
        : pinnedStep !== null
          ? (pinnedStep + 0.5) / 3
          : smoothProgressRef.current;

      ctx.clearRect(0, 0, width, height);
      drawDotGrid(ctx, width, height, 22, 0.07);

      // Top Progress Bar across the 3 Acts
      const barPad = 20;
      const barW = width - barPad * 2;
      drawRoundedRect(ctx, barPad, 16, barW, 6, 3);
      ctx.fillStyle = 'rgba(30, 41, 59, 0.9)';
      ctx.fill();

      drawRoundedRect(ctx, barPad, 16, Math.max(12, barW * scrollP), 6, 3);
      const barGrad = ctx.createLinearGradient(barPad, 0, barPad + barW, 0);
      barGrad.addColorStop(0, '#6366f1');
      barGrad.addColorStop(0.5, '#10b981');
      barGrad.addColorStop(1, '#f43f5e');
      ctx.fillStyle = barGrad;
      ctx.fill();

      // Act Indicator label
      ctx.font = '600 10px ui-monospace, SFMono-Regular, monospace';
      ctx.textAlign = 'left';
      ctx.fillStyle = '#94a3b8';
      const actLabel =
        stepToUse === 0
          ? 'ACT 01 · SCHEDULE ENDPOINT & CADENCE'
          : stepToUse === 1
            ? 'ACT 02 · WORKER PING & LIVE STREAM'
            : 'ACT 03 · AUTO-INCIDENT & SIGNED WEBHOOK';
      ctx.fillText(actLabel, barPad, 38);

      const stageTop = 48;
      const stageH = height - stageTop - 16;

      if (stepToUse === 0) {
        drawActOneSchedule(ctx, width, stageTop, stageH, scrollP, t);
      } else if (stepToUse === 1) {
        drawActTwoStream(ctx, width, stageTop, stageH, scrollP, t);
      } else {
        drawActThreeIncident(ctx, width, stageTop, stageH, scrollP, t);
      }
    };

    const loop = (now: number) => {
      if (isVisibleRef.current || prefersReducedMotion) {
        render(now);
      }
      if (!prefersReducedMotion) {
        rafId = requestAnimationFrame(loop);
      }
    };

    render(performance.now());
    if (!prefersReducedMotion) {
      rafId = requestAnimationFrame(loop);
    }

    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
    };
  }, [activeStep, pinnedStep, prefersReducedMotion, smoothProgressRef, isVisibleRef]);

  return (
    <div ref={holderRef} className="w-full">
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={`Scroll-driven workflow visualization for step ${
          (pinnedStep ?? activeStep) + 1
        }`}
        className="block w-full"
      />
    </div>
  );
}

function drawActOneSchedule(
  ctx: CanvasRenderingContext2D,
  width: number,
  top: number,
  h: number,
  scrollP: number,
  t: number
) {
  const cx = width * 0.34;
  const cy = top + h * 0.52;
  const r = Math.min(width * 0.22, h * 0.38);

  // Cron Orbit Ring
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(99, 102, 241, 0.25)';
  ctx.lineWidth = 4;
  ctx.stroke();

  const arcSpan = Math.PI * (0.4 + ((scrollP * 3 + t * 0.35) % 1) * 1.6);
  ctx.beginPath();
  ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + arcSpan);
  ctx.strokeStyle = '#818cf8';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.stroke();

  // Center cron badge
  ctx.textAlign = 'center';
  ctx.fillStyle = '#f8fafc';
  ctx.font = '700 18px ui-monospace, SFMono-Regular, monospace';
  ctx.fillText('60s', cx, cy + 2);
  ctx.fillStyle = '#94a3b8';
  ctx.font = '500 9.5px Inter, system-ui, sans-serif';
  ctx.fillText('BullMQ Repeat', cx, cy + 18);

  // Orbiting probe dot
  const ang = -Math.PI / 2 + arcSpan;
  drawGlowingDot(ctx, cx + Math.cos(ang) * r, cy + Math.sin(ang) * r, 4, '#22d3ee');

  // Target Endpoint Card on Right
  const cardX = width * 0.58;
  const cardW = Math.min(200, width * 0.37);
  drawRoundedRect(ctx, cardX, cy - 48, cardW, 96, 10);
  ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(99, 102, 241, 0.5)';
  ctx.lineWidth = 1.3;
  ctx.stroke();

  ctx.textAlign = 'left';
  ctx.fillStyle = '#a5b4fc';
  ctx.font = '600 9.5px ui-monospace, SFMono-Regular, monospace';
  ctx.fillText('TARGET MONITOR', cardX + 12, cy - 26);

  ctx.fillStyle = '#ffffff';
  ctx.font = '600 12px Inter, system-ui, sans-serif';
  ctx.fillText('Payments Gateway', cardX + 12, cy - 6);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '500 10px ui-monospace, SFMono-Regular, monospace';
  ctx.fillText('GET /health · Expect 200', cardX + 12, cy + 14);

  ctx.fillStyle = '#34d399';
  ctx.fillText('Interval: 60s · Timeout: 5s', cardX + 12, cy + 32);
}

function drawActTwoStream(
  ctx: CanvasRenderingContext2D,
  width: number,
  top: number,
  h: number,
  scrollP: number,
  t: number
) {
  const nodes = [
    { x: width * 0.16, y: top + h * 0.3, title: 'Worker', sub: '38ms HTTP', color: '#6366f1' },
    { x: width * 0.49, y: top + h * 0.3, title: 'Redis Pub/Sub', sub: 'health-check', color: '#22d3ee' },
    { x: width * 0.83, y: top + h * 0.3, title: 'WebSocket UI', sub: 'Live Push', color: '#10b981' },
  ];

  for (let i = 0; i < nodes.length - 1; i++) {
    const a = nodes[i];
    const b = nodes[i + 1];
    ctx.beginPath();
    ctx.moveTo(a.x + 42, a.y);
    ctx.lineTo(b.x - 42, b.y);
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.45)';
    ctx.lineWidth = 2;
    ctx.stroke();

    const pktT = (t * 0.7 + scrollP * 2 + i * 0.4) % 1;
    const px = a.x + 42 + (b.x - 42 - (a.x + 42)) * pktT;
    drawGlowingDot(ctx, px, a.y, 3.6, b.color);
  }

  nodes.forEach((n) => {
    const bw = Math.min(104, width * 0.25);
    drawRoundedRect(ctx, n.x - bw / 2, n.y - 24, bw, 48, 9);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
    ctx.fill();
    ctx.strokeStyle = n.color;
    ctx.lineWidth = 1.4;
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.fillStyle = '#f8fafc';
    ctx.font = '600 10.5px Inter, system-ui, sans-serif';
    ctx.fillText(n.title, n.x, n.y - 3);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '500 9px ui-monospace, SFMono-Regular, monospace';
    ctx.fillText(n.sub, n.x, n.y + 13);
  });

  // Live Latency Sparkline Strip
  const boxX = 20;
  const boxY = top + h * 0.55;
  const boxW = width - 40;
  const boxH = h * 0.38;

  drawRoundedRect(ctx, boxX, boxY, boxW, boxH, 10);
  ctx.fillStyle = 'rgba(2, 6, 23, 0.85)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(30, 41, 59, 0.9)';
  ctx.stroke();

  ctx.textAlign = 'left';
  ctx.fillStyle = '#6ee7b7';
  ctx.font = '600 9.5px ui-monospace, SFMono-Regular, monospace';
  ctx.fillText('REAL-TIME LATENCY TELEMETRY · 34ms — 42ms', boxX + 12, boxY + 18);

  const pts = 28;
  ctx.beginPath();
  for (let i = 0; i < pts; i++) {
    const x = boxX + 14 + (i / (pts - 1)) * (boxW - 28);
    const wave = Math.sin(i * 0.55 + t * 2.5 + scrollP * 8) * 10;
    const y = boxY + boxH * 0.65 + wave;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = '#10b981';
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawActThreeIncident(
  ctx: CanvasRenderingContext2D,
  width: number,
  top: number,
  h: number,
  scrollP: number,
  t: number
) {
  // Incident Timeline Bar
  const pad = 22;
  const barY = top + h * 0.24;
  const barW = width - pad * 2;

  drawRoundedRect(ctx, pad, barY, barW, 44, 9);
  ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(244, 63, 94, 0.45)';
  ctx.stroke();

  ctx.textAlign = 'left';
  ctx.fillStyle = '#fda4af';
  ctx.font = '600 9.5px ui-monospace, SFMono-Regular, monospace';
  ctx.fillText('INCIDENT TIMELINE · startedAt -> resolvedAt', pad + 12, barY + 16);

  // Green -> Red Outage Window -> Green Recovery
  const segY = barY + 26;
  const segW = barW - 24;
  const outStart = segW * 0.28;
  const outEnd = segW * 0.66;

  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#10b981';
  ctx.beginPath();
  ctx.moveTo(pad + 12, segY);
  ctx.lineTo(pad + 12 + outStart, segY);
  ctx.stroke();

  ctx.strokeStyle = '#f43f5e';
  ctx.beginPath();
  ctx.moveTo(pad + 12 + outStart, segY);
  ctx.lineTo(pad + 12 + outEnd, segY);
  ctx.stroke();

  ctx.strokeStyle = '#10b981';
  ctx.beginPath();
  ctx.moveTo(pad + 12 + outEnd, segY);
  ctx.lineTo(pad + 12 + segW, segY);
  ctx.stroke();

  // Signed Webhook Seal + Fan-out targets
  const srcX = width * 0.26;
  const srcY = top + h * 0.74;
  drawRoundedRect(ctx, srcX - 66, srcY - 24, 132, 48, 9);
  ctx.fillStyle = 'rgba(76, 5, 25, 0.45)';
  ctx.fill();
  ctx.strokeStyle = '#f43f5e';
  ctx.lineWidth = 1.4;
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = '600 10px Inter, system-ui, sans-serif';
  ctx.fillText('HMAC-SHA256 Signer', srcX, srcY - 3);
  ctx.fillStyle = '#fda4af';
  ctx.font = '500 8.5px ui-monospace, SFMono-Regular, monospace';
  ctx.fillText('X-Pulse-Signature', srcX, srcY + 13);

  const targets = [
    { y: top + h * 0.62, label: 'Slack Alert · 200' },
    { y: top + h * 0.84, label: 'PagerDuty · 200' },
  ];
  targets.forEach((tgt, idx) => {
    const tx = width * 0.77;
    const p0 = { x: srcX + 66, y: srcY };
    const p3 = { x: tx - 58, y: tgt.y };
    const p1 = { x: p0.x + 24, y: p0.y };
    const p2 = { x: p3.x - 24, y: p3.y };

    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.bezierCurveTo(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y);
    ctx.strokeStyle = 'rgba(244, 63, 94, 0.55)';
    ctx.lineWidth = 1.6;
    ctx.stroke();

    const pos = evalCubicBezier(p0, p1, p2, p3, (t * 0.65 + scrollP * 2 + idx * 0.35) % 1);
    drawGlowingDot(ctx, pos.x, pos.y, 3.2, '#f43f5e');

    drawRoundedRect(ctx, tx - 56, tgt.y - 14, 116, 28, 7);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.55)';
    ctx.stroke();
    ctx.fillStyle = '#6ee7b7';
    ctx.font = '600 9.5px ui-monospace, SFMono-Regular, monospace';
    ctx.fillText(tgt.label, tx + 2, tgt.y + 3);
  });
}

export type BenefitVisualKind = 'mttd' | 'telemetry' | 'webhook' | 'security';

/**
 * Compact, scroll-activated 2D Canvas micro-visualizations for the 4 Benefit cards.
 */
export function BenefitVisualCanvas({
  kind,
  ariaLabel,
}: {
  kind: BenefitVisualKind;
  ariaLabel: string;
}) {
  const holderRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const prefersReducedMotion = usePrefersReducedMotion();
  const { smoothProgressRef, isVisibleRef } = useScrollProgress(holderRef, {
    steps: 1,
    damping: 0.16,
  });

  useEffect(() => {
    const holder = holderRef.current;
    const canvas = canvasRef.current;
    if (!holder || !canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let size = { width: 320, height: 108 };
    const sync = () => {
      const rect = holder.getBoundingClientRect();
      size = syncHiDPICanvas(canvas, ctx, rect.width, 108);
    };
    sync();

    const ro = new ResizeObserver(sync);
    ro.observe(holder);

    let rafId = 0;

    const render = (now: number) => {
      const { width, height } = size;
      const p = prefersReducedMotion ? 1 : Math.min(1, smoothProgressRef.current * 1.5);
      const t = prefersReducedMotion ? 0.6 : now * 0.001;

      ctx.clearRect(0, 0, width, height);
      drawDotGrid(ctx, width, height, 18, 0.05);

      if (kind === 'mttd') {
        // Comparison bars: Manual 42m vs PulseStack 18s
        const barX = 14;
        const maxBarW = width - 28;
        ctx.font = '600 9.5px ui-monospace, SFMono-Regular, monospace';
        ctx.textAlign = 'left';

        ctx.fillStyle = '#fda4af';
        ctx.fillText('Manual Discovery · ~42 min', barX, 24);
        drawRoundedRect(ctx, barX, 30, maxBarW, 12, 6);
        ctx.fillStyle = 'rgba(244, 63, 94, 0.18)';
        ctx.fill();
        drawRoundedRect(ctx, barX, 30, Math.max(12, maxBarW * 0.92 * p), 12, 6);
        ctx.fillStyle = 'rgba(244, 63, 94, 0.72)';
        ctx.fill();

        ctx.fillStyle = '#6ee7b7';
        ctx.fillText('PulseStack Worker · < 60s', barX, 66);
        drawRoundedRect(ctx, barX, 72, maxBarW, 12, 6);
        ctx.fillStyle = 'rgba(16, 185, 129, 0.18)';
        ctx.fill();
        drawRoundedRect(ctx, barX, 72, Math.max(14, maxBarW * 0.14 * p), 12, 6);
        ctx.fillStyle = '#10b981';
        ctx.fill();
      } else if (kind === 'telemetry') {
        // Radial 99.98% SLA gauge + live wave
        const cx = 46;
        const cy = height / 2;
        const r = 28;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(16, 185, 129, 0.18)';
        ctx.lineWidth = 5;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 1.94 * p);
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 5;
        ctx.lineCap = 'round';
        ctx.stroke();

        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffffff';
        ctx.font = '700 11px ui-monospace, SFMono-Regular, monospace';
        ctx.fillText('99.98%', cx, cy + 4);

        // Mini sparkline on right
        const sx = 92;
        const sw = width - sx - 14;
        ctx.beginPath();
        for (let i = 0; i < 24; i++) {
          const x = sx + (i / 23) * sw;
          const y = cy + Math.sin(i * 0.6 + t * 3 + p * 4) * 14;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = '#22d3ee';
        ctx.lineWidth = 1.8;
        ctx.stroke();
      } else if (kind === 'webhook') {
        // Payload -> HMAC -> 200 OK
        const y = height * 0.45;
        const steps = [
          { x: width * 0.18, label: 'Payload', color: '#6366f1' },
          { x: width * 0.5, label: 'SHA-256', color: '#22d3ee' },
          { x: width * 0.82, label: '200 OK', color: '#10b981' },
        ];
        ctx.beginPath();
        ctx.moveTo(steps[0].x, y);
        ctx.lineTo(steps[2].x, y);
        ctx.strokeStyle = 'rgba(34, 211, 238, 0.35)';
        ctx.lineWidth = 1.8;
        ctx.stroke();

        const dotX = steps[0].x + (steps[2].x - steps[0].x) * ((t * 0.55 + p) % 1);
        drawGlowingDot(ctx, dotX, y, 3.2, '#22d3ee');

        steps.forEach((s) => {
          drawRoundedRect(ctx, s.x - 34, y - 14, 68, 28, 7);
          ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
          ctx.fill();
          ctx.strokeStyle = s.color;
          ctx.lineWidth = 1.2;
          ctx.stroke();
          ctx.fillStyle = '#e2e8f0';
          ctx.font = '600 9.5px ui-monospace, SFMono-Regular, monospace';
          ctx.textAlign = 'center';
          ctx.fillText(s.label, s.x, y + 3);
        });

        ctx.fillStyle = '#94a3b8';
        ctx.font = '500 9px ui-monospace, SFMono-Regular, monospace';
        ctx.fillText('Exponential Retry Backoff: 1s → 2s → 4s', width / 2, height - 14);
      } else {
        // Security: 15m Memory JWT + 7d Rotating Cookie
        const cy = height * 0.5;
        const leftX = width * 0.28;
        const rightX = width * 0.72;

        ctx.beginPath();
        ctx.moveTo(leftX + 46, cy);
        ctx.lineTo(rightX - 46, cy);
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.45)';
        ctx.lineWidth = 1.6;
        ctx.stroke();
        drawGlowingDot(
          ctx,
          leftX + 46 + (rightX - 46 - (leftX + 46)) * ((t * 0.5 + p) % 1),
          cy,
          3,
          '#f59e0b'
        );

        [
          { x: leftX, title: '15m JWT', sub: 'In-Memory', c: '#fbbf24' },
          { x: rightX, title: '7d Refresh', sub: 'Reuse Guard', c: '#10b981' },
        ].forEach((b) => {
          drawRoundedRect(ctx, b.x - 46, cy - 22, 92, 44, 8);
          ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
          ctx.fill();
          ctx.strokeStyle = b.c;
          ctx.lineWidth = 1.3;
          ctx.stroke();

          ctx.textAlign = 'center';
          ctx.fillStyle = '#ffffff';
          ctx.font = '600 10px Inter, system-ui, sans-serif';
          ctx.fillText(b.title, b.x, cy - 2);
          ctx.fillStyle = '#94a3b8';
          ctx.font = '500 8.5px ui-monospace, SFMono-Regular, monospace';
          ctx.fillText(b.sub, b.x, cy + 12);
        });
      }
    };

    const loop = (now: number) => {
      if (isVisibleRef.current || prefersReducedMotion) {
        render(now);
      }
      if (!prefersReducedMotion) {
        rafId = requestAnimationFrame(loop);
      }
    };

    render(performance.now());
    if (!prefersReducedMotion) {
      rafId = requestAnimationFrame(loop);
    }

    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
    };
  }, [kind, prefersReducedMotion, smoothProgressRef, isVisibleRef]);

  return (
    <div
      ref={holderRef}
      className="w-full rounded-lg border border-slate-800/80 bg-slate-950/80 overflow-hidden mb-4"
    >
      <canvas ref={canvasRef} role="img" aria-label={ariaLabel} className="block w-full" />
    </div>
  );
}
