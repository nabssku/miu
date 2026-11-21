'use client';

import React from 'react';

interface MiuAIFaceIconProps {
  className?: string;
}

/**
 * Clean minimalist Miu AI face emblem inspired by editorial line-art assistants.
 * Uses currentColor so it adapts seamlessly between light and dark themes.
 */
export const MiuAIFaceIcon: React.FC<MiuAIFaceIconProps> = ({
  className = 'w-5 h-5'
}) => {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      {/* Subtle cat-ear editorial silhouette / brow sweep */}
      <path
        d="M5.5 11.2C5.2 8.2 7.2 5.4 10.1 4.6C12.8 3.9 15.8 4.6 17.6 6.8C19.3 8.9 19.4 12.2 18.2 15C17 17.9 14.3 19.6 11.3 19.4C8.4 19.2 6 17.1 5.6 14.2"
        stroke="currentColor"
        strokeWidth="1.55"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Top hairline / brow arch */}
      <path
        d="M8.1 7.6C10.5 6.4 13.7 6.5 16.4 8.2"
        stroke="currentColor"
        strokeWidth="1.45"
        strokeLinecap="round"
      />
      {/* Left eye */}
      <circle cx="10.2" cy="11.1" r="1.05" fill="currentColor" />
      {/* Right eye */}
      <circle cx="14.7" cy="10.8" r="1.05" fill="currentColor" />
      {/* Minimalist angled nose */}
      <path
        d="M12.6 10.6L12.1 13.7L13.5 13.9"
        stroke="currentColor"
        strokeWidth="1.45"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Subtle calm smile */}
      <path
        d="M10.4 15.9C11.4 16.5 12.9 16.4 13.9 15.7"
        stroke="currentColor"
        strokeWidth="1.45"
        strokeLinecap="round"
      />
    </svg>
  );
};
