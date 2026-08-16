import React, { useState } from 'react';
import { X, Volume2, Check, Sparkles, Radio, Play, Square, Loader2, Crown } from 'lucide-react';

export interface VoiceOption {
  id: string;
  name: string;
  title: string;
  gender: 'Female' | 'Male' | 'Neutral';
  vibe: string;
  accentColor: string;
  badge: string;
  samplePrompt: string;
  modelVoice: string;
}

export const VOICES: VoiceOption[] = [
  {
    id: 'Jeet',
    name: 'Jeet (Boss Voice)',
    title: 'Mastermind & Creator',
    gender: 'Male',
    vibe: 'Deep, commanding, confident & powerful — Jeet Boss Signature Voice 👑',
    accentColor: '#ef4444',
    badge: 'Creator Special 👑',
    samplePrompt: 'Hukum kijiye! Main Jeet Boss ka powerful neural voice engine hoon. ZoZo AI aapki seva mein hazir hai!',
    modelVoice: 'Fenrir',
  },
  {
    id: 'Aarav',
    name: 'Aarav',
    title: 'Deep Resonator',
    gender: 'Male',
    vibe: 'Cinematic, heavy, mature & solid Hindi baritone voice',
    accentColor: '#f59e0b',
    badge: 'Cinematic Baritone',
    samplePrompt: 'Namaste Bhai! Aarav voice connected hai. Jo bhi query ho aaram se puchiye.',
    modelVoice: 'Charon',
  },
  {
    id: 'Rohan',
    name: 'Rohan',
    title: 'Energetic & Witty',
    gender: 'Male',
    vibe: 'Playful, fast, funny & mast bro-style conversationalist',
    accentColor: '#10b981',
    badge: 'High Energy Bro',
    samplePrompt: 'Arre Bhai! Rohan yahan hai boss. Aaj full masti aur instant answers milenge!',
    modelVoice: 'Puck',
  },
  {
    id: 'Kabir',
    name: 'Kabir',
    title: 'Dynamic Orator',
    gender: 'Male',
    vibe: 'Bold, articulate, motivational & charismatic delivery',
    accentColor: '#f97316',
    badge: 'Motivational',
    samplePrompt: 'Namaste Bhai! Kabir voice ready hai. Har challenge ko number one banayenge!',
    modelVoice: 'Orpheus',
  },
  {
    id: 'Priya',
    name: 'Priya',
    title: 'Neural ZoZo Classic',
    gender: 'Female',
    vibe: 'Sweet, calm, elegant, polite & graceful companion',
    accentColor: '#8ab4f8',
    badge: 'ZoZo Classic',
    samplePrompt: 'Haanji Bhai! Main Priya hoon. Bataiye aaj main aapki kya madad kar sakti hoon?',
    modelVoice: 'Kore',
  },
  {
    id: 'Ananya',
    name: 'Ananya',
    title: 'Smart & Crisp',
    gender: 'Female',
    vibe: 'Fast, bright, smart & super responsive Indian female tone',
    accentColor: '#38bdf8',
    badge: 'Fast & Smart',
    samplePrompt: 'Namaste Bhai! Ananya voice ready hai. Lightning-fast answers ke liye puchiye!',
    modelVoice: 'Zephyr',
  },
  {
    id: 'Diya',
    name: 'Diya',
    title: 'Melodic & Empathetic',
    gender: 'Female',
    vibe: 'Expressive, warm, musical & empathetic cadence',
    accentColor: '#ec4899',
    badge: 'Warm & Friendly',
    samplePrompt: 'Ji Bhai! Diya voice connect ho chuki hai. Aapke har doubt ko pyaar se solve karenge.',
    modelVoice: 'Aoede',
  },
  {
    id: 'Riya',
    name: 'Riya',
    title: 'Executive AI',
    gender: 'Female',
    vibe: 'Polished, structured, clear & executive professional voice',
    accentColor: '#a855f7',
    badge: 'Executive',
    samplePrompt: 'Namaste Bhai! Riya voice active hai. Accurate facts aur structured answers milenge.',
    modelVoice: 'Leda',
  },
];

// Helper to map any voice ID to the underlying Gemini TTS / Live voice name
export const getModelVoiceName = (voiceId: string): string => {
  const found = VOICES.find((v) => v.id.toLowerCase() === voiceId.toLowerCase() || v.name.toLowerCase().includes(voiceId.toLowerCase()));
  if (found) return found.modelVoice;

  // Check if legacy id was passed
  const legacyMatch = VOICES.find((v) => v.modelVoice.toLowerCase() === voiceId.toLowerCase());
  if (legacyMatch) return legacyMatch.modelVoice;

  return 'Fenrir';
};

export const getDisplayVoiceName = (voiceId: string): string => {
  const found = VOICES.find((v) => v.id.toLowerCase() === voiceId.toLowerCase() || v.modelVoice.toLowerCase() === voiceId.toLowerCase());
  return found ? found.name : voiceId;
};

interface VoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedVoice: string;
  onSelectVoice: (voiceId: string) => void;
  onPreviewVoice: (voice: VoiceOption) => Promise<void>;
  previewingVoiceId: string | null;
}

