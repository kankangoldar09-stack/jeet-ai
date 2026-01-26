import React, { useEffect, useRef } from 'react';

interface VisualizerProps {
  isActive: boolean;
  isModelSpeaking: boolean;
  mode?: 'normal' | 'intense';
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

      // Draw Glowing Blobs (Matches Screenshot Colors: Cyan, Magenta, Lime)
      const blobs = [
        { color: 'rgba(34, 211, 238, 0.5)', x: -80, y: 50, size: 120 }, // Cyan
        { color: 'rgba(232, 121, 249, 0.5)', x: 80, y: 50, size: 130 },  // Magenta
        { color: 'rgba(132, 204, 22, 0.5)', x: 0, y: 80, size: 110 }     // Lime Green
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

      // Add a heavy blur effect for that "Live" glowing look
      ctx.filter = 'blur(50px)';

      animationFrameId = requestAnimationFrame(animate);
    };

    animate();
    return () => {
      cancelAnimationFrame(animationFrameId);
      if (ctx) ctx.filter = 'none';
    };
  }, [isActive, isModelSpeaking]);

  return (
    <div className="relative flex items-center justify-center w-full h-full overflow-hidden">
      <canvas 
        ref={canvasRef} 
        width={400} 
        height={400} 
        className="w-full h-full pointer-events-none scale-[1.8]"
      />
    </div>
  );
};

export default Visualizer;