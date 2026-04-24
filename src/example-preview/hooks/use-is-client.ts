import { useSyncExternalStore } from 'react';

function subscribe(): () => void {
  return () => {
    /* no-op */
  };
}

function getClientSnapshot(): boolean {
  return true;
}

function getServerSnapshot(): boolean {
  return false;
}

export function useIsClient(): boolean {
  return useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);
}
