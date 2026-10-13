'use client';

import React, { useEffect, useState } from 'react';

interface JarvisWaveformProps {
  active: boolean;
  audioLevel?: number; // 0 to 1
  barsCount?: number;
}

export const JarvisWaveform: React.FC<JarvisWaveformProps> = ({
  active,
  audioLevel = 0,
  barsCount = 28,
}) => {
  const [mounted, setMounted] = useState(false);
  const [pulse, setPulse] = useState(0);

  useEffect(() => {
    setMounted(true);
    let animId: number;
    const animate = () => {
      setPulse((p) => p + 0.08);
      animId = requestAnimationFrame(animate);
    };
    animId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animId);
  }, []);

  return (
    <div className="flex items-center justify-center gap-1 h-10 px-4 py-1 select-none">
      {Array.from({ length: barsCount }).map((_, i) => {
        // Symmetric bell-curve multiplier
        const centerDistance = Math.abs(i - barsCount / 2) / (barsCount / 2);
        const bellFactor = Math.cos((centerDistance * Math.PI) / 2);

        // Harmonic heights (use deterministic baseline before client mount)
        const dynamicFactor = !mounted
          ? 0.3
          : active
            ? Math.sin(pulse + i * 0.45) * 0.5 + 0.5 + audioLevel * 1.5
            : Math.sin(pulse * 0.4 + i * 0.3) * 0.2 + 0.25;

        // Use Math.round to prevent floating point SSR/client precision mismatches
        const heightPx = Math.round(Math.max(4, Math.min(36, dynamicFactor * bellFactor * 34)));

        // Color gradient along the spectrum: emerald -> cyan -> purple
        const progress = i / barsCount;
        let barColor = 'rgba(6, 182, 212, 0.4)'; // cyan default

        if (active && mounted) {
          if (progress < 0.3) barColor = '#10b981'; // emerald
          else if (progress < 0.7) barColor = '#06b6d4'; // cyan
          else barColor = '#8b5cf6'; // purple
        } else {
          barColor = 'rgba(6, 182, 212, 0.3)';
        }

        return (
          <span
            key={i}
            style={{
              height: `${heightPx}px`,
              backgroundColor: barColor,
              boxShadow: active && mounted ? `0 0 8px ${barColor}` : 'none',
            }}
            className="w-1 rounded-full transition-all duration-75"
          />
        );
      })}
    </div>
  );
};
