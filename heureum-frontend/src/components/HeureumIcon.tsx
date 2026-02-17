// Copyright (c) 2026 Heureum AI. All rights reserved.

import { useId } from 'react';

interface HeureumIconProps {
  size?: number;
  className?: string;
}

export default function HeureumIcon({ size = 32, className }: HeureumIconProps) {
  const gradientId = useId();

  return (
    <svg
      height={size}
      viewBox="66 126 380 268"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#4f46e5" />
          <stop offset="50%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#7c3aed" />
        </linearGradient>
      </defs>
      <path d="M80 200 Q160 140 256 200 Q352 260 432 200" stroke={`url(#${gradientId})`} strokeWidth="28" strokeLinecap="round" />
      <path d="M80 260 Q160 200 256 260 Q352 320 432 260" stroke={`url(#${gradientId})`} strokeWidth="28" strokeLinecap="round" opacity="0.7" />
      <path d="M80 320 Q160 260 256 320 Q352 380 432 320" stroke={`url(#${gradientId})`} strokeWidth="28" strokeLinecap="round" opacity="0.4" />
    </svg>
  );
}
