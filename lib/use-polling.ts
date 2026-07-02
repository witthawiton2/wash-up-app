import { useEffect, useRef } from "react";

// Polling with visibility awareness:
// - Pauses the interval while the tab is hidden (saves API quota and
//   avoids piling stale intervals up while the user is on another tab).
// - Fires an immediate refetch the moment the tab becomes visible
//   again, so returning to the dashboard shows fresh data at once
//   instead of after a full interval.
export function usePolling(callback: () => void, intervalMs: number = 30000, enabled: boolean = true) {
  const savedCallback = useRef(callback);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!enabled) return;

    let id: ReturnType<typeof setInterval> | null = null;
    const tick = () => savedCallback.current();

    const start = () => {
      if (id !== null) return;
      id = setInterval(tick, intervalMs);
    };
    const stop = () => {
      if (id === null) return;
      clearInterval(id);
      id = null;
    };
    const onVisibility = () => {
      if (typeof document === "undefined") return;
      if (document.visibilityState === "visible") {
        tick(); // fetch fresh data right away
        start();
      } else {
        stop();
      }
    };

    // Kick off — running or paused depending on current visibility.
    if (typeof document !== "undefined" && document.visibilityState === "hidden") {
      // wait for the tab to come back
    } else {
      start();
    }
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVisibility);
    }

    return () => {
      stop();
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisibility);
      }
    };
  }, [intervalMs, enabled]);
}
