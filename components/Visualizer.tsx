import React, { useEffect, useRef } from 'react';

export type EmotionMode = 'normal' | 'happy' | 'respectful' | 'intense' | 'sweet';

interface VisualizerProps {
  isActive: boolean;
  isModelSpeaking: boolean;
  mode?: EmotionMode;
}

const Visualizer: React.FC<VisualizerProps> = ({ isActive, isModelSpeaking, mode = 'normal' }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let rotation = 0;

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const baseRadius = isActive ? 70 : 50;
      const pulseSpeed = mode === 'intense' ? 0.01 : 0.005;
      const pulse = Math.sin(Date.now() * pulseSpeed) * (mode === 'intense' ? 10 : 5);
      
      rotation += mode === 'intense' ? 0.03 : 0.01;

      let primaryColor = '100, 102, 241'; // Indigo
      
      if (mode === 'happy') primaryColor = '244, 63, 94';
      else if (mode === 'respectful') primaryColor = '16, 185, 129';
      else if (mode === 'intense') primaryColor = '239, 68, 68';

      if (isModelSpeaking) {
        primaryColor = mode === 'happy' ? '251, 113, 133' : '14, 165, 233';
      }

      const outerGlow = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, baseRadius * 2.5);
      outerGlow.addColorStop(0, `rgba(${primaryColor}, 0.2)`);
      outerGlow.addColorStop(1, 'transparent');
      ctx.fillStyle = outerGlow;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        const r = baseRadius + i * 20 + pulse;
        const startAngle = rotation * (i + 1) * 0.7;
        ctx.arc(centerX, centerY, r, startAngle, startAngle + Math.PI * (0.5 + i * 0.1));
        const alpha = (0.8 - i * 0.15);
        ctx.strokeStyle = `rgba(${primaryColor}, ${alpha})`;
        ctx.lineWidth = mode === 'intense' ? 4 : 2;
        ctx.stroke();
      }

      const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, baseRadius);
      gradient.addColorStop(0, `rgb(${primaryColor})`);
      gradient.addColorStop(1, 'rgba(0,0,0,0.8)');

      ctx.beginPath();
      ctx.arc(centerX, centerY, baseRadius - 5 + pulse, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();

      animationFrameId = requestAnimationFrame(animate);
    };

    animate();
    return () => cancelAnimationFrame(animationFrameId);
  }, [isActive, isModelSpeaking, mode]);

  return (
    <div className="relative flex items-center justify-center w-full h-full">
      <canvas 
        ref={canvasRef} 
        width={400} 
        height={400} 
        className="w-full h-full pointer-events-none"
      />
      {isActive && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
          <p className={`text-[10px] uppercase tracking-[0.4em] font-black opacity-90 ${mode === 'happy' ? 'text-rose-200' : 'text-white'}`}>
            {isModelSpeaking ? "ACTIVE" : (mode === 'happy' ? 'SWEET' : mode.toUpperCase())}
          </p>
        </div>
      )}
    </div>
  );
};

export default Visualizer;