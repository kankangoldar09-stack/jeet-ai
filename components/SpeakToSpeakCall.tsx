import React, { useEffect, useRef, useState } from 'react';
import { Phone, PhoneOff, Mic, MicOff, Volume2, X, Sparkles, Radio } from 'lucide-react';

interface SpeakToSpeakCallProps {
  isOpen: boolean;
  onClose: () => void;
  isActive: boolean;
  isConnecting: boolean;
  isModelSpeaking: boolean;
  userName: string;
  selectedVoice: string;
  onStartCall: () => void;
  onEndCall: () => void;
  onOpenVoiceModal: () => void;
  micStream: MediaStream | null;
}

export const SpeakToSpeakCall: React.FC<SpeakToSpeakCallProps> = ({
  isOpen,
  onClose,
  isActive,
  isConnecting,
  isModelSpeaking,
  userName,
  selectedVoice,
  onStartCall,
  onEndCall,
  onOpenVoiceModal,
  micStream,
}) => {
  const [scale, setScale] = useState(1);
  const [rotationSpeed, setRotationSpeed] = useState(20);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isActive || !micStream) {
      setScale(1);
      setRotationSpeed(20);
      if (audioContextRef.current) {
        try {
          audioContextRef.current.close();
        } catch (e) {}
        audioContextRef.current = null;
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      return;
    }

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      audioContextRef.current = ctx;
      const analyser = ctx.createAnalyser();
      analyserRef.current = analyser;
      analyser.fftSize = 128;
      const source = ctx.createMediaStreamSource(micStream);
      source.connect(analyser);

      const data = new Uint8Array(analyser.frequencyBinCount);

      const animate = () => {
        analyser.getByteFrequencyData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          sum += data[i];
        }
        const volume = sum / data.length;

        // When user speaks or model speaks, pulse dynamically
        const boost = isModelSpeaking ? 35 : volume;
        const targetScale = 1 + boost / 260;
        setScale(targetScale);

        if (volume > 15 || isModelSpeaking) {
          setRotationSpeed(2.5);
        } else {
          setRotationSpeed(14);
        }

        animationFrameRef.current = requestAnimationFrame(animate);
      };

      animate();
    } catch (err) {
      console.warn("Audio analyser error", err);
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioContextRef.current) {
        try {
          audioContextRef.current.close();
        } catch (e) {}
        audioContextRef.current = null;
      }
    };
  }, [isActive, micStream, isModelSpeaking]);

  if (!isOpen) return null;

  let statusText = "Ready to connect";
  if (isConnecting) statusText = "Establishing Neural Link...";
  else if (isActive) {
    if (isModelSpeaking) statusText = `ZoZo (${selectedVoice}) is speaking...`;
    else statusText = `Listening to ${userName}...`;
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/90 backdrop-blur-2xl animate-fade-in p-4">
      {/* Container - Phone size canvas */}
      <div className="relative w-full max-w-[420px] h-[85vh] max-h-[760px] bg-[#f7f9fc] text-[#1a1c1e] rounded-[40px] shadow-[0_25px_80px_rgba(0,0,0,0.6)] border border-white/20 flex flex-col items-center justify-between p-6 overflow-hidden select-none">
        
        {/* Top Header Bar */}
        <div className="w-full flex items-center justify-between z-30 pt-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#2e6eff] to-[#7bddff] flex items-center justify-center text-white font-bold text-xs shadow-md">
              Z
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#1a1c1e] tracking-tight">ZoZo AI Voice</h3>
              <p className="text-[10px] font-semibold text-[#5a6068]">Direct Neural Live Call</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onOpenVoiceModal}
              className="px-2.5 py-1 rounded-full bg-white text-[#2e6eff] text-[11px] font-bold shadow-sm border border-[#2e6eff]/20 hover:bg-[#2e6eff]/5 flex items-center gap-1 transition-all"
              title="Change Voice"
            >
              <Radio className="w-3 h-3" />
              <span>{selectedVoice}</span>
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-black/5 hover:bg-black/10 flex items-center justify-center text-[#1a1c1e] transition-all"
              title="Close Voice Mode"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Center Stage: Glow + Conic Rotating Disc */}
        <div className="relative flex-1 w-full flex flex-col items-center justify-center my-auto">
          {/* Radial Glow */}
          <div
            className="absolute rounded-full pointer-events-none transition-all duration-700"
            style={{
              width: '380px',
              height: '380px',
              background: 'radial-gradient(circle, rgba(46, 110, 255, 0.22), transparent 70%)',
              filter: 'blur(45px)',
              transform: `scale(${scale * 1.1})`,
            }}
          />

          {/* Voice Disc with Conic Gradient */}
          <div
            className="relative rounded-full overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.12)] transition-transform duration-100 ease-out flex items-center justify-center"
            style={{
              width: '260px',
              height: '260px',
              maxWidth: '75vw',
              maxHeight: '75vw',
              transform: `scale(${scale})`,
            }}
          >
            <div
              className="absolute inset-[-15%] rounded-full transition-all"
              style={{
                background: `conic-gradient(
                  from 0deg,
                  #ffffff,
                  #d8fbff,
                  #7bddff,
                  #2e6eff,
                  #ffffff,
                  #5b93ff,
                  #d8fbff,
                  #ffffff
                )`,
                filter: 'blur(10px)',
                animation: `spin ${rotationSpeed}s linear infinite`,
              }}
            />

            {/* Inner Core Accent */}
            <div className="relative z-10 w-24 h-24 rounded-full bg-white/75 backdrop-blur-md shadow-inner flex flex-col items-center justify-center border border-white/60">
              <Sparkles className="w-8 h-8 text-[#2e6eff] animate-pulse" />
              <span className="text-[10px] font-bold text-[#2e6eff] tracking-widest uppercase mt-0.5">
                {isActive ? 'LIVE' : 'READY'}
              </span>
            </div>
          </div>

          {/* Status Subtitle */}
          <div className="mt-8 flex flex-col items-center gap-1.5 z-20">
            <div className="flex items-center gap-2 px-3 py-1 bg-white/80 backdrop-blur-md rounded-full shadow-sm border border-black/5">
              <span
                className={`w-2 h-2 rounded-full ${
                  isActive
                    ? isModelSpeaking
                      ? 'bg-[#2e6eff] animate-ping'
                      : 'bg-emerald-500 animate-pulse'
                    : 'bg-gray-400'
                }`}
              />
              <span className="text-xs font-bold text-[#333] tracking-wide">
                {statusText}
              </span>
            </div>
            {isActive && (
              <p className="text-[11px] font-medium text-[#777]">
                Speak in Hindi or English naturally
              </p>
            )}
          </div>
        </div>

        {/* Bottom Call Action Button */}
        <div className="w-full flex items-center justify-center gap-4 z-30 pb-4">
          {!isActive ? (
            <button
              onClick={onStartCall}
              disabled={isConnecting}
              className="w-full py-3.5 px-6 rounded-full bg-[#1a1c1e] text-white hover:bg-black font-semibold text-sm shadow-[0_10px_25px_rgba(0,0,0,0.18)] hover:shadow-[0_15px_30px_rgba(0,0,0,0.25)] flex items-center justify-center gap-3 transition-all transform active:scale-95"
            >
              <div className="w-7 h-7 rounded-full bg-[#2e6eff] text-white flex items-center justify-center shadow-md">
                <Phone className="w-3.5 h-3.5 fill-current" />
              </div>
              <span className="tracking-wide">
                {isConnecting ? 'Connecting...' : 'Call ZoZo AI'}
              </span>
            </button>
          ) : (
            <div className="w-full flex items-center justify-center gap-3">
              <button
                onClick={onEndCall}
                className="flex-1 py-3.5 px-5 rounded-full bg-[#ef4444] text-white hover:bg-[#dc2626] font-semibold text-sm shadow-[0_8px_20px_rgba(239,68,68,0.3)] flex items-center justify-center gap-2 transition-all transform active:scale-95"
              >
                <div className="w-7 h-7 rounded-full bg-white text-[#ef4444] flex items-center justify-center shadow-sm">
                  <PhoneOff className="w-3.5 h-3.5" />
                </div>
                <span>End Call</span>
              </button>
            </div>
          )}
        </div>

        <style>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </div>
  );
};
