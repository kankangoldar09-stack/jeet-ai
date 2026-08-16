import React, { useEffect, useRef, useState } from 'react';
import {
  Phone,
  PhoneOff,
  Mic,
  MicOff,
  Radio,
  X,
  Sparkles,
  Maximize2,
  Minimize2,
  Palette,
  Volume2,
  VolumeX,
  MessageSquare,
  Activity,
  Waves,
  Zap,
  Music,
  Crown
} from 'lucide-react';
import { getDisplayVoiceName } from './VoiceModal';

export interface ColorTheme {
  id: string;
  name: string;
  badge: string;
  glowColor: string;
  conicGradient: string;
  activeBorder: string;
  bgAtmosphere: string;
  accentText: string;
  btnBg: string;
  eqGradient: [string, string, string];
}

export const COLOR_THEMES: ColorTheme[] = [
  {
    id: 'blue',
    name: 'Cyan Electric Blue',
    badge: '#2e6eff',
    glowColor: 'rgba(0, 170, 255, 0.35)',
    conicGradient: `conic-gradient(from 0deg, #ffffff, #d8fbff, #7bddff, #2e6eff, #ffffff, #5b93ff, #d8fbff, #ffffff)`,
    activeBorder: '#2e6eff',
    bgAtmosphere: 'radial-gradient(circle, rgba(0,170,255,0.2) 0%, rgba(46,110,255,0.08) 50%, transparent 75%)',
    accentText: '#7bddff',
    btnBg: 'linear-gradient(135deg, #2e6eff, #00aaff)',
    eqGradient: ['#2e6eff', '#7bddff', '#ffffff'],
  },
  {
    id: 'red',
    name: 'Crimson Cyber Red',
    badge: '#ef4444',
    glowColor: 'rgba(239, 68, 68, 0.35)',
    conicGradient: `conic-gradient(from 0deg, #ffffff, #ffe4e6, #f87171, #ef4444, #ffffff, #dc2626, #fca5a5, #ffffff)`,
    activeBorder: '#ef4444',
    bgAtmosphere: 'radial-gradient(circle, rgba(239,68,68,0.22) 0%, rgba(220,38,38,0.08) 50%, transparent 75%)',
    accentText: '#fca5a5',
    btnBg: 'linear-gradient(135deg, #ef4444, #b91c1c)',
    eqGradient: ['#dc2626', '#ef4444', '#fca5a5'],
  },
  {
    id: 'green',
    name: 'Emerald Matrix Green',
    badge: '#10b981',
    glowColor: 'rgba(16, 185, 129, 0.35)',
    conicGradient: `conic-gradient(from 0deg, #ffffff, #d1fae5, #34d399, #10b981, #ffffff, #059669, #6ee7b7, #ffffff)`,
    activeBorder: '#10b981',
    bgAtmosphere: 'radial-gradient(circle, rgba(16,185,129,0.22) 0%, rgba(5,150,105,0.08) 50%, transparent 75%)',
    accentText: '#6ee7b7',
    btnBg: 'linear-gradient(135deg, #10b981, #047857)',
    eqGradient: ['#059669', '#10b981', '#6ee7b7'],
  },
  {
    id: 'purple',
    name: 'Neon Violet Purple',
    badge: '#c58af9',
    glowColor: 'rgba(197, 138, 249, 0.35)',
    conicGradient: `conic-gradient(from 0deg, #ffffff, #f3e8ff, #d8b4fe, #a855f7, #ffffff, #7e22ce, #e9d5ff, #ffffff)`,
    activeBorder: '#c58af9',
    bgAtmosphere: 'radial-gradient(circle, rgba(168,85,247,0.22) 0%, rgba(126,34,206,0.08) 50%, transparent 75%)',
    accentText: '#d8b4fe',
    btnBg: 'linear-gradient(135deg, #a855f7, #6b21a8)',
    eqGradient: ['#7e22ce', '#a855f7', '#d8b4fe'],
  },
  {
    id: 'gold',
    name: 'Solar Amber Gold',
    badge: '#f59e0b',
    glowColor: 'rgba(245, 158, 11, 0.35)',
    conicGradient: `conic-gradient(from 0deg, #ffffff, #fef3c7, #fcd34d, #f59e0b, #ffffff, #d97706, #fde68a, #ffffff)`,
    activeBorder: '#f59e0b',
    bgAtmosphere: 'radial-gradient(circle, rgba(245,158,11,0.22) 0%, rgba(217,119,6,0.08) 50%, transparent 75%)',
    accentText: '#fde68a',
    btnBg: 'linear-gradient(135deg, #f59e0b, #b45309)',
    eqGradient: ['#d97706', '#f59e0b', '#fde68a'],
  },
  {
    id: 'black',
    name: 'Dark Stealth Titanium',
    badge: '#94a3b8',
    glowColor: 'rgba(255, 255, 255, 0.18)',
    conicGradient: `conic-gradient(from 0deg, #ffffff, #94a3b8, #475569, #0f172a, #ffffff, #1e293b, #64748b, #ffffff)`,
    activeBorder: '#94a3b8',
    bgAtmosphere: 'radial-gradient(circle, rgba(255,255,255,0.12) 0%, rgba(100,116,139,0.05) 50%, transparent 75%)',
    accentText: '#cbd5e1',
    btnBg: 'linear-gradient(135deg, #334155, #0f172a)',
    eqGradient: ['#475569', '#94a3b8', '#ffffff'],
  },
];

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
  const [rotationDeg, setRotationDeg] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [frequencyData, setFrequencyData] = useState<number[]>(new Array(32).fill(4));
  const [callDuration, setCallDuration] = useState(0);
  const [isCompact, setIsCompact] = useState(false);
  const [selectedThemeId, setSelectedThemeId] = useState<string>('blue');
  const [isThemePickerOpen, setIsThemePickerOpen] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const timerRef = useRef<any>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const currentTheme = COLOR_THEMES.find((t) => t.id === selectedThemeId) || COLOR_THEMES[0];
  const displayVoiceName = getDisplayVoiceName(selectedVoice);

  // Call duration counter
  useEffect(() => {
    if (isActive) {
      setCallDuration(0);
      timerRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setCallDuration(0);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isActive]);

  // Audio stream analyzer & animated rotation matching user provided code + bottom sound effects
  useEffect(() => {
    if (!isActive || !micStream) {
      setScale(1);
      setAudioLevel(0);
      setFrequencyData(new Array(32).fill(4));
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
      analyser.smoothingTimeConstant = 0.75;

      const source = ctx.createMediaStreamSource(micStream);
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const animate = () => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const volume = sum / bufferLength;
        setAudioLevel(volume);

        // Extract 32 frequency buckets for the bottom equalizer
        const buckets: number[] = [];
        const step = Math.max(1, Math.floor(bufferLength / 32));
        for (let i = 0; i < 32; i++) {
          const rawVal = dataArray[i * step] || 0;
          const boost = isModelSpeaking ? Math.sin(Date.now() / 120 + i) * 35 + 45 : 0;
          const finalVal = Math.max(6, Math.min(100, (rawVal / 255) * 85 + boost));
          buckets.push(finalVal);
        }
        setFrequencyData(buckets);

        // Scale formula: 1 + (volume / 400) + boost if model speaking
        const boost = isModelSpeaking ? 45 : 0;
        const totalVol = volume + boost;
        const targetScale = 1 + totalVol / 380;
        setScale(targetScale);

        // Smooth rotation
        const deg = (Date.now() / 30) % 360;
        setRotationDeg(deg);

        // Render Canvas Live Oscilloscope Waveform at the bottom
        if (canvasRef.current) {
          const canvas = canvasRef.current;
          const ctx2d = canvas.getContext('2d');
          if (ctx2d) {
            ctx2d.clearRect(0, 0, canvas.width, canvas.height);
            const width = canvas.width;
            const height = canvas.height;
            const centerY = height / 2;

            // Draw glowing sonic wave
            ctx2d.beginPath();
            ctx2d.lineWidth = 3;
            const grad = ctx2d.createLinearGradient(0, 0, width, 0);
            grad.addColorStop(0, currentTheme.eqGradient[0]);
            grad.addColorStop(0.5, currentTheme.eqGradient[1]);
            grad.addColorStop(1, currentTheme.eqGradient[2]);
            ctx2d.strokeStyle = grad;
            ctx2d.shadowBlur = 12;
            ctx2d.shadowColor = currentTheme.badge;

            const sliceWidth = width / bufferLength;
            let x = 0;

            for (let i = 0; i < bufferLength; i++) {
              const v = dataArray[i] / 128.0;
              const y = isModelSpeaking
                ? centerY + Math.sin((i + Date.now() / 60) * 0.4) * (height * 0.38)
                : (v * height) / 2;

              if (i === 0) {
                ctx2d.moveTo(x, y);
              } else {
                ctx2d.lineTo(x, y);
              }
              x += sliceWidth;
            }
            ctx2d.lineTo(width, centerY);
            ctx2d.stroke();
          }
        }

        animationFrameRef.current = requestAnimationFrame(animate);
      };

      animate();
    } catch (err) {
      console.warn('Live Audio analyzer error', err);
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
  }, [isActive, micStream, isModelSpeaking, currentTheme]);

  // Handle Mute Mic
  const toggleMute = () => {
    if (micStream) {
      const audioTracks = micStream.getAudioTracks();
      if (audioTracks.length > 0) {
        audioTracks[0].enabled = !audioTracks[0].enabled;
        setIsMuted(!audioTracks[0].enabled);
      }
    }
  };

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remaining = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remaining.toString().padStart(2, '0')}`;
  };

  if (!isOpen) return null;

  let statusText = 'Ready to call ZoZo AI';
  if (isConnecting) {
    statusText = 'Connecting live neural link...';
  } else if (isActive) {
    if (isModelSpeaking) {
      statusText = `ZoZo AI (${displayVoiceName}) is speaking...`;
    } else {
      statusText = `Listening to ${userName}...`;
    }
  }

  return (
    <div
      id="ai-voice-full-app"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[#07080b]/98 backdrop-blur-2xl animate-fade-in p-0 md:p-4 select-none overflow-hidden"
    >
      {/* Outer Shell Container */}
      <div
        className={`relative w-full h-full ${
          isCompact
            ? 'max-w-xl max-h-[85vh] rounded-3xl border border-white/10'
            : 'max-w-full max-h-full md:rounded-3xl md:border md:border-white/10'
        } bg-[#0a0b0e] text-[#f5f5f5] flex flex-col justify-between overflow-hidden shadow-2xl transition-all duration-300`}
      >
        {/* Top Header Bar */}
        <header className="relative z-30 flex items-center justify-between px-5 md:px-8 py-3.5 border-b border-white/5 bg-white/[0.02] backdrop-blur-md">
          {/* Logo & Identity */}
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center text-white font-black text-sm shadow-lg border border-white/20"
              style={{ background: currentTheme.btnBg }}
            >
              <Sparkles className="w-5 h-5 fill-current" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base md:text-lg font-black text-white tracking-tight flex items-center gap-1.5">
                  <span>ZoZo AI Voice</span>
                  {selectedVoice.toLowerCase().includes('jeet') && (
                    <Crown className="w-4 h-4 text-amber-400 fill-amber-400" />
                  )}
                </h2>
                <span
                  className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border"
                  style={{
                    backgroundColor: `${currentTheme.badge}20`,
                    borderColor: `${currentTheme.badge}40`,
                    color: currentTheme.accentText,
                  }}
                >
                  {currentTheme.name.split(' ')[0]} Mode
                </span>
              </div>
              <p className="text-xs text-[#9aa0a6] flex items-center gap-1.5 mt-0.5">
                <span
                  className={`w-2 h-2 rounded-full ${
                    isActive ? 'bg-emerald-400 animate-ping' : 'bg-gray-500'
                  }`}
                />
                <span>
                  {isActive
                    ? `Live Call Duration: ${formatTime(callDuration)}`
                    : 'Real-time Gemini Speak-to-Speak'}
                </span>
              </p>
            </div>
          </div>

          {/* Header Controls: Theme Palette Selector, Indian Voice Selector, Compact, Close */}
          <div className="flex items-center gap-2 md:gap-3">
            {/* Color Palette Theme Switcher Button */}
            <div className="relative">
              <button
                onClick={() => setIsThemePickerOpen(!isThemePickerOpen)}
                className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xs font-bold shadow-sm border border-white/10 flex items-center gap-1.5 transition-all hover:scale-105 active:scale-95"
                title="Change Disc & Glow Colors (Red, Blue, Green, Purple, Gold, Black)"
              >
                <Palette className="w-3.5 h-3.5" style={{ color: currentTheme.badge }} />
                <span className="hidden sm:inline">Color</span>
                <span
                  className="w-3 h-3 rounded-full border border-white/40 inline-block shadow-sm"
                  style={{ backgroundColor: currentTheme.badge }}
                />
              </button>

              {/* Theme Dropdown Menu */}
              {isThemePickerOpen && (
                <div className="absolute right-0 top-full mt-2 w-64 p-3 rounded-2xl bg-[#12131a] border border-white/15 shadow-2xl z-50 animate-fade-in backdrop-blur-xl">
                  <div className="text-[11px] font-bold text-[#9aa0a6] uppercase tracking-wider mb-2.5 px-1 flex items-center justify-between">
                    <span>Select Disc Color</span>
                    <Sparkles className="w-3 h-3 text-amber-400" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {COLOR_THEMES.map((theme) => (
                      <button
                        key={theme.id}
                        onClick={() => {
                          setSelectedThemeId(theme.id);
                          setIsThemePickerOpen(false);
                        }}
                        className={`p-2 rounded-xl flex items-center gap-2.5 text-xs font-bold text-left transition-all border ${
                          selectedThemeId === theme.id
                            ? 'bg-white/15 border-white/40 text-white shadow-md'
                            : 'bg-white/5 border-transparent text-[#9aa0a6] hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        <span
                          className="w-4 h-4 rounded-full border border-white/30 shrink-0 shadow-sm"
                          style={{ backgroundColor: theme.badge }}
                        />
                        <span className="truncate">{theme.name.split(' ')[0]}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Indian Voice Changer Button */}
            <button
              onClick={onOpenVoiceModal}
              className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xs font-bold shadow-sm border border-white/10 flex items-center gap-1.5 transition-all hover:scale-105 active:scale-95"
              title="Change Voice (Jeet, Aarav, Rohan, Kabir, Priya, Ananya, Diya, Riya)"
            >
              <Radio className="w-3.5 h-3.5" style={{ color: currentTheme.accentText }} />
              <span className="hidden sm:inline">Voice: {displayVoiceName}</span>
            </button>

            {/* Compact / Maximize Toggle */}
            <button
              onClick={() => setIsCompact(!isCompact)}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/80 hover:text-white border border-white/10 hidden sm:flex items-center justify-center transition-all"
              title={isCompact ? 'Expand to Fullscreen' : 'Compact Window'}
            >
              {isCompact ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
            </button>

            {/* Close / Return to Chat */}
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-[#e3e3e3] text-xs font-semibold border border-white/10 flex items-center gap-1.5 transition-all"
              title="Return to Chat"
            >
              <MessageSquare className="w-3.5 h-3.5 text-[#7bddff]" />
              <span className="hidden sm:inline">Back to Chat</span>
              <X className="w-4 h-4 sm:hidden" />
            </button>
          </div>
        </header>

        {/* Center Stage: Exact HTML Layout + Reactive Disc + Sound FX */}
        <main className="relative flex-1 flex flex-col items-center justify-center p-4 md:p-6 my-auto z-20 overflow-hidden">
          {/* Outer Ambient Atmosphere Glow */}
          <div
            className="absolute rounded-full transition-all duration-700 pointer-events-none"
            style={{
              width: '420px',
              height: '420px',
              maxWidth: '85vw',
              maxHeight: '85vw',
              background: currentTheme.bgAtmosphere,
              filter: 'blur(50px)',
              transform: `scale(${scale * 1.25})`,
            }}
          />

          {/* Quick Color Themes Chips at the Top */}
          <div className="absolute top-2 md:top-4 flex items-center gap-1.5 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 z-30">
            <span className="text-[10px] font-bold text-gray-400 uppercase mr-1">Disc Color:</span>
            {COLOR_THEMES.map((theme) => (
              <button
                key={theme.id}
                onClick={() => setSelectedThemeId(theme.id)}
                className={`w-4 h-4 rounded-full transition-all border ${
                  selectedThemeId === theme.id
                    ? 'scale-125 border-white ring-2 ring-white/40'
                    : 'border-transparent opacity-60 hover:opacity-100'
                }`}
                style={{ backgroundColor: theme.badge }}
                title={`Switch to ${theme.name}`}
              />
            ))}
          </div>

          {/* Main Voice Disc Container with 3D Conic Gradient */}
          <div className="relative flex items-center justify-center my-auto pt-6">
            {/* Active Outer Sound Waves Ring */}
            {isActive && (
              <div
                className="absolute rounded-full border pointer-events-none transition-all duration-300 animate-ping"
                style={{
                  width: `${Math.min(350 * scale, 500)}px`,
                  height: `${Math.min(350 * scale, 500)}px`,
                  borderColor: `${currentTheme.badge}40`,
                  animationDuration: isModelSpeaking ? '1.5s' : '3s',
                }}
              />
            )}

            {/* The Main Dynamic Voice Disc */}
            <div
              className={`relative rounded-full overflow-hidden shadow-2xl transition-transform duration-75 ease-out flex items-center justify-center border-4 border-white/20`}
              style={{
                width: '74vw',
                height: '74vw',
                maxWidth: '290px',
                maxHeight: '290px',
                boxShadow: `0 20px 60px ${currentTheme.glowColor}, 0 0 40px ${currentTheme.glowColor}`,
                transform: `scale(${scale}) rotate(${isActive ? rotationDeg : 0}deg)`,
              }}
            >
              {/* Conic Gradient Inside the Disc */}
              <div
                className="absolute inset-[-20%] rounded-full transition-all"
                style={{
                  background: currentTheme.conicGradient,
                  filter: 'blur(10px)',
                  animation: isActive
                    ? `spin ${isModelSpeaking ? '1.8s' : '4s'} linear infinite`
                    : 'spin 20s linear infinite',
                }}
              />
            </div>

            {/* Overlaid Center Call Action Button */}
            <div className="absolute z-30 flex items-center justify-center">
              {!isActive ? (
                <button
                  onClick={onStartCall}
                  disabled={isConnecting}
                  className="bg-white hover:bg-gray-50 text-gray-900 border-none rounded-full py-3.5 px-6 flex items-center gap-3 cursor-pointer text-[15px] font-bold shadow-[0_10px_30px_rgba(0,0,0,0.35)] hover:scale-105 active:scale-95 transition-all"
                  title="Click to start Voice to Voice call"
                >
                  <div
                    className="w-8 h-8 rounded-full text-white flex items-center justify-center text-sm shadow-md"
                    style={{ background: currentTheme.btnBg }}
                  >
                    <Phone className="w-4 h-4 fill-current animate-pulse" />
                  </div>
                  <span className="font-extrabold text-black">
                    {isConnecting ? 'Connecting...' : 'Call AI'}
                  </span>
                </button>
              ) : (
                <button
                  onClick={onEndCall}
                  className="bg-red-600 hover:bg-red-700 text-white border-none rounded-full py-3.5 px-6 flex items-center gap-3 cursor-pointer text-[15px] font-bold shadow-[0_10px_30px_rgba(239,68,68,0.5)] hover:scale-105 active:scale-95 transition-all"
                  title="Disconnect live call"
                >
                  <div className="w-8 h-8 rounded-full bg-white text-red-600 flex items-center justify-center text-sm shadow-md">
                    <PhoneOff className="w-4 h-4" />
                  </div>
                  <span className="font-extrabold text-white">End Call</span>
                </button>
              )}
            </div>
          </div>

          {/* Status Text (Below the Disc) */}
          <div className="mt-4 flex flex-col items-center gap-1.5 z-20">
            <div
              className="px-4 py-1 rounded-full border text-xs md:text-sm font-bold tracking-wide flex items-center gap-2 shadow-lg backdrop-blur-md transition-all"
              style={{
                backgroundColor: `${currentTheme.badge}15`,
                borderColor: `${currentTheme.badge}35`,
                color: currentTheme.accentText,
              }}
            >
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  isActive
                    ? isModelSpeaking
                      ? 'animate-ping'
                      : 'animate-pulse'
                    : 'bg-gray-400'
                }`}
                style={{ backgroundColor: isActive ? currentTheme.badge : '#9ca3af' }}
              />
              <span>{statusText}</span>
            </div>
          </div>

          {/* ════════════════════════════════════════════════════════════════ */}
          {/* 🔥 BOTTOM SOUND EFFECTS & DYNAMIC EQUALIZER FREQUENCY BARS 🔥 */}
          {/* ════════════════════════════════════════════════════════════════ */}
          <div className="w-full max-w-lg mt-4 px-3 flex flex-col items-center gap-2 z-20">
            {/* Sound FX Header Tag */}
            <div className="flex items-center justify-between w-full text-[10px] font-bold text-[#9aa0a6] uppercase tracking-wider px-2">
              <div className="flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5" style={{ color: currentTheme.badge }} />
                <span>Live Audio FX Visualizer</span>
                {isActive && (
                  <span className="px-1.5 py-0.2 rounded text-[8px] bg-emerald-500/20 text-emerald-300 uppercase">
                    Stereo Active
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 font-mono">
                <span>{Math.round(audioLevel)} dB</span>
                <span className="text-[#9aa0a6]/50">|</span>
                <span style={{ color: currentTheme.accentText }}>24 kHz HD</span>
              </div>
            </div>

            {/* Dynamic Real-time Equalizer Frequency Bars */}
            <div className="w-full h-14 bg-black/40 backdrop-blur-md rounded-2xl border border-white/10 p-2.5 flex items-end justify-between gap-1 shadow-inner relative overflow-hidden">
              {/* Subtle background glow when speaking */}
              <div
                className="absolute inset-0 opacity-20 pointer-events-none transition-all duration-300"
                style={{
                  background: `radial-gradient(ellipse at center, ${currentTheme.badge}, transparent 70%)`,
                }}
              />

              {frequencyData.map((val, idx) => (
                <div
                  key={idx}
                  className="flex-1 rounded-full transition-all duration-75 relative"
                  style={{
                    height: `${isActive ? Math.max(8, val) : 8}%`,
                    background: `linear-gradient(to top, ${currentTheme.eqGradient[0]}, ${currentTheme.eqGradient[1]}, ${currentTheme.eqGradient[2]})`,
                    boxShadow:
                      val > 30 && isActive
                        ? `0 0 8px ${currentTheme.badge}`
                        : 'none',
                  }}
                />
              ))}
            </div>

            {/* Live Oscilloscope Waveform Canvas */}
            <div className="w-full h-8 overflow-hidden rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-center">
              <canvas
                ref={canvasRef}
                width={380}
                height={32}
                className="w-full h-full opacity-90"
              />
            </div>
          </div>
        </main>

        {/* Bottom Bar Controls (Mute, Change Voice, End Call, Quick Themes) */}
        <footer className="relative z-30 p-3.5 md:p-4 border-t border-white/5 bg-white/[0.02] backdrop-blur-md">
          <div className="max-w-md mx-auto flex items-center justify-center gap-2.5 md:gap-3 flex-wrap">
            {isActive && (
              <>
                {/* Mute / Unmute Button */}
                <button
                  onClick={toggleMute}
                  className={`py-2 px-3.5 rounded-xl border transition-all flex items-center gap-2 text-xs font-bold shadow-md ${
                    isMuted
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30'
                      : 'bg-white/10 text-white border-white/20 hover:bg-white/15'
                  }`}
                  title={isMuted ? 'Unmute Microphone' : 'Mute Microphone'}
                >
                  {isMuted ? (
                    <MicOff className="w-4 h-4 text-amber-400" />
                  ) : (
                    <Mic className="w-4 h-4 text-emerald-400" />
                  )}
                  <span>{isMuted ? 'Unmute Mic' : 'Mute Mic'}</span>
                </button>

                {/* Voice Changer Direct Button with Indian Name Display */}
                <button
                  onClick={onOpenVoiceModal}
                  className="py-2 px-3.5 rounded-xl bg-white/10 hover:bg-white/15 text-white border border-white/20 transition-all flex items-center gap-2 text-xs font-bold shadow-md"
                  title="Switch Indian Voice Character"
                >
                  <Radio className="w-4 h-4" style={{ color: currentTheme.accentText }} />
                  <span>Voice: {displayVoiceName.split(' ')[0]}</span>
                </button>
              </>
            )}

            {/* Quick Color Theme Switcher in Footer */}
            <button
              onClick={() => {
                const currentIndex = COLOR_THEMES.findIndex((t) => t.id === selectedThemeId);
                const nextTheme = COLOR_THEMES[(currentIndex + 1) % COLOR_THEMES.length];
                setSelectedThemeId(nextTheme.id);
              }}
              className="py-2 px-3.5 rounded-xl bg-white/10 hover:bg-white/15 text-white border border-white/20 transition-all flex items-center gap-2 text-xs font-bold shadow-md"
              title="Click to cycle through colors (Red, Green, Blue, Purple, Gold, Black)"
            >
              <Palette className="w-4 h-4" style={{ color: currentTheme.badge }} />
              <span>Color ({currentTheme.name.split(' ')[0]})</span>
            </button>
          </div>
        </footer>

        {/* Global Keyframes Animation */}
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