export const VoiceModal: React.FC<VoiceModalProps> = ({
  isOpen,
  onClose,
  selectedVoice,
  onSelectVoice,
  onPreviewVoice,
  previewingVoiceId,
}) => {
  const [filter, setFilter] = useState<'All' | 'Female' | 'Male'>('All');

  if (!isOpen) return null;

  const filteredVoices = VOICES.filter((v) => {
    if (filter === 'All') return true;
    if (filter === 'Female') return v.gender === 'Female';
    if (filter === 'Male') return v.gender === 'Male' || v.gender === 'Neutral';
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-black/80 backdrop-blur-md animate-fade-in">
      <div 
        className="fixed inset-0"
        onClick={onClose}
      />
      <div className="relative w-full max-w-3xl max-h-[90vh] bg-[#1a1b1e] border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden z-10 animate-scale-up">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 md:px-6 md:py-5 border-b border-white/10 bg-[#141517]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#ef4444] via-[#8ab4f8] to-[#10b981] flex items-center justify-center shadow-[0_0_15px_rgba(239,68,68,0.3)]">
              <Radio className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg md:text-xl font-black text-white tracking-tight">Desi Indian Voices Matrix</h3>
                <span className="px-2 py-0.5 text-[10px] font-bold bg-[#ef4444]/20 text-[#fca5a5] border border-[#ef4444]/30 rounded-full flex items-center gap-1">
                  <Crown className="w-3 h-3 text-amber-400" /> Jeet & 7 Indian Voices
                </span>
              </div>
              <p className="text-xs text-[#9aa0a6]">Select voice for Live AI Voice Call, Speak-to-Speak & Audio Narration</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-[#9aa0a6] hover:text-white hover:bg-white/5 rounded-xl transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter bar */}
        <div className="flex items-center justify-between px-5 py-3 md:px-6 bg-[#18191c] border-b border-white/5">
          <div className="flex items-center gap-2">
            {(['All', 'Female', 'Male'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  filter === f
                    ? 'bg-[#8ab4f8] text-[#0a0a0a] shadow-md shadow-[#8ab4f8]/20'
                    : 'text-[#9aa0a6] hover:text-white hover:bg-white/5'
                }`}
              >
                {f === 'All' ? 'All Indian Voices (8)' : f === 'Female' ? 'Female (4)' : 'Male Voices (4)'}
              </button>
            ))}
          </div>
          <span className="hidden sm:inline-block text-[11px] text-[#8ab4f8] font-mono">
            Active: <strong className="text-white">{getDisplayVoiceName(selectedVoice)}</strong>
          </span>
        </div>

        {/* Voice grid */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
            {filteredVoices.map((voice) => {
              const isSelected = selectedVoice.toLowerCase() === voice.id.toLowerCase() || selectedVoice.toLowerCase() === voice.modelVoice.toLowerCase();
              const isPreviewing = previewingVoiceId === voice.id || previewingVoiceId === voice.modelVoice;

              return (
                <div
                  key={voice.id}
                  onClick={() => onSelectVoice(voice.id)}
                  className={`group relative p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                    isSelected
                      ? 'bg-gradient-to-br from-[#ef4444]/15 via-[#8ab4f8]/10 to-transparent border-[#8ab4f8] shadow-[0_0_20px_rgba(138,180,248,0.2)] ring-1 ring-[#8ab4f8]/40'
                      : 'bg-[#141517] border-white/5 hover:border-white/20 hover:bg-white/[0.03]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-11 h-11 rounded-xl flex items-center justify-center font-black text-sm shadow-md transition-transform group-hover:scale-105"
                        style={{
                          backgroundColor: `${voice.accentColor}20`,
                          color: voice.accentColor,
                          border: `1px solid ${voice.accentColor}40`,
                        }}
                      >
                        {voice.id === 'Jeet' ? '👑' : voice.name.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-white text-sm md:text-base flex items-center gap-1.5">
                            <span>{voice.name}</span>
                          </h4>
                          <span
                            className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider"
                            style={{
                              backgroundColor: `${voice.accentColor}20`,
                              color: voice.accentColor,
                            }}
                          >
                            {voice.badge}
                          </span>
                        </div>
                        <span className="text-xs text-[#9aa0a6]">{voice.title} · {voice.gender}</span>
                      </div>
                    </div>

                    {isSelected && (
                      <div className="w-6 h-6 rounded-full bg-[#8ab4f8] text-[#0a0a0a] flex items-center justify-center shadow-md">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </div>
                    )}
                  </div>

                  <p className="text-xs text-[#c4c7c5] leading-relaxed line-clamp-2">
                    {voice.vibe}
                  </p>

                  {/* Actions */}
                  <div className="flex items-center justify-between pt-2 border-t border-white/5 mt-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onPreviewVoice(voice);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                        isPreviewing
                          ? 'bg-[#8ab4f8] text-[#0a0a0a] animate-pulse'
                          : 'bg-white/5 text-[#c4c7c5] hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      {isPreviewing ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Speaking...</span>
                        </>
                      ) : (
                        <>
                          <Volume2 className="w-3.5 h-3.5 text-[#8ab4f8]" />
                          <span>Test Sample</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectVoice(voice.id);
                      }}
                      className={`text-xs font-bold transition-colors ${
                        isSelected
                          ? 'text-[#8ab4f8]'
                          : 'text-[#9aa0a6] hover:text-white'
                      }`}
                    >
                      {isSelected ? 'Active Voice ✓' : 'Set as Voice'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 md:px-6 bg-[#141517] border-t border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-[#9aa0a6]">
            <Sparkles className="w-4 h-4 text-[#8ab4f8]" />
            <span>Voice automatically syncs with Live Speak-to-Speak Call & Speech Reader</span>
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-[#8ab4f8] text-[#0a0a0a] font-bold text-xs hover:bg-white transition-all shadow-md shadow-[#8ab4f8]/20"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
