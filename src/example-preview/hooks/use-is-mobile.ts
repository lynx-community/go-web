import { useSyncExternalStore } from 'react';

const MOBILE_RE = /Android|iPhone|iPad|iPod/i;

function subscribe(): () => void {
  return () => {
    /* UA doesn't change at runtime */
  };
}

function getClientSnapshot(): boolean {
  return MOBILE_RE.test(navigator.userAgent);
}

function getServerSnapshot(): boolean {
  return false;
}

export function useIsMobile(): boolean {
  return useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);
}
