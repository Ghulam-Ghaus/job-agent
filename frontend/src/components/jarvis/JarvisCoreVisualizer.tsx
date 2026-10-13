'use client';

import React, { useEffect, useRef } from 'react';

export type JarvisState =
  | 'IDLE'
  | 'LISTENING'
  | 'SEARCHING'
  | 'EXECUTING_ACTION'
  | 'SPEAKING';

interface JarvisCoreVisualizerProps {
  state: JarvisState;
  audioLevel?: number; // 0.0 to 1.0 for microphone reactivity
  size?: number; // pixel width/height (default 280)
}

export const JarvisCoreVisualizer: React.FC<JarvisCoreVisualizerProps> = ({
  state,
  audioLevel = 0,
  size = 280,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let angle = 0;
    let pulse = 0;

    const render = () => {
      ctx.clearRect(0, 0, size, size);
      const cx = size / 2;
      const cy = size / 2;
      const baseRadius = size * 0.28;

      // Determine color theme based on operational state
      let primaryColor = '#06b6d4'; // Cyan default
      let accentColor = '#10b981'; // Emerald
      let glowColor = 'rgba(6, 182, 212, 0.4)';
      let speedMultiplier = 1;

      switch (state) {
        case 'LISTENING':
          primaryColor = '#10b981'; // Emerald reactive
          accentColor = '#34d399';
          glowColor = 'rgba(16, 185, 129, 0.55)';
          speedMultiplier = 1.6;
          break;
        case 'SEARCHING':
          primaryColor = '#8b5cf6'; // Electric violet
          accentColor = '#c084fc';
          glowColor = 'rgba(139, 92, 246, 0.6)';
          speedMultiplier = 2.8;
          break;
        case 'EXECUTING_ACTION':
          primaryColor = '#f59e0b'; // Amber / Gold action
          accentColor = '#fbbf24';
          glowColor = 'rgba(245, 158, 11, 0.65)';
          speedMultiplier = 3.5;
          break;
        case 'SPEAKING':
          primaryColor = '#06b6d4'; // Cyan / Teal harmonic
          accentColor = '#38bdf8';
          glowColor = 'rgba(56, 189, 248, 0.65)';
          speedMultiplier = 2.0;
          break;
        case 'IDLE':
        default:
          primaryColor = '#06b6d4';
          accentColor = '#10b981';
          glowColor = 'rgba(6, 182, 212, 0.35)';
          speedMultiplier = 0.8;
          break;
      }

      angle += 0.015 * speedMultiplier;
      pulse += 0.03;

      const dynamicRadius =
        baseRadius + (state === 'LISTENING' ? audioLevel * 18 : Math.sin(pulse) * 3);

      // 1. Ambient Background Core Glow
      const ambientGlow = ctx.createRadialGradient(cx, cy, 5, cx, cy, dynamicRadius * 1.6);
      ambientGlow.addColorStop(0, glowColor);
      ambientGlow.addColorStop(0.7, 'rgba(6, 8, 13, 0.1)');
      ambientGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = ambientGlow;
      ctx.beginPath();
      ctx.arc(cx, cy, dynamicRadius * 1.6, 0, Math.PI * 2);
      ctx.fill();

      // 2. Outer Holographic Segmented Ring
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(angle);
      const outerSegments = 16;
      for (let i = 0; i < outerSegments; i++) {
        const segAngle = (i * Math.PI * 2) / outerSegments;
        ctx.strokeStyle = i % 2 === 0 ? primaryColor : 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = i % 4 === 0 ? 3.5 : 1.5;
        ctx.beginPath();
        ctx.arc(
          0,
          0,
          dynamicRadius * 1.35,
          segAngle,
          segAngle + (Math.PI * 2) / outerSegments - 0.12,
        );
        ctx.stroke();
      }
      ctx.restore();

      // 3. Counter-Rotating Tilted Orbital Ring (3D ellipse effect)
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(-angle * 1.25);
      ctx.scale(1, 0.45);
      ctx.strokeStyle = accentColor;
      ctx.lineWidth = 2;
      ctx.shadowColor = accentColor;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(0, 0, dynamicRadius * 1.5, 0, Math.PI * 2);
      ctx.stroke();

      // Orbital Satellite Beads
      const bead1X = Math.cos(angle * 2) * dynamicRadius * 1.5;
      const bead1Y = Math.sin(angle * 2) * dynamicRadius * 1.5;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(bead1X, bead1Y, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // 4. Inner Arc Reactor Core
      ctx.save();
      ctx.shadowColor = primaryColor;
      ctx.shadowBlur = 24;

      // Inner Core Ring
      ctx.strokeStyle = primaryColor;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cx, cy, dynamicRadius, 0, Math.PI * 2);
      ctx.stroke();

      // Inner Turbine Spokes
      ctx.translate(cx, cy);
      ctx.rotate(angle * 1.5);
      const spokes = 8;
      for (let s = 0; s < spokes; s++) {
        const spokeAngle = (s * Math.PI * 2) / spokes;
        ctx.strokeStyle = primaryColor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(
          Math.cos(spokeAngle) * (dynamicRadius * 0.45),
          Math.sin(spokeAngle) * (dynamicRadius * 0.45),
        );
        ctx.lineTo(
          Math.cos(spokeAngle) * (dynamicRadius * 0.85),
          Math.sin(spokeAngle) * (dynamicRadius * 0.85),
        );
        ctx.stroke();
      }
      ctx.restore();

      // 5. Central Reactor Singularity (Glowing Center Dot)
      const centerGradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, dynamicRadius * 0.35);
      centerGradient.addColorStop(0, '#ffffff');
      centerGradient.addColorStop(0.3, primaryColor);
      centerGradient.addColorStop(1, 'rgba(6, 182, 212, 0)');
      ctx.fillStyle = centerGradient;
      ctx.beginPath();
      ctx.arc(cx, cy, dynamicRadius * 0.35, 0, Math.PI * 2);
      ctx.fill();

      // 6. State Scanning Laser Sweep (when SEARCHING or EXECUTING)
      if (state === 'SEARCHING' || state === 'EXECUTING_ACTION') {
        const scanY = cy + Math.sin(pulse * 2) * (dynamicRadius * 0.9);
        const scanGrad = ctx.createLinearGradient(cx - dynamicRadius, scanY, cx + dynamicRadius, scanY);
        scanGrad.addColorStop(0, 'rgba(0,0,0,0)');
        scanGrad.addColorStop(0.5, primaryColor);
        scanGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.strokeStyle = scanGrad;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx - dynamicRadius * 0.8, scanY);
        ctx.lineTo(cx + dynamicRadius * 0.8, scanY);
        ctx.stroke();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [state, audioLevel, size]);

  return (
    <div className="relative flex items-center justify-center select-none">
      <canvas
        ref={canvasRef}
        width={size}
        height={size}
        className="block drop-shadow-[0_0_25px_rgba(6,182,212,0.25)]"
      />
    </div>
  );
};
