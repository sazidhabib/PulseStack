'use client';

import { useSyncExternalStore } from 'react';

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

/**
 * React 19 SSR-safe subscription to `prefers-reduced-motion`.
 */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    getReducedMotionServerSnapshot
  );
}

/**
 * Synchronizes a canvas element's backing store to its container width and
 * devicePixelRatio (capped at 2x for crisp HiDPI rendering without GPU bloat).
 */
export function syncHiDPICanvas(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
): { width: number; height: number } {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.max(240, Math.floor(width));
  const h = Math.max(120, Math.floor(height));

  if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { width: w, height: h };
}

export function drawRoundedRect(
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

export function evalCubicBezier(
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

export function drawDotGrid(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  step = 22,
  alpha = 0.08
) {
  ctx.fillStyle = `rgba(148, 163, 184, ${alpha})`;
  for (let gx = 14; gx < width; gx += step) {
    for (let gy = 14; gy < height; gy += step) {
      ctx.fillRect(gx, gy, 1.2, 1.2);
    }
  }
}

export function drawGlowingDot(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string
) {
  const grad = ctx.createRadialGradient(x, y, 0, x, y, radius * 3.2);
  grad.addColorStop(0, `${color}cc`);
  grad.addColorStop(1, `${color}00`);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y, radius * 3.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(x, y, radius * 0.65, 0, Math.PI * 2);
  ctx.fill();
}
