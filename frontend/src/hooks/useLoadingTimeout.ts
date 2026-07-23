import { useEffect, useState } from "react";

export function useLoadingTimeout(
  isLoading: boolean,
  timeoutMs = 8000,
): boolean {
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      setTimedOut(false);
      return;
    }

    const timer = window.setTimeout(() => setTimedOut(true), timeoutMs);
    return () => window.clearTimeout(timer);
  }, [isLoading, timeoutMs]);

  return isLoading && timedOut;
}
