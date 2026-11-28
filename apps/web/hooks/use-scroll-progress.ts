'use client';

import { useEffect, useRef, useState } from 'react';

interface UseScrollProgressOptions {
  /** Number of discrete steps to map 0..1 progress into (optional) */
  steps?: number;
  /** Smoothing factor for lerp damping (0..1, higher = snappier) */
  damping?: number;
}

/**
 * Tracks normalized scroll progress (0..1) of an element through the viewport
 * without causing React re-renders on every scroll tick.
 * Exposes `smoothProgressRef` for 60fps 2D canvas loops and `activeStep`
 * which only triggers a React render when crossing a discrete threshold.
 */
export function useScrollProgress<T extends HTMLElement>(
  ref: React.RefObject<T | null>,
  options: UseScrollProgressOptions = {}
) {
  const { steps = 3, damping = 0.14 } = options;

  const targetProgressRef = useRef(0);
  const smoothProgressRef = useRef(0);
  const isVisibleRef = useRef(false);
  const [activeStep, setActiveStep] = useState(0);
  const [hasEntered, setHasEntered] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const computeProgress = () => {
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight || 800;
      const totalTravel = rect.height + vh * 0.4;
      const traveled = vh * 0.78 - rect.top;
      const clamped = Math.max(0, Math.min(1, traveled / Math.max(1, totalTravel)));
      targetProgressRef.current = clamped;

      if (steps > 1) {
        const nextStep = Math.min(steps - 1, Math.floor(clamped * steps));
        setActiveStep((prev) => (prev === nextStep ? prev : nextStep));
      }
    };

    const io = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        const visible = entry?.isIntersecting ?? false;
        isVisibleRef.current = visible;
        if (visible) {
          setHasEntered(true);
          computeProgress();
        }
      },
      { threshold: 0.02, rootMargin: '80px 0px' }
    );

    io.observe(el);

    let rafId = 0;
    let isMounted = true;

    const tick = () => {
      if (!isMounted) return;
      const diff = targetProgressRef.current - smoothProgressRef.current;
      if (Math.abs(diff) > 0.0005) {
        smoothProgressRef.current += diff * damping;
      } else {
        smoothProgressRef.current = targetProgressRef.current;
      }
      rafId = requestAnimationFrame(tick);
    };

    const handleScroll = () => {
      if (isVisibleRef.current) {
        computeProgress();
      }
    };

    const initRaf = requestAnimationFrame(() => {
      computeProgress();
      smoothProgressRef.current = targetProgressRef.current;
    });

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll, { passive: true });
    rafId = requestAnimationFrame(tick);

    return () => {
      isMounted = false;
      cancelAnimationFrame(initRaf);
      cancelAnimationFrame(rafId);
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
      io.disconnect();
    };
  }, [ref, steps, damping]);

  return {
    targetProgressRef,
    smoothProgressRef,
    isVisibleRef,
    activeStep,
    hasEntered,
  };
}
