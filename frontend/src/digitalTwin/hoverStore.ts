import { useSyncExternalStore } from 'react';

interface HoverState {
  id: string | null;
  x: number;
  y: number;
}

let hoverState: HoverState = {
  id: null,
  x: 0,
  y: 0,
};

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

export function setHoveredPart(id: string | null, x?: number, y?: number) {
  if (hoverState.id === id && (x === undefined || hoverState.x === x)) return;
  hoverState = {
    id,
    x: x ?? hoverState.x,
    y: y ?? hoverState.y,
  };
  notify();
}

export function useHoverStore(): HoverState {
  return useSyncExternalStore(
    (callback) => {
      listeners.add(callback);
      return () => listeners.delete(callback);
    },
    () => hoverState,
    () => hoverState
  );
}
