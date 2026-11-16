'use client';

import React, { useEffect, useId, useState } from 'react';
import { motion } from 'framer-motion';
import type { MascotMood } from '../../types/miu';

interface MiuMascotProps {
  mood: MascotMood;
  isHidden?: boolean;
  size?: number;
  showHalo?: boolean;
}

const MOOD_RING_COLORS: Record<MascotMood, string> = {
  idle: 'rgba(56, 189, 248, 0.25)',
  focus: 'rgba(244, 63, 94, 0.38)',
  music: 'rgba(16, 185, 129, 0.38)',
  lazytype: 'rgba(139, 92, 246, 0.45)',
  hydration: 'rgba(56, 189, 248, 0.45)',
  stretch: 'rgba(20, 184, 166, 0.45)',
  sholat: 'rgba(245, 158, 11, 0.45)',
  sleep: 'rgba(148, 163, 184, 0.18)'
};

export const MiuMascot: React.FC<MiuMascotProps> = ({
  mood,
  isHidden = false,
  size = 24,
  showHalo = false
}) => {
  const uid = useId();
  const [isBlinking, setIsBlinking] = useState(false);

  // Blink every 6 seconds when visible and awake (pauses when tab is hidden)
  useEffect(() => {
    if (isHidden || mood === 'sleep') return;
    const interval = window.setInterval(() => {
      setIsBlinking(true);
      window.setTimeout(() => setIsBlinking(false), 160);
    }, 6000);
    return () => window.clearInterval(interval);
  }, [isHidden, mood]);

  const effectiveMood: MascotMood = isHidden ? 'sleep' : mood;
  const shouldBob =
    !isHidden &&
    (effectiveMood === 'music' || effectiveMood === 'lazytype' || effectiveMood === 'stretch');

  const bodyGradId = `miu-body-${uid}`;
  const earGradId = `miu-ear-${uid}`;

  return (
    <motion.div
      className="relative inline-flex items-center justify-center shrink-0 select-none"
      style={{ width: size, height: size }}
      animate={
        shouldBob
          ? { y: [0, -1.8, 0], rotate: [0, -3.5, 3.5, 0] }
          : { y: 0, rotate: 0 }
      }
      transition={
        shouldBob
          ? { repeat: Infinity, duration: 1.5, ease: 'easeInOut' }
          : { duration: 0.2 }
      }
    >
      {showHalo && (
        <span
          className="absolute inset-0 rounded-full blur-[5px] pointer-events-none transition-colors duration-300"
          style={{ backgroundColor: MOOD_RING_COLORS[effectiveMood] }}
        />
      )}

      <svg
        viewBox="0 0 36 36"
        className="w-full h-full overflow-visible relative z-10"
        fill="none"
        aria-label={`Maskot Miu (${effectiveMood})`}
      >
        <defs>
          <linearGradient id={bodyGradId} x1="18" y1="6" x2="18" y2="31" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="65%" stopColor="#F5EFE6" />
            <stop offset="100%" stopColor="#E6D8C3" />
          </linearGradient>
          <linearGradient id={earGradId} x1="18" y1="7" x2="18" y2="15" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FDA4AF" stopOpacity="0.65" />
            <stop offset="100%" stopColor="#F43F5E" stopOpacity="0.2" />
          </linearGradient>
        </defs>

        {/* Headphones band when music mode */}
        {effectiveMood === 'music' && (
          <g>
            <path
              d="M5.5 17.5C5.5 9.2 11 4.2 18 4.2C25 4.2 30.5 9.2 30.5 17.5"
              stroke="#10B981"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <rect x="2.8" y="14.5" width="4.4" height="8.5" rx="2.2" fill="#10B981" />
            <rect x="3.8" y="16" width="1.5" height="5.5" rx="0.75" fill="#A7F3D0" />
            <rect x="28.8" y="14.5" width="4.4" height="8.5" rx="2.2" fill="#10B981" />
            <rect x="30.7" y="16" width="1.5" height="5.5" rx="0.75" fill="#A7F3D0" />
          </g>
        )}

        {/* Miu silhouette: tactile cloud-cat head & ears */}
        <path
          d="M6.5 14.5C6.5 9.2 9.8 5.8 12.6 9.8C15.2 8.9 20.8 8.9 23.4 9.8C26.2 5.8 29.5 9.2 29.5 14.5V22.2C29.5 27.4 24.8 30.5 18 30.5C11.2 30.5 6.5 27.4 6.5 22.2V14.5Z"
          fill={`url(#${bodyGradId})`}
          stroke="rgba(15, 23, 42, 0.18)"
          strokeWidth="0.9"
        />

        {/* Inner ear blush triangles */}
        <path d="M8.8 12.5C9.1 9.8 10.6 8.8 11.8 10.8L8.8 12.5Z" fill={`url(#${earGradId})`} />
        <path d="M27.2 12.5C26.9 9.8 25.4 8.8 24.2 10.8L27.2 12.5Z" fill={`url(#${earGradId})`} />

        {/* Soft rosy cheeks */}
        <ellipse cx="11.2" cy="21.4" rx="2.1" ry="1.3" fill="#F43F5E" fillOpacity="0.34" />
        <ellipse cx="24.8" cy="21.4" rx="2.1" ry="1.3" fill="#F43F5E" fillOpacity="0.34" />

        {/* Eyes */}
        {effectiveMood === 'sleep' || isBlinking ? (
          <>
            <path
              d="M11.8 18.2C12.7 19.2 14.3 19.2 15.2 18.2"
              stroke="#0F172A"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
            <path
              d="M20.8 18.2C21.7 19.2 23.3 19.2 24.2 18.2"
              stroke="#0F172A"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </>
        ) : effectiveMood === 'stretch' ? (
          /* Happy upward squinting eyes for stretch */
          <>
            <path
              d="M11.8 18.6C12.7 17.3 14.3 17.3 15.2 18.6"
              stroke="#0F172A"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
            <path
              d="M20.8 18.6C21.7 17.3 23.3 17.3 24.2 18.6"
              stroke="#0F172A"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </>
        ) : (
          <>
            <circle cx="13.5" cy="18.2" r="2.05" fill="#0F172A" />
            <circle cx="12.9" cy="17.5" r="0.65" fill="#FFFFFF" />
            <circle cx="22.5" cy="18.2" r="2.05" fill="#0F172A" />
            <circle cx="21.9" cy="17.5" r="0.65" fill="#FFFFFF" />
          </>
        )}

        {/* Study Glasses when Focus/Pomodoro */}
        {effectiveMood === 'focus' && (
          <g>
            <circle
              cx="13.5"
              cy="18.2"
              r="3.8"
              fill="rgba(56, 189, 248, 0.14)"
              stroke="#F43F5E"
              strokeWidth="1.5"
            />
            <circle
              cx="22.5"
              cy="18.2"
              r="3.8"
              fill="rgba(56, 189, 248, 0.14)"
              stroke="#F43F5E"
              strokeWidth="1.5"
            />
            <line x1="17.3" y1="18.2" x2="18.7" y2="18.2" stroke="#F43F5E" strokeWidth="1.5" />
            {/* Tiny lens glint */}
            <line
              x1="11.5"
              y1="16.2"
              x2="12.5"
              y2="15.4"
              stroke="#FFFFFF"
              strokeOpacity="0.7"
              strokeWidth="1"
              strokeLinecap="round"
            />
            <line
              x1="20.5"
              y1="16.2"
              x2="21.5"
              y2="15.4"
              stroke="#FFFFFF"
              strokeOpacity="0.7"
              strokeWidth="1"
              strokeLinecap="round"
            />
          </g>
        )}

        {/* Cute cat mouth ("w" smile) */}
        <path
          d="M15.8 21.3C16.5 22.2 17.6 22.1 18 21.3C18.4 22.1 19.5 22.2 20.2 21.3"
          stroke="#0F172A"
          strokeWidth="1.45"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Contextual Props */}
        {effectiveMood === 'lazytype' && (
          <g transform="translate(24.5, 18.5)">
            <rect x="1" y="0" width="4.8" height="7.4" rx="2.4" fill="#8B5CF6" stroke="#DDD6FE" strokeWidth="0.8" />
            <line x1="3.4" y1="7.4" x2="3.4" y2="10.5" stroke="#C4B5FD" strokeWidth="1.6" strokeLinecap="round" />
            <path d="M7.4 2.2C8.3 3.1 8.3 4.5 7.4 5.4" stroke="#A78bfa" strokeWidth="1.2" strokeLinecap="round" />
          </g>
        )}

        {effectiveMood === 'hydration' && (
          <g transform="translate(24, 18.5)">
            <path
              d="M1 1.5H6.8L6 9.2H1.8L1 1.5Z"
              fill="#38BDF8"
              stroke="#FFFFFF"
              strokeWidth="0.9"
              strokeLinejoin="round"
            />
            <line x1="4.8" y1="-1" x2="3.9" y2="2" stroke="#F43F5E" strokeWidth="1.2" strokeLinecap="round" />
          </g>
        )}

        {effectiveMood === 'stretch' && (
          <g>
            {/* Raised little paws */}
            <circle cx="6.2" cy="16" r="2.2" fill="#F5EFE6" stroke="#14B8A6" strokeWidth="1.1" />
            <circle cx="29.8" cy="16" r="2.2" fill="#F5EFE6" stroke="#14B8A6" strokeWidth="1.1" />
          </g>
        )}

        {effectiveMood === 'sholat' && (
          <path
            d="M27.8 5.2C25.8 5.8 25 8.2 26.1 10C27.1 11.6 29.3 12 30.8 10.9C28.8 10.9 27.5 9.1 27.8 5.2Z"
            fill="#FBBF24"
          />
        )}
      </svg>

      {effectiveMood === 'sleep' && (
        <span className="absolute -top-1.5 -right-2 text-[8px] font-mono font-bold text-sky-300 leading-none tracking-tighter">
          zZz
        </span>
      )}
    </motion.div>
  );
};
