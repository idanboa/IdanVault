import { useEffect, useRef } from 'react';
import { useAuthStore } from '@/store/authStoreFirebase';

const DEFAULT_TIMEOUT = 15 * 60 * 1000; // 15 minutes

export function useAutoLock(enabled = true) {
  const { lock } = useAuthStore();
  const timeoutRef = useRef<NodeJS.Timeout>();

  const resetTimer = () => {
    if (!enabled) return;

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set new timeout
    timeoutRef.current = setTimeout(() => {
      lock();
    }, DEFAULT_TIMEOUT);
  };

  useEffect(() => {
    if (!enabled) return;

    // Activity events to reset timer
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];

    events.forEach(event => {
      window.addEventListener(event, resetTimer);
    });

    // Start initial timer
    resetTimer();

    // Cleanup
    return () => {
      events.forEach(event => {
        window.removeEventListener(event, resetTimer);
      });
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [enabled]);

  return { lock };
}
