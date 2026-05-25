"use client";

import { useEffect, useState } from "react";

interface Options {
  onRefresh: () => Promise<void> | void;
  threshold?: number;
  enabled?: boolean;
}

// Lightweight pull-to-refresh: only arms when the page is already scrolled
// to the very top, so it doesn't fight regular scrolling. Returns the live
// pull distance (px) and a `refreshing` flag so the caller can render an
// indicator.
export function usePullToRefresh({ onRefresh, threshold = 80, enabled = true }: Options) {
  const [pullY, setPullY] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    let startY = 0;
    let active = false;

    const handleTouchStart = (e: TouchEvent) => {
      if (window.scrollY > 0) return;
      startY = e.touches[0].clientY;
      active = true;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!active) return;
      const dy = e.touches[0].clientY - startY;
      if (dy <= 0) {
        setPullY(0);
        return;
      }
      // Dampen the pull so it doesn't feel rubber-band linear.
      setPullY(Math.min(dy * 0.5, threshold * 1.5));
    };

    const handleTouchEnd = async () => {
      if (!active) return;
      active = false;
      if (pullY >= threshold && !refreshing) {
        setRefreshing(true);
        try {
          await onRefresh();
        } finally {
          setRefreshing(false);
        }
      }
      setPullY(0);
    };

    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: true });
    window.addEventListener("touchend", handleTouchEnd);
    return () => {
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, [enabled, onRefresh, pullY, refreshing, threshold]);

  return { pullY, refreshing };
}
