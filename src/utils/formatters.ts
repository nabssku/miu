import type { IslandAnchorPosition } from '../types/miu';

export function formatTimerMMSS(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function formatDurationHM(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  if (hours === 0) return `${mins}m`;
  return `${hours}h ${mins}m`;
}

export function getSafeAreaClasses(position: IslandAnchorPosition): string {
  switch (position) {
    case 'top-left':
    case 'top-center':
    case 'top-right':
      return 'pt-24 pb-12 px-4 sm:px-8';
    case 'bottom-left':
    case 'bottom-center':
    case 'bottom-right':
      return 'pt-8 pb-28 px-4 sm:px-8';
    case 'mid-left':
      return 'pt-8 pb-12 pl-20 sm:pl-24 pr-4 sm:pr-8';
    case 'mid-right':
      return 'pt-8 pb-12 pl-4 sm:pl-8 pr-20 sm:pr-24';
    default:
      return 'pt-24 pb-12 px-4 sm:px-8';
  }
}

export function getAnchorContainerClasses(position: IslandAnchorPosition): string {
  switch (position) {
    case 'top-left':
      return 'top-3.5 left-4 items-start flex-col';
    case 'top-center':
      return 'top-3.5 left-1/2 -translate-x-1/2 items-center flex-col';
    case 'top-right':
      return 'top-3.5 right-4 items-end flex-col';
    case 'mid-left':
      return 'top-1/2 -translate-y-1/2 left-3.5 items-center flex-row';
    case 'mid-right':
      return 'top-1/2 -translate-y-1/2 right-3.5 items-center flex-row-reverse';
    case 'bottom-left':
      return 'bottom-4 left-4 items-start flex-col-reverse';
    case 'bottom-center':
      return 'bottom-4 left-1/2 -translate-x-1/2 items-center flex-col-reverse';
    case 'bottom-right':
      return 'bottom-4 right-4 items-end flex-col-reverse';
    default:
      return 'top-3.5 left-1/2 -translate-x-1/2 items-center flex-col';
  }
}

export function getAnchorMotionOrigin(position: IslandAnchorPosition): {
  initialY: number;
  initialX: number;
  transformOrigin: string;
} {
  switch (position) {
    case 'top-left':
      return { initialY: -8, initialX: 0, transformOrigin: 'top left' };
    case 'top-center':
      return { initialY: -8, initialX: 0, transformOrigin: 'top center' };
    case 'top-right':
      return { initialY: -8, initialX: 0, transformOrigin: 'top right' };
    case 'mid-left':
      return { initialY: 0, initialX: -10, transformOrigin: 'center left' };
    case 'mid-right':
      return { initialY: 0, initialX: 10, transformOrigin: 'center right' };
    case 'bottom-left':
      return { initialY: 8, initialX: 0, transformOrigin: 'bottom left' };
    case 'bottom-center':
      return { initialY: 8, initialX: 0, transformOrigin: 'bottom center' };
    case 'bottom-right':
      return { initialY: 8, initialX: 0, transformOrigin: 'bottom right' };
    default:
      return { initialY: -8, initialX: 0, transformOrigin: 'top center' };
  }
}
