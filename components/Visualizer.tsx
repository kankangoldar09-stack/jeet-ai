import React, { useEffect, useRef } from 'react';

interface VisualizerProps {
  isActive: boolean;
  isModelSpeaking: boolean;
  mode?: 'normal' | 'intense' | 'neural' | 'friday';
}

const Visualizer: React.FC<VisualizerProps> = ({ isActive, isModelSpeaking, mode = 'normal' }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let time = 0;

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      time += 0.02;

      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const intensity = isModelSpeaking ? 1.6 : 0.7;

      if (mode === 'neural' || mode === 'friday') {
        const isFriday = mode === 'friday';
        const primaryColor = isFriday ? '#8ab4f8' : '#ef4444';
        const secondaryColor = isFriday ? '#1e3a8a' : '#7f1d1d';
        const glowColor = isFriday ? 'rgba(138, 180, 248, 0.4)' : 'rgba(220, 38, 38, 0.4)';
        const orbitColor = isFriday ? 'rgba(138, 180, 248, 0.3)' : 'rgba(220, 38, 38, 0.3)';

        // Central Orb
        const orbSize = 40 * (1 + (isModelSpeaking ? Math.sin(time * 10) * 0.15 : Math.sin(time * 2) * 0.05));
        
        // Outer Glow
        const outerGlow = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, orbSize * 2.5);
        outerGlow.addColorStop(0, glowColor);
        outerGlow.addColorStop(1, 'transparent');
        ctx.fillStyle = outerGlow;
        ctx.beginPath();
        ctx.arc(centerX, centerY, orbSize * 2.5, 0, Math.PI * 2);
        ctx.fill();

        // Core Orb
        const innerGlow = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, orbSize);
        innerGlow.addColorStop(0, primaryColor);
        innerGlow.addColorStop(1, secondaryColor);
        ctx.fillStyle = innerGlow;
        ctx.beginPath();
        ctx.arc(centerX, centerY, orbSize, 0, Math.PI * 2);
        ctx.fill();

        // Orbits / HUD Rings
        ctx.strokeStyle = orbitColor;
        ctx.lineWidth = 1.5;
        
        const drawOrbit = (radius: number, speed: number, dashOffset: number, dashes: number[] = [30, 60, 10, 40]) => {
          ctx.beginPath();
          ctx.setLineDash(dashes);
          ctx.lineDashOffset = time * speed + dashOffset;
          ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
          ctx.stroke();
        };

        drawOrbit(60, -20, 0);
        drawOrbit(80, 15, 100);
        drawOrbit(100, -10, 50);
        
        if (isFriday) {
          drawOrbit(120, 5, 200, [5, 15]);
          drawOrbit(140, -8, 0, [2, 10]);
        }
        
        ctx.setLineDash([]); // Reset
      } else {
        // Default Glowing Blobs
        const blobs = [
          { color: 'rgba(34, 211, 238, 0.5)', x: -80, y: 50, size: 120 },
          { color: 'rgba(232, 121, 249, 0.5)', x: 80, y: 50, size: 130 },
          { color: 'rgba(132, 204, 22, 0.5)', x: 0, y: 80, size: 110 }
        ];

        blobs.forEach((blob, i) => {
          const xOffset = Math.sin(time + i * 2) * 40 * intensity;
          const yOffset = Math.cos(time * 0.9 + i) * 30 * intensity;
          const currentSize = blob.size * (1 + Math.sin(time * 1.5 + i) * 0.15 * intensity);

          const gradient = ctx.createRadialGradient(
            centerX + blob.x + xOffset,
            centerY + blob.y + yOffset,
            0,
            centerX + blob.x + xOffset,
            centerY + blob.y + yOffset,
            currentSize
          );
          gradient.addColorStop(0, blob.color);
          gradient.addColorStop(1, 'transparent');

          ctx.globalCompositeOperation = 'lighter';
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(centerX + blob.x + xOffset, centerY + blob.y + yOffset, currentSize, 0, Math.PI * 2);
          ctx.fill();
        });
        ctx.filter = 'blur(50px)';
      }

      animationFrameId = requestAnimationFrame(animate);
    };

    animate();
    return () => {
      cancelAnimationFrame(animationFrameId);
      if (ctx) ctx.filter = 'none';
    };
  }, [isActive, isModelSpeaking, mode]);

  return (
    <div className="relative flex items-center justify-center w-full h-full overflow-hidden">
      <canvas 
        ref={canvasRef} 
        width={400} 
        height={400} 
        className={`w-full h-full pointer-events-none ${mode === 'neural' ? 'scale-100' : 'scale-[1.8]'}`}
      />
    </div>
  );
};

export default Visualizer;